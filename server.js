require('dotenv').config();

const path = require('path');
const express = require('express');
const Stripe = require('stripe');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;
const apiKey = process.env.GEMINI_API_KEY?.trim();
const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;
const GEMINI_TIMEOUT_MS = 45000;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : null;

console.log(`GEMINI_API_KEY configurada: ${Boolean(apiKey)}`);
console.log(`Stripe configurado: ${Boolean(stripeSecretKey)}`);
console.log(`DATABASE_URL configurada: ${Boolean(pool)}`);

async function initializeDatabase() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS synastry_payments (
      id BIGSERIAL PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      person_data JSONB NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pagado_pendiente', 'pagado_completado')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      reading_text TEXT
    )
  `);
  await pool.query('ALTER TABLE synastry_payments ADD COLUMN IF NOT EXISTS reading_text TEXT');
}

function requireDatabase(res) {
  if (!pool) {
    res.status(503).json({ error: 'DATABASE_URL no está configurada en el servidor.' });
    return false;
  }
  return true;
}

app.use((req, res, next) => {
  console.log(`[PETICIÓN ENTRANTE] ${req.method} ${req.url}`);
  next();
});

app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !stripeWebhookSecret || !pool) {
    return res.status(503).send('Webhook de Stripe no configurado.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], stripeWebhookSecret);
  } catch (error) {
    console.error('Firma de webhook Stripe inválida:', error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    const session = event.data.object;
    if (session.payment_status !== 'paid') return res.json({ received: true });
    let compatibility = null;
    try {
      compatibility = session.metadata?.compatibility ? JSON.parse(session.metadata.compatibility) : null;
    } catch {
      console.warn(`Metadata compatibility inválida para ${session.id}.`);
    }
    const personData = {
      nameOne: session.metadata?.nameOne,
      dateOne: session.metadata?.dateOne,
      nameTwo: session.metadata?.nameTwo,
      dateTwo: session.metadata?.dateTwo,
      relationshipState: session.metadata?.relationshipState,
      relationshipScore: Number(session.metadata?.relationshipScore || 0),
      signOne: session.metadata?.signOne,
      elementOne: session.metadata?.elementOne,
      signTwo: session.metadata?.signTwo,
      elementTwo: session.metadata?.elementTwo,
      compatibility
    };

    await pool.query(`
      INSERT INTO synastry_payments (session_id, person_data, status)
      VALUES ($1, $2, 'pagado_pendiente')
      ON CONFLICT (session_id) DO NOTHING
    `, [session.id, personData]);
  }

  return res.json({ received: true });
});

app.use(express.json());
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición debe ser JSON válido.' });
  }
  return next(error);
});
app.use(express.static('.'));

app.post('/api/create-checkout-session', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'STRIPE_SECRET_KEY no está configurada en el servidor.' });
  const { couple } = req.body || {};
  if (!couple?.nameOne || !couple?.dateOne || !couple?.nameTwo || !couple?.dateTwo) {
    return res.status(400).json({ error: 'Se requieren los datos completos de ambas personas.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'mxn',
          product_data: { name: 'Consulta de sinastría Kali Oráculo' },
          unit_amount: 5000
        },
        quantity: 1
      }],
      metadata: Object.fromEntries(Object.entries({
        nameOne: couple.nameOne,
        dateOne: couple.dateOne,
        nameTwo: couple.nameTwo,
        dateTwo: couple.dateTwo,
        relationshipState: couple.relationshipState,
        relationshipScore: couple.relationshipScore,
        signOne: couple.signOne,
        elementOne: couple.elementOne,
        signTwo: couple.signTwo,
        elementTwo: couple.elementTwo,
        compatibility: JSON.stringify(couple.compatibility)
      }).map(([key, value]) => [key, String(value ?? '')])),
      success_url: `${process.env.PUBLIC_URL || 'http://localhost:3001'}/?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.PUBLIC_URL || 'http://localhost:3001'}/?payment=cancelled`
    });
    return res.json({ url: session.url });
  } catch (error) {
    console.error('Error creando Checkout Session:', error);
    return res.status(500).json({ error: 'No fue posible iniciar el pago con Stripe.' });
  }
});

app.post('/api/generate-synastry', async (req, res) => {
  try {
    const { prompt, session_id: sessionId } = req.body || {};

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Se requiere un prompt válido.' });
    }

    if (!apiKey) {
      return res.status(503).json({ error: 'GEMINI_API_KEY no está configurada en el servidor.' });
    }

    if (!sessionId || !requireDatabase(res)) return;
    const paymentResult = await pool.query(`
      SELECT id, status, reading_text
      FROM synastry_payments
      WHERE session_id = $1
        AND created_at > NOW() - INTERVAL '48 hours'
      LIMIT 1
    `, [sessionId]);
    const payment = paymentResult.rows[0];
    if (!payment) {
      return res.status(402).json({ error: 'No encontramos un pago vigente para esta lectura.' });
    }
    if (payment.status === 'pagado_completado' && payment.reading_text) {
      return res.json({ text: payment.reading_text });
    }
    if (payment.status !== 'pagado_pendiente') {
      return res.status(402).json({ error: 'El pago no está disponible para generar esta lectura.' });
    }

    console.log('Iniciando llamada a Gemini...');
    const geminiController = new AbortController();
    const geminiTimeoutId = setTimeout(() => geminiController.abort(), GEMINI_TIMEOUT_MS);
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7
        }
      }),
      signal: geminiController.signal
    });
    clearTimeout(geminiTimeoutId);

    const responseBody = await response.text();
    let data;
    try {
      data = JSON.parse(responseBody);
    } catch {
      data = {};
    }

    if (!response.ok) {
      const error = new Error(data.error?.message || `Gemini respondió con HTTP ${response.status}.`);
      error.status = response.status;
      error.body = responseBody;
      throw error;
    }

    const text = data.candidates
      ?.flatMap((candidate) => candidate.content?.parts || [])
      .map((part) => part.text)
      .filter((partText) => typeof partText === 'string' && partText.trim())
      .join('\n')
      .trim();

    if (!text) {
      const error = new Error('Gemini respondió sin texto generado.');
      error.status = 502;
      error.body = responseBody;
      throw error;
    }

    await pool.query(`
      UPDATE synastry_payments
      SET status = 'pagado_completado', completed_at = NOW(), reading_text = $2
      WHERE id = $1
    `, [payment.id, text]);
    return res.json({ text });
  } catch (error) {
    console.error('Error en servidor Gemini:', error);
    const isTimeout = error.name === 'AbortError';
    return res.status(error.status || 500).json({
      error: isTimeout ? 'La consulta a Gemini tardó demasiado.' : error.message || 'Error interno al generar la lectura.',
      status: error.status || 500,
      body: error.body || null
    });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initializeDatabase()
  .then(() => app.listen(PORT, () => {
    console.log(`Kali Oráculo backend disponible en http://localhost:${PORT}`);
  }))
  .catch((error) => {
    console.error('No fue posible inicializar la base de datos:', error);
    process.exit(1);
  });
