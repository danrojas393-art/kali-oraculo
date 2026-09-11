require('dotenv').config();

const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
const GEMINI_FALLBACK_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;
const GEMINI_CURRENT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

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

    console.log('Iniciando llamada a Gemini...');
    const requestOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7
        }
      })
    };

    let response = await fetch(GEMINI_URL, requestOptions);
    if (response.status === 404) {
      console.log('gemini-1.5-flash no está disponible; intentando gemini-1.5-pro...');
      response = await fetch(GEMINI_FALLBACK_URL, requestOptions);
    }
    if (response.status === 404) {
      console.log('gemini-1.5-pro no está disponible; intentando gemini-3.6-flash...');
      response = await fetch(GEMINI_CURRENT_URL, requestOptions);
    }

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Error en la API de Gemini.' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return res.json({ text });
  } catch (error) {
    console.error('Error en servidor Gemini:', error);
    return res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Kali Oráculo backend disponible en http://localhost:${PORT}`);
});
