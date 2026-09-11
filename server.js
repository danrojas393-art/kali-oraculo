require('dotenv').config();

const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;
const apiKey = process.env.GEMINI_API_KEY?.trim();
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

console.log(`GEMINI_API_KEY configurada: ${Boolean(apiKey)}`);

app.use((req, res, next) => {
  console.log(`[PETICIÓN ENTRANTE] ${req.method} ${req.url}`);
  next();
});

app.use(express.json());
app.use(express.static('.'));

app.post('/api/generate-synastry', async (req, res) => {
  try {
    const { prompt } = req.body || {};

    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'Se requiere un prompt válido.' });
    }

    if (!apiKey) {
      return res.status(503).json({ error: 'GEMINI_API_KEY no está configurada en el servidor.' });
    }

    console.log('Iniciando llamada a Gemini...');
    const response = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7
        }
      })
    });

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

    return res.json({ text });
  } catch (error) {
    console.error('Error en servidor Gemini:', error);
    return res.status(error.status || 500).json({
      error: error.message,
      status: error.status || 500,
      body: error.body || null
    });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Kali Oráculo backend disponible en http://localhost:${PORT}`);
});
