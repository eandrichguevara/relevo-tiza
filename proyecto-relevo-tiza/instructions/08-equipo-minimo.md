# 08 — Equipo

> **Tiempo estimado**: Ya formado en su núcleo. Contrataciones adicionales a partir del mes 6.
> **Costo estimado**: Variable según estructura de compensación actual
> **Bloqueante**: 🟢 NO — El equipo base ya existe y cubre todas las áreas críticas.

---

## 👥 Equipo Actual (5 personas)

| Nombre | Rol | Área | Qué cubre |
|--------|-----|------|-----------|
| **Emilio Andrich** | Tech Lead / Desarrollador | Desarrollo + Arquitectura | Dueño del código, stack técnico, decisiones de arquitectura, orquestación del Dream Team |
| **Iris Vargas** | Profesora de Lenguaje | Validación Pedagógica | Co-diseño de rúbricas, taxonomía de habilidades, testing de usabilidad real, voz del profesor en el producto |
| **Carolina Ramos** | Post-venta / RRHH | Customer Success + People | Onboarding de colegios, soporte a profesores, contrataciones futuras, cultura de equipo |
| **Camila León** | Ventas / Finanzas | Sales + Finance | Venta B2B a sostenedores, pricing, Stripe, modelo financiero, relación con inversionistas |
| **Antonio Vargas** | Inversionista Inicial | Capital + Estrategia | Pre-seed funding, guidance estratégico, red de contactos, gobierno corporativo |

### Por qué esto es una ventaja enorme

El documento original asumía un **solo founder** haciendo todo. Tu realidad es radicalmente mejor:

| Riesgo original | Con tu equipo |
|-----------------|---------------|
| "Founder burnout" — todo depende de una persona | ❌ Eliminado. Ventas, finanzas, validación pedagógica y CS tienen dueños desde el día 1 |
| "Sin validación pedagógica" — producto construido sin input de profesores | ❌ Eliminado. Iris es profesora real de Lenguaje. La voz del usuario está en el equipo, no es externa |
| "Sin capital" — founder vive de ahorros | ❌ Eliminado. Antonio provee capital inicial. Hay runway sin presión de generar revenue inmediato |
| "Sin dueño de ventas" — el founder vende y codea | ❌ Eliminado. Camila es dueña de ventas. Tú puedes concentrarte en desarrollo |

---

## 🧠 El Dream Team como tu Equipo de Desarrollo

**Emilio, estás solo en desarrollo.** Eso no es un bug — es por diseño. El Dream Team (12 agentes de IA especializados) actúa como tu equipo de ingeniería bajo tu dirección técnica.

| Agente | Rol equivalente | Qué hace por ti |
|--------|-----------------|-----------------|
| **@atlas** | Product Manager | Refina requisitos, define alcance, prioriza funcionalidades |
| **@aria** | Frontend UI/UX | React 19, Next.js, Tailwind, accesibilidad, performance |
| **@nexus** | Frontend State/Testing | Zustand, React Query, Vitest, Playwright |
| **@forge** | Backend APIs | NestJS/Fastify, REST/GraphQL, OpenAPI, auth |
| **@sage** | Backend Data | PostgreSQL, Prisma, migraciones, integraciones |
| **@nomad** | Mobile Developer | React Native (cuando llegue la app móvil en Fase 2) |
| **@spark** | Data/IA Engineer | Pipeline OCR+LLM, embeddings, RAG, fine-tuning |
| **@vault** | DevOps/SRE | Docker, CI/CD, AWS, Terraform, monitoreo |
| **@raven** | QA Manual | Pruebas funcionales, UX, casos borde |
| **@echo** | QA Automation | Tests unitarios, integración, e2e, cobertura |
| **@warden** | Security Engineer | Vulnerabilidades, dependencias, OWASP, compliance |

Tú eres el arquitecto. Ellos son el equipo que construye. Tú tomas decisiones, delegas tareas, revisas output, y aseguras calidad vía los QA y Security Gates.

---

## 🔄 Cómo Trabajan Juntos: Equipo Humano + Dream Team

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE TRABAJO                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Iris ───→ "Necesito que las rúbricas permitan                 │
│  (Pedag.)   evaluar inferencia en textos narrativos"            │
│                │                                                 │
│  Emilio ──→ @atlas: Refina el requerimiento                    │
│  (Tech Lead)  @aria + @nexus: Diseñan UI de rúbricas           │
│               @forge + @sage: Implementan API + schema          │
│               @raven + @echo: QA Gate                           │
│               @warden: Security Gate                             │
│                │                                                 │
│  Iris ───→ "Probé la feature. Funciona pero falta..."          │
│  (Pedag.)   Feedback real de una profesora real                 │
│                │                                                 │
│  Emilio ──→ Itera con el Dream Team basado en feedback          │
│                                                                  │
│  ─────────────────────────────────────────────                  │
│  En paralelo (sin depender del desarrollo):                     │
│                                                                  │
│  Camila ──→ Prepara pitch deck, pricing, modelo financiero     │
│  (Ventas)   Identifica colegios prospecto                       │
│                                                                  │
│  Carolina ─→ Diseña proceso de onboarding de colegios          │
│  (CS/RRHH)   Prepara materiales de capacitación                │
│                                                                  │
│  Antonio ──→ Conexiones con red de colegios/inversionistas     │
│  (Investor)  Validación de modelo de negocio                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Responsabilidades por Fase

### Fase 1: Desarrollo MVP (semanas 1-8)

| Persona | Foco | Entregables |
|---------|------|-------------|
| **Emilio** | Orquestar Dream Team, arquitectura, code review, CI/CD | MVP funcional en staging |
| **Iris** | Definir rúbricas, taxonomía, probar builds, dar feedback UX | 10+ rúbricas validadas, taxonomía de habilidades |
| **Camila** | Identificar 5 colegios piloto, preparar pitch deck, pricing | 5 colegios firmados, deck de ventas |
| **Carolina** | Diseñar proceso de onboarding, preparar guías para profesores | Manual de onboarding, guía rápida TIZA |
| **Antonio** | Proveer capital inicial, abrir puertas a colegios | Pre-seed disponible, 2-3 introducciones a sostenedores |
| **Dream Team** | Construir frontends, backend, pipeline IA, DB schema | Código funcional, tests, documentación |

### Fase 2: Piloto y Validación (semanas 9-16)

| Persona | Foco | Entregables |
|---------|------|-------------|
| **Emilio** | Bugs, iteraciones rápidas, monitoreo, ajustes de pipeline IA | CER < 10%, sistema estable |
| **Iris** | Acompañar a profesores del piloto, recolectar feedback cualitativo | Reporte de usabilidad, NPS cualitativo |
| **Camila** | Cerrar 15 colegios adicionales, negociar contratos | 15+ colegios, primeros contratos SaaS |
| **Carolina** | Onboardear colegios, dar soporte diario a profesores | 90%+ activación de profesores |
| **Antonio** | Preparar para ronda Seed/Series A, modelo financiero | Data room, proyecciones,引入 inversionistas |
| **Dream Team** | Features post-MVP, automatización de onboarding, dashboard RELEVO | Fase 2 complete |

### Fase 3: Escala (mes 6-12)

Aquí sí necesitarán contratar. Ver sección siguiente.

---

## 👥 Contrataciones Futuras (Mes 6+)

Con 40+ colegios y tracción validada, estas son las posiciones a cubrir:

| # | Rol | Cuándo | Salario estimado (CLP) | Quién lidera la búsqueda |
|---|-----|--------|------------------------|--------------------------|
| 1 | **MLOps Engineer** (senior) | Mes 4-6 | $6-8M/mes | Emilio |
| 2 | **Full-stack Developer** ×2 | Mes 6-8 | $3-5M/mes c/u | Emilio + Carolina |
| 3 | **Customer Success** ×2 | Mes 6-8 | $2-3M/mes c/u | Carolina |
| 4 | **Sales Development Rep** | Mes 8-10 | $2-3M/mes + comisión | Camila |
| 5 | **Marketing Manager** | Mes 10-12 | $3-5M/mes | Camila + Antonio |

### ¿Por qué no antes?

- **MLOps Engineer**: El pipeline híbrido inicial lo construye el Dream Team. Cuando necesiten fine-tuning con datos chilenos y GPU dedicada, contrata.
- **Full-stack Devs**: El Dream Team escala horizontalmente (múltiples agentes en paralelo). Contrata devs humanos cuando el producto sea tan complejo que necesites ownership 24/7.
- **CS + Sales**: Carolina y Camila pueden manejar hasta ~30-40 colegios. Después de eso, necesitan delegar.

---

## ⚠️ Riesgos del Equipo Actual

| Riesgo | Mitigación |
|--------|------------|
| **Emilio es single point of failure técnico** | Documentar arquitectura, code review con Dream Team, plan de succession para cuando contrates devs humanos |
| **Iris es solo profesora de Lenguaje** (no Matemáticas) | Buscar un segundo teacher advisor de Matemáticas durante el piloto. Mientras tanto, Iris puede validar estructura de rúbricas para cualquier asignatura |
| **Equipo sin experiencia previa en startups** | Antonio como inversionista aporta esa experiencia. Aprovechar su red y mentoría |
| **Coordinación entre equipo humano y Dream Team** | Ritmo semanal: Iris prueba builds → feedback a Emilio → Emilio delega al Dream Team → siguiente build |

---

## 📊 Comparación: Documento Original vs. Realidad

| Aspecto | Documento Original (Julio 2026) | Realidad (Hoy) |
|---------|--------------------------------|----------------|
| Founder | 1 persona (solo) | 5 personas con roles complementarios |
| Desarrollo | Founder + eventuales contrataciones | Emilio + Dream Team (12 agentes IA) |
| Validación pedagógica | "Teacher advisors" externos a contratar | Iris, profesora de Lenguaje en el equipo |
| Ventas | Founder vende | Camila, dueña de ventas desde día 1 |
| Finanzas | Founder hace modelo | Camila + Antonio |
| Customer Success | Founder da soporte | Carolina, dueña de CS desde día 1 |
| Capital | Sin capital, levantar pre-seed | Antonio, inversionista inicial |
| Riesgo principal | Founder burnout | Single point of failure técnico (Emilio) |

---

*"Un equipo de cinco con roles claros y agentes de IA como fuerza multiplicadora no es una startup de un solo founder. Es una startup con superpoderes."* — Titan
