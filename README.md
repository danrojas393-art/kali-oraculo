# 🔮 Kali Oráculo — Relationship Compatibility & Synastry App

**Kali Oráculo** es una aplicación web full-stack diseñada para generar lecturas astrológicas y cosmobiológicas de compatibilidad de pareja (sinastría) impulsadas por Inteligencia Artificial. Cuenta con un sistema integrado de pasarela de pagos en vivo y persistencia de datos relacional.

---

## 🛠️ Stack Tecnológico

* **Backend:** Node.js, Express.js.
* **Inteligencia Artificial:** Gemini API (`gemini-1.5-flash`).
* **Base de Datos:** PostgreSQL (alojada en Render).
* **Pasarela de Pagos:** Stripe API & Webhooks (`sk_live_`, `whsec_`).
* **Infraestructura & Deploy:** Render (Web Services).
* **Control de Versiones:** Git & GitHub.

---

## 🚀 Características Principales

1. **Generación de Sinastría con IA:** Análisis automatizado de compatibilidad y resonancia cosmobiológica mediante el modelo Gemini API.
2. **Sistema de Monetización con Stripe:**
   * Integración con Stripe Checkout para desbloqueo de lecturas completas.
   * Procesamiento asíncrono y seguro mediante **Webhooks** para confirmación de pagos.
3. **Persistencia en PostgreSQL:** Almacenamiento optimizado de transacciones y registros de lecturas (`lecturas`, `synastry_payments`).
4. **Resiliencia y Rendimiento:**
   * Manejo no bloqueante de consultas a la base de datos (`pool.query`).
   * Timeouts controlados en cliente y servidor para evitar conexiones colgadas y garantizar respuestas fluidas.

---

## ⚙️ Variables de Entorno

Para que el servidor funcione correctamente, es necesario configurar las siguientes variables de entorno en Render (o en un archivo `.env` local):

```env
PORT=10000
DATABASE_URL=postgres://usuario:password@host:port/database
GEMINI_API_KEY=tu_gemini_api_key
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
