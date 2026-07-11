# Estrategia de Negocio — Modelo de Negocio y Go-to-Market

## Resumen Ejecutivo

**Modelo**: Hardware-enabled SaaS con IA variable costs
**Mercado**: Colegios K-12 en Chile (Fase 1), LatAm (Fase 2)
**Pricing**: $3-5K USD/año por colegio
**Unit Economics**: Margen bruto 85-90%

---

## Modelo de Negocio

### RELEVO (B2B — Sostenedor paga)
- **Contrato anual por colegio** — no por estudiante, no por profesor
- **Tiered by school size** (enrollment bands):
  - Small (<300 estudiantes): $3K USD/año
  - Medium (300-800): $4K USD/año
  - Large (800+): $5K USD/año
- **Scanner incluido** — amortizado over 3-year contract. No es line item
- **Qué incluye**: Scanner + RELEVO platform (macrozona dashboards, admin, reports) + TIZA licenses para todos los profesores

### TIZA (B2C — Gratis para profesores)
- **Zero friction**: Download, scan, done
- **PERO**: Solo funciona con RELEVO school account. No standalone
- **Future upsell**: TIZA Pro (personal analytics, export, premium AI models) — $5-8/mo teacher-paid. Optional. Never required.

### Unit Economics

| Costo | Estimado |
|-------|----------|
| Scanner (bulk, 3-yr life) | ~$100/yr |
| Gemini Batch API (per assessment, ~50 pages) | ~$0.02-0.05 |
| Infra/tenant (PostgreSQL schema, storage) | ~$2-5/mo |
| Support/onboarding (founder time) | Your soul |

**Verdict**: Sostenible si attachment rate >60% de profesores activos mensualmente. Debajo de eso, estás comprando scanners para dust collectors.

---

## Estrategia de Venta

### Pitch para Sostenedor (30 segundos)

*"Director, sus profesores pierden 6 horas semanales corrigiendo. Eso son 240 horas al año por docente. RELEVO les devuelve ese tiempo, le da a usted visibilidad en tiempo real de aprendizaje por curso y asignatura, y cumple con los estándares del Ministerio — todo con hardware incluido y sin integraciones complejas. Piloto de 3 meses, sin compromiso anual. ¿Cuándo lo probamos en dos cursos?"*

### Pitch para Profesor (30 segundos)

*"Profe, ¿qué harías con tus domingos si no corrigieras pruebas? TIZA escanea, la IA corrige, tú solo revisas y apruebas. Funciona en tu celular. Gratis. Para siempre. ¿Te doy una demo de 5 minutos?"*

### El Champion
**Jefe de UTP / Coordinador Académico**. No el director (too busy), no el IT guy (no pedagogical authority). The UTP feels the grading pain, owns the curriculum, and influences teachers. Win them, you win the school.

### Objeciones y Respuestas

| Objeción | Realidad | Respuesta |
|----------|----------|-----------|
| *"Muy caro"* | Compared to... what? Photocopies? Coordinator hours? | "Cuesta menos que el café de la sala de profesores. Piloto gratis 3 meses." |
| *"No hay tiempo"* | Teachers make time for what saves time. | "5 minutos setup. Ahorra 6 horas/semana. La matemática es fácil." |
| *"La IA no es confiable"* | True. Hallucination exists. | "Tú apruebas. La IA sugiere. Tú mandas. Siempre." |
| *"Datos de niños"* | Valid. Ley 19.628. | "Schema aislado. Encriptado. En servidores locales si exigen. Auditoría abierta." |
| *"Otro sistema más"* | Integration fatigue real. | "Cero integración MVP. CSV export. Se habla con lo que ya usan." |

---

## Posicionamiento Competitivo

### Mapa de Competencia

| Competidor | Fortaleza | Debilidad | Tu Wedge |
|------------|-----------|-----------|----------|
| **Google Classroom / Microsoft Teams** | Ubicuos, gratis, integrados | No auto-grading, no hardware, no LatAm pedagogy | Motor de evaluación especializado + escáner físico |
| **Plataformas locales (AulaDigital, etc.)** | Ventas locales, lazos con Ministerio | Tech legacy, no IA, caro por estudiante | Stack moderno, batch AI economics, hardware incluido |
| **EdTech AI startups (Gradescope, etc.)** | IA fuerte, enfoque en higher ed | No hardware, pricing US-centric, no pedagogía española | Enfoque K-12, Spanish-first, scanner bundle |
| **Fotocopiadora + corrección manual** | Status quo, zero tech risk | Lento, inconsistente, quema profesores | 10x speed, consistency, data |

### Tu Moat (en orden de durabilidad)
1. **Hardware + Software bundle** — Competidores hacen uno. Tú haces ambos. Procurement ama single-vendor.
2. **Batch AI economics** — Gemini Batch API at scale = ~$0.03/assessment. Nadie iguala esto con hardware incluido.
3. **Alineación pedagógica** — Currículum chileno (o Peru/Colombia/Mex) mapeado a rúbricas. No "AI grading" genérico.
4. **Data gravity** — Schema-per-tenant = datos longitudinales de estudiantes. Year 2: analytics predictivos. Year 3: adaptive learning.

### Tagline de Diferenciación
*"El único sistema que pone el escáner en la sala de profesores y la IA en el bolsillo del profe."*

---

## Escalabilidad

### Internacional (Perú, Colombia, México)
- **Curriculum mapping** = localization cost. No traducción. Mapeo. Contratar un lead pedagógico local por país. $2-3K/mo cada uno.
- **Scanner logistics** — Import duties, warranty, support. Partner con distribuidor local. No enviar desde Chile.
- **Data sovereignty** — Cada país quiere datos locales. Multi-region PostgreSQL (o clusters separados). Presupuestar esto ahora.
- **Sales motion** — Founder no vuela. Contratar country manager después de 3 colegios piloto firmados. No antes.

### Cuello de Botella de Hardware
- **Sí, es un cuello de botella.** Procurement → shipping → installation → training = 6-8 weeks por colegio.
- **Mitigación**:
  - Pre-position inventory in 3PL per country.
  - "Scanner-as-a-service" — swap on failure, no questions.
  - **Largo plazo**: Mobile app scanning (phone camera) para low-stakes/quiz. Reduce dependencia del escáner. Construir esto en Fase 2.

### Escalabilidad de Batch API
- Gemini Batch: 1M tokens/request, 24hr latency SLA. At 10K schools × 500 students × 4 assessments/mo = 20M assessments/mo.
- **Costo a escala**: ~$600K/mo en API calls. Negociar enterprise agreement antes de llegar a 1M assessments.
- **Riesgo**: Google deprecates Batch. Tener fallback: Vertex AI batch, o self-hosted vLLM on GPU cluster. Presupuestar $50K para PoC.

### Expansión de Asignaturas

| Fase | Asignaturas | Complejidad | Timeline |
|------|-------------|-------------|----------|
| MVP | Lenguaje, Matemáticas | Estructurado, rubric-friendly | Mes 0-6 |
| Fase 2 | Ciencias, Historia | Semi-estructurado, open response | Mes 6-12 |
| Fase 3 | Inglés, Artes | Audio, visual, creativo | Mes 12-18 |
| Fase 4 | Todo + Adaptive | Full curriculum graph | Año 2+ |

**Regla**: No añadir asignaturas hasta que teacher NPS > 40 en asignaturas actuales. Calidad > amplitud.

---

## Riesgos Estratégicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Competidor copia bundle** | Alta (12-18 meses) | Alto | Velocidad. Bloquear 50+ colegios ahora. Data moat se profundiza diariamente. ¿Patentear scanner-software handshake? |
| **Rechazo de profesores** | Media | Fatal | Co-diseño con 10 "teacher advisors" — pagarles. Hacer TIZA suyo. NPS dashboard público. |
| **Gemini price spike** | Media | Alto | Multi-model abstraction layer (Gemini + Claude + local). Negociar committed use discounts. |
| **Lawsuit: grading error** | Baja | Existencial | **Terms of Service**: "AI assists, teacher decides." Audit trail: every AI suggestion + teacher override logged. Insurance: EdTech E&O policy ($15K/yr). |
| **Ministry bans AI grading** | Baja | Fatal | Engage Ministry temprano. Piloto con su bendición. "We support teacher judgment, not replace." |
| **Founder burnout** | Cierta | Alto | Hire #2 (ops/sales) at 20 schools. Automate onboarding. Vacation mandatory. |

### El Asesino Silencioso: Adopción Pasiva
Colegios firman, scanners llegan, 20% de profesores lo usan. Sostenedor no renueva. **Fix**: Usage-based renewal trigger. "Si <50% profesores activos, reembolsamos prorateado." Alinea incentivos.

---

## Estrategia de Lanzamiento

### Diseño del Piloto
- **5 colegios** — no 1, no 20. Cinco da pattern recognition.
- **Mix**: 2 públicos, 2 privados subvencionados, 1 privado pagado. Diferentes tamaños (200, 500, 800, 1200, 2000).
- **Duración**: 12 semanas (un semestre). Semanas 1-2: onboarding. Semanas 3-10: live. Semanas 11-12: análisis.
- **Métricas de Éxito (MVP Gate)**:
  1. **Teacher activation**: >70% de profesores invitados escanean ≥1 evaluación/semana por semana 8.
  2. **Time saved**: Self-reported ≥4 hrs/semana (validado vía TIZA analytics).
  3. **Grading consistency**: Inter-rater reliability (AI vs teacher) >0.85 Cohen's kappa.
  4. **Sostenedor satisfaction**: NPS >30. Director recomendaría.
  5. **Zero critical bugs**: No data loss, no grading errors uncorrected.

### Secuencia de Lanzamiento
```
Mes 0-1:  5 colegios piloto (founder onboards personalmente)
Mes 2-3:  Analizar, iterar, construir automatización de onboarding
Mes 3-4:  15 colegios (ops lead contratado corre onboarding)
Mes 5-6:  40 colegios (sales motion repetible)
Mes 7:    Series A — $1.5-2M USD (ARR ~$400K, 80+ colegios)
Mes 8-12: Pilotos internacionales (Perú/Colombia), Fase 2 asignaturas
```

### Cuándo Levantar Capital
- **Pre-seed (ahora)**: $200-300K — scanners (100 units), infra, 6mo runway. Angels + EdTech funds.
- **Seed (Mes 4)**: $800K — team (sales, ops, 1 dev), 50 school pipeline, LATAM legal.
- **Series A (Mes 7)**: $1.5-2M — scale engine, country managers, Fase 2 product.

**No levantar antes de 15 colegios pagando.** Tracción > deck.

---

## Proyecciones Financieras

### Year 1
- **Colegios**: 80
- **ARR**: $400K USD
- **Gross margin**: 85%
- **Burn rate**: $50K/mes
- **Runway**: 18 meses (post-Seed)

### Year 2
- **Colegios**: 300
- **ARR**: $1.5M USD
- **Gross margin**: 88%
- **Burn rate**: $120K/mes
- **Runway**: 24 meses (post-Series A)

### Year 3
- **Colegios**: 800
- **ARR**: $4M USD
- **Gross margin**: 90%
- **Burn rate**: $250K/mes
- **Rentabilidad**: Q4 Year 3

---

## Estrategia de Salida

### Escenario A: Adquisición Estratégica (Google, Microsoft, PowerSchool, Santillana)
Compran Relevo SpA — la entidad completa.
**Por qué**: Quieren los contratos con sostenedores, la integración con MINEDUC, el data pipeline, y el motor de adopción de profesores (TIZA) como paquete.
**TIZA es la joya de la corona** — es el amor del usuario, el NPS, el crecimiento orgánico. Pero no existe sin la plomería de RELEVO.

### Escenario B: Private Equity Roll-up
Compran Relevo SpA, strip TIZA para un play de "plataforma de profesores", mantienen RELEVO GESTIÓN para el play de "ERP".
**Riesgo**: Pueden separarte. **Defensa**: Hacer la integración de datos tan profunda que separar destruya valor.

### Escenario C: TIZA Spins Out (The Instagram Play)
TIZA llega a 100K MAU, 4.8 stars, viral coefficient >1.2.
Levantas Series B para TIZA a valuación premium. RELEVO retiene 60%.
**Realidad**: EdTech rara vez obtiene múltiplos de consumidor. No apuestes la granja a esto.

### Jerarquía de Valuación
1. **RELEVO (Enterprise ARR, net revenue retention >110%)** → 8-12x ARR
2. **TIZA (MAU, engagement, teacher NPS)** → Premium estratégico solo si está adjunto a #1
3. **RELEVO Ecosistema (API revenue, partner integrations)** → Valor de opción

### Posicionarse para Adquisición
"RELEVO es el sistema operativo para sostenedores chilenos. TIZA es cómo ganamos a los profesores. Juntos, poseemos el loop de datos."
Esa es la slide. Esa es la historia. Ese es el múltiplo.

---

## Métricas Clave de Negocio

### North Star Metric
**Horas devueltas a profesores por semana** (no "pruebas corregidas")

### Métricas de Crecimiento
- **ARR growth rate**: >100% MoM (Mes 1-6)
- **Net Revenue Retention**: >110% (expansion revenue)
- **Logo retention**: >90% (Mes 1-12)

### Métricas de Producto
- **Teacher activation**: >70% (profesores que escanean ≥1 evaluación/semana)
- **Time saved per teacher**: ≥4h/semana
- **Teacher NPS**: >50

### Métricas de Eficiencia
- **CAC payback period**: <12 meses
- **LTV/CAC**: >3x
- **Gross margin**: >85%

### Métricas de Equipo
- **eNPS (employee NPS)**: >30
- **Founder sanity**: Vacation days taken >15/año

---

## Frase que Define Todo

*"A brand is not a logo. A brand is a promise kept at scale. RELEVO promises the sostenedor: 'You will know.' TIZA promises the profe: 'You will rest.' Keep both, and the money follows. Break either, and no amount of Gemini tokens saves you."* — Tyrion Lannister
