const ACCESS_CODES = new Set(["KALI2026", "PRUEBA100"]);

const form = document.querySelector('#synastry-form');
const paywall = document.querySelector('#paywall');
const vipForm = document.querySelector('#vip-form');
const stripeButton = document.querySelector('#stripe-button');
const formError = document.querySelector('#form-error');
const vipFeedback = document.querySelector('#vip-feedback');
const reading = document.querySelector('#reading');
const closePaywall = document.querySelector('#close-paywall');
const retryReading = document.querySelector('#retry-reading');
const storedState = { couple: JSON.parse(sessionStorage.getItem('kali-couple') || 'null') };

let stripeCheckoutPromise;
const REQUEST_TIMEOUT_MS = 90000;
const SLOW_READING_NOTICE_MS = 12000;

fetch('/ping', { cache: 'no-store' }).catch((error) => {
  console.warn('No fue posible despertar el servidor:', error.message);
});

stripeButton.addEventListener('click', async (event) => {
  if (!stripeCheckoutPromise) {
    event.preventDefault();
    return;
  }
  event.preventDefault();
  try {
    window.location.href = await stripeCheckoutPromise;
  } catch {
    // El mensaje de error ya se muestra en el botón.
  }
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  formError.textContent = '';
  if (!form.reportValidity()) return;

  const formData = Object.fromEntries(new FormData(form).entries());
  const firstZodiac = getZodiacInfo(formData.dateOne);
  const secondZodiac = getZodiacInfo(formData.dateTwo);
  const relationshipOption = form.querySelector('#relationship-state').selectedOptions[0];
  if (!firstZodiac || !secondZodiac) {
    formError.textContent = 'Ingresa fechas de nacimiento válidas.';
    return;
  }
  storedState.couple = {
    ...formData,
    signOne: firstZodiac.sign,
    elementOne: firstZodiac.element,
    signTwo: secondZodiac.sign,
    elementTwo: secondZodiac.element,
    relationshipState: formData.relationshipState,
    relationshipScore: Number(relationshipOption.dataset.score),
    compatibility: getCompatibility(firstZodiac.element, secondZodiac.element, Number(relationshipOption.dataset.score))
  };
  sessionStorage.setItem('kali-couple', JSON.stringify(storedState.couple));
  reading.classList.add('is-hidden');
  openPaywall();
  prepareStripeCheckout(storedState.couple);
});

vipForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const code = document.querySelector('#vip-code').value.trim().toUpperCase();
  if (!ACCESS_CODES.has(code)) {
    vipFeedback.textContent = 'Ese código no es válido. Verifica e inténtalo de nuevo.';
    return;
  }
  if (!storedState.couple) {
    vipFeedback.textContent = 'Primero captura los datos de ambas personas.';
    return;
  }
  unlockReading('VIP');
});

closePaywall.addEventListener('click', closeModal);
paywall.addEventListener('click', (event) => {
  if (event.target === paywall) closeModal();
});

document.querySelector('#download-card').addEventListener('click', () => {
  const canvas = document.querySelector('#share-card');
  const link = document.createElement('a');
  link.download = 'kali-sinastria.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

const params = new URLSearchParams(window.location.search);
const returnedSessionId = params.get('session_id');
if (returnedSessionId) localStorage.setItem('kali-stripe-session-id', returnedSessionId);
if (params.get('payment') === 'success' && storedState.couple && returnedSessionId) {
  unlockReading('STRIPE', returnedSessionId);
}

retryReading.addEventListener('click', () => {
  const sessionId = localStorage.getItem('kali-stripe-session-id');
  if (sessionId && storedState.couple) unlockReading('STRIPE', sessionId);
});

function openPaywall() {
  paywall.classList.remove('is-hidden');
  document.querySelector('#vip-code').focus();
}

function closeModal() {
  paywall.classList.add('is-hidden');
}

async function prepareStripeCheckout(couple) {
  stripeButton.textContent = 'Preparando pago...';
  stripeButton.classList.add('is-disabled');
  try {
    stripeCheckoutPromise = fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ couple })
    }).then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || 'No fue posible preparar el pago.');
      stripeButton.textContent = 'Desbloquear por $50 MXN ↗';
      stripeButton.classList.remove('is-disabled');
      return data.url;
    });
    await stripeCheckoutPromise;
  } catch (error) {
    stripeButton.textContent = error.message;
    stripeButton.classList.remove('is-disabled');
  }
}

function unlockReading(source, sessionId) {
  closeModal();
  const couple = storedState.couple;
  const names = `${couple.nameOne} & ${couple.nameTwo}`;
  document.querySelector('#reading-names').textContent = names;
  document.querySelector('#score').textContent = couple.compatibility.score;
  document.querySelector('#reading-combination').textContent = `${couple.elementOne} + ${couple.elementTwo} · ${couple.compatibility.label}`;
  document.querySelector('#reading-copy').textContent = 'Consultando la lectura cosmobiológica...';
  retryReading.classList.add('is-hidden');
  reading.classList.remove('is-hidden');
  reading.scrollIntoView({ behavior: 'smooth', block: 'start' });
  generateAnalysis(couple, sessionId).then((analysis) => {
    document.querySelector('#reading-copy').textContent = analysis.text;
    drawSynastryCard(document.querySelector('#share-card'), { ...couple, mysticalPhrase: analysis.mysticalPhrase });
  }).catch((error) => {
    document.querySelector('#reading-copy').textContent = `No fue posible obtener la lectura de Gemini: ${error.message}`;
    retryReading.classList.remove('is-hidden');
  });
}

function getCompatibility(first, second, relationshipScore) {
  const bases = {
    'Fuego-Fuego': 78, 'Tierra-Tierra': 82, 'Aire-Aire': 80, 'Agua-Agua': 76,
    'Fuego-Aire': 74, 'Aire-Fuego': 74, 'Tierra-Agua': 72, 'Agua-Tierra': 72,
    'Fuego-Tierra': 58, 'Tierra-Fuego': 58, 'Aire-Agua': 56, 'Agua-Aire': 56,
    'Fuego-Agua': 44, 'Agua-Fuego': 44, 'Tierra-Aire': 49, 'Aire-Tierra': 49
  };
  const pair = `${first}-${second}`;
  const friction = ['Fuego-Agua', 'Agua-Fuego', 'Tierra-Aire', 'Aire-Tierra'].includes(pair);
  const relationshipRanges = { 1: [35, 45], 3: [46, 55], 5: [60, 72], 7: [78, 88], 9: [89, 95] };
  let score = relationshipScore ? Math.round((relationshipRanges[relationshipScore][0] + relationshipRanges[relationshipScore][1]) / 2) : bases[pair] || 50;
  score = relationshipScore ? Math.max(relationshipRanges[relationshipScore][0], Math.min(relationshipRanges[relationshipScore][1], score + (friction ? -3 : 3))) : friction ? Math.max(35, Math.min(58, score)) : Math.max(35, Math.min(98, score));
  return { score, label: friction ? 'Desafío Alquímico de Alta Fricción' : score >= 78 ? 'Resonancia de Afinidad' : 'Alquimia en Construcción' };
}

function getZodiacInfo(dateValue) {
  const parts = dateValue.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return null;
  const [, month, day] = parts;
  const zodiacSigns = [
    { sign: 'Capricornio', element: 'Tierra', start: [1, 1], end: [1, 19] },
    { sign: 'Acuario', element: 'Aire', start: [1, 20], end: [2, 18] },
    { sign: 'Piscis', element: 'Agua', start: [2, 19], end: [3, 20] },
    { sign: 'Aries', element: 'Fuego', start: [3, 21], end: [4, 19] },
    { sign: 'Tauro', element: 'Tierra', start: [4, 20], end: [5, 20] },
    { sign: 'Géminis', element: 'Aire', start: [5, 21], end: [6, 20] },
    { sign: 'Cáncer', element: 'Agua', start: [6, 21], end: [7, 22] },
    { sign: 'Leo', element: 'Fuego', start: [7, 23], end: [8, 22] },
    { sign: 'Virgo', element: 'Tierra', start: [8, 23], end: [9, 22] },
    { sign: 'Libra', element: 'Aire', start: [9, 23], end: [10, 22] },
    { sign: 'Escorpio', element: 'Agua', start: [10, 23], end: [11, 21] },
    { sign: 'Sagitario', element: 'Fuego', start: [11, 22], end: [12, 21] }
  ];
  const dateNumber = month * 100 + day;
  const sign = zodiacSigns.find((zodiac) => {
    const start = zodiac.start[0] * 100 + zodiac.start[1];
    const end = zodiac.end[0] * 100 + zodiac.end[1];
    return start <= end ? dateNumber >= start && dateNumber <= end : dateNumber >= start || dateNumber <= end;
  });
  return sign || { sign: 'Capricornio', element: 'Tierra' };
}

async function generateAnalysis(couple, sessionId) {
  const promptGenerado = SYSTEM_PROMPT_MASTER({
    nombre1: couple.nameOne,
    signo1: couple.signOne,
    elemento1: couple.elementOne,
    nombre2: couple.nameTwo,
    signo2: couple.signTwo,
    elemento2: couple.elementTwo,
    estadoVinculo: couple.relationshipState,
    puntuacion: couple.relationshipScore
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const slowNoticeId = setTimeout(() => {
    document.querySelector('#reading-copy').textContent = 'Esto puede tardar hasta un minuto si el servidor estaba inactivo...';
  }, SLOW_READING_NOTICE_MS);

  try {
    const response = await fetch('/api/generate-synastry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptGenerado, session_id: sessionId || localStorage.getItem('kali-stripe-session-id') }),
      signal: controller.signal
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `El backend de Gemini respondió con HTTP ${response.status}.`);
    }

    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text) throw new Error('Gemini no devolvió contenido utilizable.');
    return { text, mysticalPhrase: extractCanvasPhrase(text) };
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'La lectura tardó demasiado. Inténtalo de nuevo.'
      : error.message || 'No fue posible conectar con el servidor.';
    console.warn('Error generando la lectura:', error);
    throw new Error(message);
  } finally {
    clearTimeout(timeoutId);
    clearTimeout(slowNoticeId);
  }
}

function extractCanvasPhrase(text) {
  const match = text.match(/(?:FRASE_CANVAS|FRASE MÍSTICA):\s*(.+)/i);
  return match
    ? match[1].trim().replace(/^[-*"“”]+|[-*"“”]+$/g, '')
    : '';
}
