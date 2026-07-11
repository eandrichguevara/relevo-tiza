# 03 — APIs y Servicios Externos

> **Tiempo estimado**: 1-3 días (creación de cuentas y obtención de claves)
> **Costo estimado**: $0-50 USD/mes en etapa de desarrollo
> **Bloqueante**: 🔴 Parcial — Gemini API Key es BLOQUEANTE, el resto Alto/Medio

---

## 3.1 Obtener Gemini API Key

### Qué es
Clave de API para acceder a los modelos de Google (Gemini Flash, Gemini Pro) desde el backend FastAPI.

### Paso a paso
1. Ir a [Google AI Studio](https://aistudio.google.com)
2. Iniciar sesión con cuenta Google (recomendado: cuenta empresarial, no personal)
3. En menú lateral → "Get API Key"
4. Clic en "Create API Key"
5. Elegir proyecto de Google Cloud (crear uno nuevo: `relevo-tiza-prod`)
6. Copiar API key (formato: `AIza...`)

### Cuota gratuita
- Gemini 2.0 Flash: 1,500 requests/día (gratis)
- Gemini 2.5 Pro: 50 requests/día (gratis)
- **Para desarrollo es más que suficiente**

### Cuándo pagar
- Cuando el piloto supere 1,500 evaluaciones/día → activar billing en Google Cloud
- Plan "Pay-as-you-go": ~$0.00002 por 1K tokens (Flash), ~$0.00125 por 1K tokens (Pro)
- Batch API (procesamiento asíncrono): **50% de descuento** sobre el precio estándar

### ⚠️ Importante: Configuraciones de Seguridad

Al usar Gemini API, configura EXPLÍCITAMENTE:
- **Context Caching**: DESHABILITADO (riesgo de cross-tenant data leakage)
- **No usar datos para entrenamiento**: Contrato DPA con Google Cloud (ver sección legal 1.10)
- **Cifrado en tránsito**: Gemini API solo acepta TLS 1.3 (verificar que tu SDK use HTTPS)
- **Límite de tokens por request**: Configurar máximo 8192 tokens para evitar costos inesperados

### Costo de API para 10K evaluaciones/mes (volumen piloto estimado)

| Modelo | Tokens/eval | Costo/1K tokens | Costo/10K evals |
|--------|-------------|-----------------|-----------------|
| Gemini Flash (estándar) | ~2,000 | $0.00002 | ~$0.40 |
| Gemini Pro (batch) | ~2,000 | $0.000625 | ~$12.50 |
| **Total batch (90% Flash + 10% Pro)** | | | **~$1.60** |

> El costo de API es insignificante en etapa temprana. La GPU local y el pipeline híbrido son para control, no para ahorro.

### Por qué es BLOQUEANTE
Sin Gemini API Key:

1. No puedes procesar evaluaciones (el pipeline híbrido usa Gemini como fallback)
2. No puedes hacer OCR de respuestas manuscritas por niños (Gemini es el único que da calidad aceptable sin fine-tuning)
3. No puedes validar que el flujo funciona end-to-end

---

## 3.2 Crear Cuenta Stripe + API Keys

### Qué es
Stripe es la pasarela de pago para cobrar a los colegios (RELEVO B2B).

### Paso a paso
1. Ir a [Stripe](https://stripe.com)
2. Crear cuenta → elegir Chile como país
3. Verificar identidad (RUT empresa, cédula representante legal)
4. Completar perfil de negocio

### Modo Test (desarrollo)
1. Dashboard → Developers → API Keys
2. Copiar `Publishable Key` (`pk_test_...`) → frontend
3. Copiar `Secret Key` (`sk_test_...`) → backend
4. Usar tarjetas de prueba: `4242 4242 4242 4242`

### Modo Live (producción)
- Activar cuenta después de verificación
- Se genera `pk_live_...` y `sk_live_...`
- **NO activar live hasta tener 5+ colegios listos para pagar**

### Productos/Precios a crear

| Producto | Precio | Descripción |
|----------|--------|-------------|
| RELEVO Small | $3,000 USD/año | < 300 estudiantes |
| RELEVO Medium | $4,000 USD/año | 300-800 estudiantes |
| RELEVO Large | $5,000 USD/año | 800+ estudiantes |

### Webhook
1. Crear endpoint: `https://api.tiza.app/webhooks/stripe`
2. Eventos a escuchar: `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`
3. Para desarrollo local: usar [Stripe CLI](https://stripe.com/docs/stripe-cli) + `stripe listen --forward-to localhost:8000/webhook`

### Costo
- Stripe: 2.9% + $0.30 por transacción (precios Chile)
- Cuenta: gratuita

---

## 3.3 Crear Cuenta de Email (Resend / SendGrid)

### Qué es
Servicio de email transaccional para enviar reportes, notificaciones y emails de sistema.

### Recomendación: Resend
- Más simple que SendGrid
- SDK moderno para Node.js y Python
- 100 emails/día gratis
- Plan Pro: $20/mes por 50,000 emails

### Paso a paso (Resend)
1. Ir a [Resend](https://resend.com)
2. Crear cuenta
3. Verificar dominio (tiza.app + relevo.cl)
   - Agregar registros DNS (DKIM, SPF, DMARC)
   - Tiempo de verificación: 5-30 minutos
4. Obtener API Key (`re_...`)
5. Configurar en `.env`: `EMAIL_API_KEY=re_...`

### Configuración DNS necesaria

```
# SPF
TXT  tiza.app  "v=spf1 include:spf.resend.com ~all"

# DKIM
CNAME  resend._domainkey.tiza.app  resend.dkim.tiza.app

# DMARC
TXT  _dmarc.tiza.app  "v=DMARC1; p=quarantine; rua=mailto:dmarc@tiza.app"
```

### Remitentes a configurar
- `noreply@tiza.app` — Emails a profesores (reportes, notificaciones)
- `noreply@relevo.cl` — Emails a sostenedores (facturación, alertas)

### Plantillas de email necesarias (para desarrollo)
1. Bienvenida a TIZA (profesor)
2. Reporte de evaluación listo (profesor)
3. Alerta: evaluación requiere revisión manual (profesor)
4. Bienvenida a RELEVO (sostenedor)
5. Factura disponible (sostenedor)
6. Resumen semanal de analíticas (sostenedor)

---

## 3.4 Crear Proyecto Sentry + DSN

### Qué es
Sentry es una plataforma de monitoreo de errores. Captura excepciones en frontend y backend.

### Paso a paso
1. Ir a [Sentry.io](https://sentry.io)
2. Crear cuenta → Create Project
3. Elegir plataforma: Next.js (para frontend) + Python/FastAPI (para backend)
4. Copiar DSN (`https://abc123@o123456.ingest.sentry.io/...`)

### Proyectos a crear
| Proyecto | Plataforma | DSN |
|----------|------------|-----|
| `tiza-web` | Next.js | `NEXT_PUBLIC_SENTRY_DSN` |
| `relevo-web` | Next.js | `NEXT_PUBLIC_SENTRY_DSN` |
| `tiza-api` | Python/FastAPI | `SENTRY_DSN` |

### Configuración
- **Desarrollo**: `SENTRY_TRACES_SAMPLE_RATE=1.0` (capturar todo)
- **Producción**: `SENTRY_TRACES_SAMPLE_RATE=0.1` (10% para no saturar)

### Costo
- Plan Developer: gratuito (5K eventos/mes, 1 proyecto)
- Plan Team: $26/mes (50K eventos/mes)
- Para empezar: plan gratuito es suficiente

---

## 3.5 Crear Cuenta GitHub

### Qué es
Repositorio de código fuente. Necesario para CI/CD, code review, y colaboración.

### Paso a paso
1. Ir a [GitHub](https://github.com)
2. Crear cuenta (si no tienes) — recomendado: GitHub Organization `relevo-tiza`
3. Crear repositorio privado: `relevo-tiza`
4. Agregar `.gitignore` (Next.js + Python + Terraform)
5. Configurar branch protection en `main`

### Secrets de GitHub Actions necesarios

| Secreto | Valor |
|---------|-------|
| `AWS_ACCESS_KEY_ID` | Para deploy a AWS |
| `AWS_SECRET_ACCESS_KEY` | Para deploy a AWS |
| `GEMINI_API_KEY` | Para tests del pipeline IA |
| `DATABASE_URL` | Para migraciones |
| `VERCEL_TOKEN` | Para deploy frontend (si usas Vercel) |
| `SENTRY_DSN` | Para releases |
| `SLACK_WEBHOOK` | Notificaciones de deploy |

### Costo
- GitHub: gratuito (repos privados ilimitados, 2,000 min/mes Actions)

---

## 📊 Resumen de APIs a Obtener

| # | Servicio | Dónde | Key/ID | Prioridad |
|---|----------|-------|--------|-----------|
| 1 | Gemini API | [aistudio.google.com](https://aistudio.google.com) | `AIza...` | 🔴 BLOQUEANTE |
| 2 | Stripe | [dashboard.stripe.com](https://dashboard.stripe.com) | `sk_test_...` | 🟡 ALTO |
| 3 | Resend | [resend.com](https://resend.com) | `re_...` | 🟡 ALTO |
| 4 | Sentry | [sentry.io](https://sentry.io) | `https://...@...ingest.sentry.io/...` | 🟢 MEDIO |
| 5 | GitHub | [github.com](https://github.com) | N/A (account) | 🔴 BLOQUEANTE |

---

*"Las APIs son como las especias: pocas, buenas, y bien medidos sus límites de rate."* — Tyrion Lannister
