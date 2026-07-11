# Instrucciones Previas al Desarrollo — RELEVO + TIZA

> **IMPORTANTE**: Este documento corrige una versión anterior que era demasiado absolutista. La verdad: **puedes empezar a desarrollar HOY sin prácticamente nada de esto**. Pero hay tres momentos donde ciertas cosas se vuelven bloqueantes reales. Este checklist te dice exactamente qué necesitas y **cuándo** lo necesitas.

---

## ⚡ Fast-Track Actual

Ya cuentas con recursos existentes que eliminan varias tareas de la semana 1:

| Recurso | Estado | Impacto |
|---------|:------:|---------|
| Dominio `milo-apps.com` | ✅ Listo | No necesitas comprar `tiza.app` ni `relevo.cl` todavía. Los subdominios wildcard se montan sobre este dominio. |
| Cuenta AWS personal | ✅ Listo | No necesitas crear cuenta nueva. Usa IAM con mínimo privilegio. |
| Cuenta GitHub personal | ✅ Listo | No necesitas crear org. Crea el repo `relevo-tiza` bajo tu cuenta. |
| Gemini API Key | ✅ Listo | El pipeline de IA tiene motor desde el día 1. |

### Ajuste de subdominios

```
Antes (dominios propios):         Ahora (milo-apps.com):
  colegio.tiza.app                  colegio-tiza.milo-apps.com
  colegio.relevo.cl                 colegio-relevo.milo-apps.com
  api.tiza.app                      api.milo-apps.com
```

La arquitectura de wildcard subdomain, NextAuth cross-domain, y brand resolution funciona exactamente igual. Solo cambia el string del dominio base. Cuando compres `tiza.app` y `relevo.cl` más adelante, migrar es cuestión de cambiar una variable de entorno.

### 👥 Equipo Actual

| Persona | Rol | Qué cubre |
|--------|-----|-----------|
| **Emilio Andrich** (tú) | Tech Lead / Desarrollador | Arquitectura, código, orquestación del Dream Team (12 agentes IA) |
| **Iris Vargas** | Profesora de Lenguaje | Validación pedagógica, rúbricas, taxonomía de habilidades, feedback de usabilidad real |
| **Carolina Ramos** | Post-venta / RRHH | Customer Success, onboarding de colegios, soporte a profesores, contrataciones futuras |
| **Camila León** | Ventas / Finanzas | Venta B2B a sostenedores, pricing, Stripe, modelo financiero |
| **Antonio Vargas** | Inversionista Inicial | Capital pre-seed, red de contactos, estrategia, gobierno corporativo |

> **Esto elimina varios riesgos del plan original**: Iris como profesora real en el equipo reemplaza la necesidad de "teacher advisors" externos. Camila como dueña de ventas desde el día 1 te libera para concentrarte en desarrollo. Antonio provee capital inicial — no hay urgencia por levantar Series A. 📖 Ver documento completo: [08-equipo.md](./08-equipo-minimo.md)

---

## 🧠 El modelo mental correcto

```
DESARROLLO INICIAL (semanas 1-4):     Casi nada es bloqueante.
                                       Escribe código. Usa datos sintéticos. 
                                       Todo en localhost con subdominios en milo-apps.com.
                                       El equipo avanza en paralelo en lo suyo.

VALIDACIÓN CON DATOS (semanas 5-8):   Necesitas consentimientos + colegios piloto.
                                       Aquí procesas evaluaciones reales.

PRODUCCIÓN / COBRO (semanas 9+):      Necesitas todo lo legal y corporativo.
                                       SpA, contratos, seguros, Stripe live.
```

**Regla de oro**: Lo legal no frena el desarrollo. Frena la puesta en producción con datos reales de terceros. Tienes ~8 semanas para construir mientras los trámites y el resto del equipo avanzan en paralelo.

---

## 📋 Checklist Maestro por Momento de Bloqueo

### 🟢 PUEDES EMPEZAR HOY — Ya tienes todo o no necesitas nada

| Área | ¿Se puede ya? | Con qué |
|------|:---:|---------|
| Scaffold monorepo (Turborepo + Next.js + FastAPI) | ✅ | `npx create-turbo` |
| Frontends TIZA + RELEVO (datos mock) | ✅ | JSON estático, MSW |
| Backend FastAPI con brand resolution | ✅ | `localhost:8000` |
| Base de datos PostgreSQL + Prisma | ✅ | Docker local |
| Pipeline OCR + LLM (datos sintéticos) | ✅ | Tus propias evaluaciones falsas manuscritas |
| Auth con NextAuth (usuarios mock) | ✅ | Credenciales falsas |
| Feature flags por brand | ✅ | `packages/config` |
| Docker Compose de desarrollo | ✅ | Todo local |
| CI/CD (GitHub Actions) | ✅ | Build + test, sin deploy |
| Flujo de creación de evaluación → PDF con QR | ✅ | Totalmente offline |
| Gemini API (fallback del pipeline) | ✅ | Ya tienes API key |
| AWS S3/SQS/KMS | ✅ | Ya tienes cuenta, crea recursos bajo `milo-*` |
| Subdominios wildcard | ✅ | `*.milo-apps.com` en Route53 |
| GitHub repo | ✅ | Crea `relevo-tiza` bajo tu cuenta personal |
| Validación pedagógica | ✅ | Iris en el equipo — no necesitas buscar "teacher advisors" externos |
| Capital inicial | ✅ | Antonio — no necesitas levantar pre-seed desde cero |

**Para esto necesitas CERO trámites. Solo tu computador y recursos que ya tienes.**

---

### 🟢 YA HECHO — Tachado del checklist

| # | Tarea | Estado |
|---|-------|:------:|
| D1 | Dominio disponible (`milo-apps.com`) | ✅ |
| D2 | Cuenta AWS | ✅ |
| D3 | GitHub | ✅ |
| D4 | Gemini API Key | ✅ |
| D5 | Equipo base formado (5 personas) | ✅ |
| D6 | Capital pre-seed disponible | ✅ |

---

### 🟡 HACER EN LA SEMANA 1 — Configuraciones rápidas (Emilio)

| # | Tarea | Tiempo | Sin esto… |
|---|-------|--------|-----------|
| C1 | **Configurar Route53** — crear hosted zone `milo-apps.com`, registro wildcard `*.milo-apps.com` → CloudFront | 30 min | Los subdominios no resuelven |
| C2 | **Crear IAM user `tiza-dev`** con política de mínimo privilegio (S3, SQS, KMS, RDS) | 15 min | El backend no puede conectarse a AWS |
| C3 | **Crear repo GitHub** `relevo-tiza` bajo tu cuenta personal | 5 min | No hay control de versiones |
| C4 | **Crear buckets S3** — `milo-tiza-evaluaciones-dev`, `milo-tiza-reportes-dev`, `milo-tiza-crops-dev` | 10 min | Pipeline IA no tiene dónde leer/escribir |
| C5 | **Crear cola SQS** `milo-tiza-processing-queue` | 5 min | Workers no reciben trabajos |
| C6 | **Configurar KMS key** `milo-tiza-encryption` para pgcrypto | 5 min | Datos sensibles sin cifrar en BD |

> 📖 Ver detalles en: [02-infraestructura-cloud.md](./02-infraestructura-cloud.md) y [03-apis-y-servicios.md](./03-apis-y-servicios.md)

### 🟡 EN PARALELO — Tareas del equipo (semanas 1-4)

Mientras Emilio desarrolla con el Dream Team, el resto del equipo avanza:

| # | Tarea | Responsable | Entregable |
|---|-------|-------------|------------|
| E1 | Definir rúbricas de Lenguaje + taxonomía de habilidades cognitivas | **Iris** | 10+ rúbricas validadas, documento de taxonomía |
| E2 | Identificar 5 colegios piloto, preparar pitch deck de ventas | **Camila** | Lista de colegios, deck, pricing definido |
| E3 | Diseñar proceso de onboarding de colegios + guías para profesores | **Carolina** | Manual de onboarding, guía rápida TIZA |
| E4 | Preparar documentación legal (estatutos SpA, matriz consentimiento) | **Antonio** (+ abogado) | Estatutos listos, borrador de consentimiento granular |
| E5 | Crear evaluaciones sintéticas manuscritas para entrenar pipeline IA | **Iris** | 20+ evaluaciones de ejemplo (Lenguaje, distintos niveles) |

---

### 🔴 NECESITAS ANTES DE LA SEMANA 6-8 — Validación con datos reales

Esto es lo que **realmente bloquea**. Sin estos items, no puedes procesar una sola evaluación real de un alumno sin estar infringiendo la ley:

| # | Tarea | Responsable | Bloquea… | Sin esto… |
|---|-------|-------------|----------|-----------|
| V1 | **Recolectar consentimientos de apoderados** | Camila + colegios | Procesar evaluaciones reales | Procesar datos de menores sin consentimiento = ilegal. Multa: hasta 500 UTM (~$32M CLP) por evento |
| V2 | **Constituir Relevo SpA** | Antonio + abogado | Firmar contratos con colegios | Sin persona jurídica, el equipo responde con patrimonio personal |
| V3 | **Firmar acuerdos de piloto con colegios** | Camila | Acceder a evaluaciones reales | Sin contrato, los colegios no te entregan datos |
| V4 | **Ejecutar DPIA** | Antonio + DPO | Procesamiento masivo de datos sensibles | Obligatorio por Ley 19.628 para tratamientos de alto riesgo (menores + IA) |
| V5 | **Contratar DPO externo** | Antonio + Carolina | Cumplimiento continuo | La DPIA la coordina el DPO. Sin DPO, no hay quien certifique cumplimiento |
| V6 | **Firmar DPA con Google Cloud** | Antonio + abogado | Usar Gemini API con datos reales | Sin DPA, los datos de menores van a servidores de Google sin garantías contractuales |

> 📖 Ver detalles en: [01-legal-corporativo.md](./01-legal-corporativo.md) y [04-alianzas-piloto.md](./04-alianzas-piloto.md)

---

### 🔵 NECESITAS ANTES DE PRODUCCIÓN — Cobro y escala (semanas 9+)

Estas cosas no bloquean el desarrollo ni la validación. Bloquean **cobrar y escalar**:

| # | Tarea | Responsable | Bloquea… |
|---|-------|-------------|----------|
| P1 | Abrir cuenta bancaria empresarial | Camila | Recibir pagos de colegios |
| P2 | Configurar Stripe en vivo | Camila | Cobrar suscripciones |
| P3 | Contratar Seguro RC Profesional | Camila + Antonio | Dormir tranquilo (una demanda sin seguro = fin del proyecto) |
| P4 | Redactar contratos SaaS B2B | Antonio + abogado | Cerrar ventas con colegios fuera del piloto |
| P5 | **Comprar `tiza.app` + `relevo.cl`** | Emilio | Migrar de `milo-apps.com` a los dominios definitivos. Mientras tanto `milo-apps.com` funciona perfecto. |
| P6 | Registrar marcas en INAPI | Antonio + abogado | Proteger las marcas RELEVO + TIZA (puedes usar "MR" desde el día 1 de presentación) |
| P7 | Comprar escáneres para el piloto | Emilio | Los profesores no pueden escanear sin hardware |
| P8 | Probar flujo escáner → SFTP → S3 | Emilio | El pipeline de producción no funciona sin este flujo físico validado |

> 📖 Ver detalles en: [05-hardware-escaneres.md](./05-hardware-escaneres.md) y [06-financiero.md](./06-financiero.md)

---

### ⬜ Tareas SIN fecha crítica — Hacer cuando puedas

Estas tareas son importantes pero no bloquean nada en el corto plazo:

| # | Tarea | Responsable | Prioridad |
|---|-------|-------------|-----------|
| 7.1 | Recolectar evaluaciones reales anonimizadas (para calibrar IA) | Iris + Emilio | 🟡 Durante el piloto |
| 7.2 | Etiquetar ground truth (transcripción manual) | Iris | 🟡 Se puede empezar con datos sintéticos |
| 7.3 | Preparar rúbricas de ejemplo | Iris (ya en progreso) | 🟢 Semanas 1-4 |
| 7.4 | Definir taxonomía de habilidades cognitivas | Iris (ya en progreso) | 🟢 Semanas 1-4 |
| 8.1 | Definir roles a contratar (mes 6+) | Carolina + Emilio | 🟢 Antes de escalar a 40 colegios |
| 8.2 | Reclutar MLOps Engineer | Carolina | 🟡 Antes del fine-tuning de modelos (mes 4+) |
| 3.4 | Crear proyecto Sentry | Emilio | 🟢 Se puede agregar en cualquier momento |
| 6.4 | Preparar modelo financiero 3 años | Camila + Antonio | 🟢 Para levantar capital, no para desarrollar |

---

## 🗺️ Plan de Ejecución en Paralelo

```
┌─────────────────────────────────────────────────────────────────┐
│  SEMANA 1-4: DESARROLLO INICIAL (arrancas HOY)                   │
│                                                                   │
│  🖥️  DESARROLLO (Emilio + Dream Team)                             │
│     • Scaffold monorepo Turborepo                                 │
│     • Frontends TIZA + RELEVO con datos mock                      │
│     • Backend FastAPI con brand resolution                        │
│     • Pipeline IA con datos sintéticos (Iris escribe a mano)      │
│     • Auth + feature flags + DB schema                            │
│     • Subdominios: colegio-tiza.milo-apps.com / colegio-relevo   │
│                                                                   │
│  ⚡ CONFIGURACIONES RÁPIDAS (Emilio, ~2 horas total)              │
│     • Route53 wildcard *.milo-apps.com                            │
│     • IAM user tiza-dev                                           │
│     • GitHub repo relevo-tiza                                     │
│     • S3 buckets + SQS queue + KMS key                            │
│     • Variables de entorno con prefijo milo-*                     │
│                                                                   │
│  👥 EQUIPO (en paralelo al desarrollo)                            │
│     • Iris: rúbricas + taxonomía + evaluaciones sintéticas       │
│     • Camila: identificar colegios piloto + pitch deck           │
│     • Carolina: diseñar onboarding + guías para profesores       │
│     • Antonio + abogado: estatutos SpA + consentimientos         │
├─────────────────────────────────────────────────────────────────┤
│  SEMANA 5-8: CONVERGENCIA DESARROLLO + DATOS REALES               │
│                                                                   │
│  🖥️  DESARROLLO (Emilio + Dream Team)                             │
│     • Deploy staging a AWS (bajo milo-apps.com)                   │
│     • Conectar pipeline IA a S3/SQS reales                        │
│     • Profesores del piloto usan TIZA con datos reales            │
│                                                                   │
│  📋 BLOQUEANTES LEGALES (deben estar listos)                      │
│     • Relevo SpA constituida ✅ (Antonio + abogado)               │
│     • DPO contratado ✅ (Carolina)                                 │
│     • DPIA ejecutada ✅ (Antonio)                                  │
│     • DPA con Google Cloud firmado ✅ (Antonio)                    │
│     • Consentimientos de apoderados recolectados ✅ (Camila)      │
│     • Acuerdos de piloto firmados con 5 colegios ✅ (Camila)     │
│     • Escáneres comprados e instalados ✅ (Emilio)                │
│                                                                   │
│  🔬 VALIDACIÓN REAL (todo el equipo)                              │
│     • Iris: acompañar a profesores del piloto, feedback UX       │
│     • Carolina: onboardear colegios, soporte diario              │
│     • Camila: cerrar 15 colegios adicionales                     │
│     • Emilio + Dream Team: bugs, iteraciones, ajustes IA        │
│     • Procesar primeras evaluaciones reales                       │
│     • Medir CER en letra de niños chilenos                        │
├─────────────────────────────────────────────────────────────────┤
│  SEMANA 9+: PRODUCCIÓN Y COBRO                                    │
│                                                                   │
│  • Comprar tiza.app + relevo.cl (Emilio, migrar desde milo)      │
│  • Contratos SaaS B2B firmados (Camila)                           │
│  • Seguro RC Profesional contratado (Camila + Antonio)           │
│  • Stripe en vivo (Camila)                                        │
│  • Escalar a 15 → 40 → 80 colegios (todo el equipo)             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Ajuste Técnico: Variables de Entorno con `milo-apps.com`

Mientras uses tu dominio `milo-apps.com`, las variables de entorno relevantes cambian así:

```bash
# ─── Antes (dominios definitivos, futuro) ─────────────────
# NEXTAUTH_URL_TIZA=http://localhost:3001
# NEXT_PUBLIC_TIZA_URL=https://tiza.app
# NEXT_PUBLIC_RELEVO_URL=https://relevo.cl

# ─── Ahora (milo-apps.com, desarrollo real) ────────────────
NEXTAUTH_URL_TIZA=https://colegio-tiza.milo-apps.com
NEXTAUTH_URL_RELEVO=https://colegio-relevo.milo-apps.com
NEXT_PUBLIC_TIZA_URL=https://tiza.milo-apps.com
NEXT_PUBLIC_RELEVO_URL=https://relevo.milo-apps.com

# ─── AWS (prefijo milo-*) ──────────────────────────────────
S3_EVALUATIONS_BUCKET=milo-tiza-evaluaciones-dev
S3_REPORTS_BUCKET=milo-tiza-reportes-dev
S3_CROPS_BUCKET=milo-tiza-crops-dev
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/XXX/milo-tiza-processing-queue
KMS_KEY_ARN=arn:aws:kms:us-east-1:XXX:key/milo-tiza-encryption

# ─── Email (milo-apps.com) ─────────────────────────────────
EMAIL_FROM_TIZA=noreply@milo-apps.com
EMAIL_FROM_RELEVO=noreply@milo-apps.com
```

Cuando compres los dominios definitivos, migrar es cambiar estas variables. Nada de código.

---

## ⛔ Las 3 preguntas que definen si puedes avanzar

Antes de cada fase, hazte estas tres preguntas. Si la respuesta es **NO** a alguna, esa fase está bloqueada:

### Para empezar a desarrollar (HOY)
1. ¿Tienes un computador con Docker y Node.js? → **SÍ = empieza hoy**
2. ¿Tienes `milo-apps.com` con wildcard DNS? → **SÍ = puedes testear subdominios**
3. ¿Tienes Gemini API Key? → **SÍ = el pipeline IA funciona**

### Para validar con datos reales (Semana 6)
1. ¿Relevo SpA está constituida? → **SÍ = puedes firmar contratos**
2. ¿Tienes consentimientos firmados de apoderados? → **SÍ = puedes procesar evaluaciones**
3. ¿La DPIA está ejecutada? → **SÍ = cumples con Ley 19.628**

### Para producción y cobro (Semana 9)
1. ¿Tienes cuenta bancaria empresarial? → **SÍ = puedes recibir pagos**
2. ¿Tienes seguro RC Profesional? → **SÍ = estás protegido**
3. ¿Los escáneres están instalados en los colegios? → **SÍ = los profesores pueden usar TIZA**

---

## 📊 Resumen visual de dependencias

```
                    HOY             Semana 6            Semana 9
                     │                  │                   │
  milo-apps.com ─────┤ (ya lo tienes)   │                   │
  AWS Account ───────┤ (ya lo tienes)   │                   │
  Gemini API Key ────┤ (ya lo tienes)   │                   │
  GitHub ────────────┤ (ya lo tienes)   │                   │
  Equipo 5 personas ─┤ (ya formado)     │                   │
  Capital pre-seed ──┤ (Antonio)        │                   │
                     │                  │                   │
  IAM + S3 + SQS ────┤ (1 hora)         │                   │
  Route53 wildcard ──┤ (30 min)          │                   │
  Rúbricas (Iris) ───┤ (semanas 1-4)    │                   │
  Pitch deck (Camila)─┤ (semanas 1-4)    │                   │
  Onboarding (Carol)─┤ (semanas 1-4)    │                   │
                     │                  │                   │
  Relevo SpA ────────┼──────────────────┤                   │
  DPO ───────────────┼──────────────────┤                   │
  DPIA ──────────────┼──────────────────┤                   │
  DPA Google ────────┼──────────────────┤                   │
  Consentimientos ───┼──────────────────┤                   │
  Acuerdos piloto ───┼──────────────────┤                   │
  Escáneres ─────────┼──────────────────┤                   │
                     │                  │                   │
  tiza.app/relevo.cl─┼──────────────────┼───────────────────┤
  Cta bancaria ──────┼──────────────────┼───────────────────┤
  Stripe live ───────┼──────────────────┼───────────────────┤
  Seguro RC ─────────┼──────────────────┼───────────────────┤
  Contratos SaaS ────┼──────────────────┼───────────────────┤
  Marcas INAPI ──────┼──────────────────┼───────────────────┤
                     │                  │                   │
             ┌───────┴──────┐  ┌────────┴──────┐  ┌────────┴──────┐
             │  DESARROLLO  │  │   VALIDACIÓN  │  │  PRODUCCIÓN   │
             │  (datos mock)│  │  (datos real) │  │  (cobro real) │
             └──────────────┘  └───────────────┘  └───────────────┘
```

---

## 📞 ¿Dudas?

Cada documento en esta carpeta tiene instrucciones detalladas paso a paso. Si necesitas saber exactamente cómo hacer algo, está ahí:

| Documento | Para cuándo |
|-----------|-------------|
| [02-infraestructura-cloud.md](./02-infraestructura-cloud.md) | Esta semana (configuraciones rápidas) |
| [03-apis-y-servicios.md](./03-apis-y-servicios.md) | Ya hecho en su mayoría |
| [07-datos-ia.md](./07-datos-ia.md) | Semana 1-4 (datos sintéticos con Iris) |
| [01-legal-corporativo.md](./01-legal-corporativo.md) | Semana 1-6 (Antonio + abogado, en paralelo) |
| [04-alianzas-piloto.md](./04-alianzas-piloto.md) | Semana 1-6 (Camila lidera) |
| [05-hardware-escaneres.md](./05-hardware-escaneres.md) | Semana 6-8 (Emilio) |
| [06-financiero.md](./06-financiero.md) | Semana 4-8 (Camila + Antonio) |
| [08-equipo.md](./08-equipo-minimo.md) | Ya formado — leer para entender roles, dinámica y plan de contrataciones futuras |

---

*"Un equipo de cinco con roles claros y agentes de IA como fuerza multiplicadora no es una startup de un solo founder. Es una startup con superpoderes."* — Titan
