# Aspectos Legales — Cumplimiento Ley 19.628

## Resumen Ejecutivo

**Exposición legal estimada**: $500M - $2B CLP
- Multas Ley 19.628 (hasta 500 UTM/evento)
- Demandas colectivas
- Daño reputacional
- Pérdida de contratos

**Riesgo principal**: Procesamiento de datos de menores sin consentimiento válido.

---

## Ley 19.628 (Protección de Datos Chile)

### Datos Personales de Menores
- **Art. 2 letra d)**: "Datos personales: toda información concerniente a personas naturales identificadas o identificables"
- **Art. 2 letra e)**: "Datos sensibles: aquellos que revelen... datos referentes a la salud..."
- **Dictamen N° 000128 de 2021**: Imágenes que permiten identificar a una persona = dato personal

### Evaluaciones Escolares = Datos Sensibles
- Contienen nombres escritos por niños
- Pueden revelar dificultades de aprendizaje
- Revelan rendimiento académico (dato sensible)
- **Requieren consentimiento explícito, informado, específico e inequívoco** de padres/apoderados

---

## Consentimiento

### Lo que NECESITAS
| Dato | ¿Requiere consentimiento? | Base legal |
|------|---------------------------|------------|
| RUT, nombre completo | **SÍ** — dato sensible | Art. 10 Ley 19.628 |
| Evaluaciones, respuestas, calificaciones | **SÍ** — dato sensible | Art. 10 + Convención Derechos del Niño |
| Datos seudonimizados (sin RUT/nombre) | **SÍ** — si son re-identificables | Opinión 001/2020 CPLT |
| Analítica agregada (anónima irreversible) | **NO** — dato no personal | Art. 2 letra a |

### Matriz de Consentimiento Granular
**NO un "acepto todo"**. Checklist separado:
1. ☐ Autorizo corrección IA de evaluaciones
2. ☐ Autorizo analítica de rendimiento
3. ☐ Autorizo transferencia a Google (si usa API)
4. ☐ Autorizo retención 10+ años (MINEDUC)

**Firma**: Digital (ClaveÚnica o firma electrónica avanzada)

---

## Transferencia Internacional (APIs EE.UU.)

### Si usas Gemini/Claude/OpenAI
- Datos salen a EE.UU.
- **Art. 10 inciso 2°**: Requiere:
  1. Consentimiento específico e informado
  2. Nivel adecuado de protección (EE.UU. NO tiene)
  3. Cláusulas contractuales tipo (SCC) + DPIA

### Schrems II (aplica por analogía)
- Transferencia a país sin adecuación = garantías suplementarias obligatorias
- Necesitas: DPIA completa + SCC 2021 + evaluación de acceso gubernamental (FISA 702)

### Autohosting = Solución Limpia
- Imágenes nunca salen de tu infraestructura
- Eliminas: transferencia internacional, DPIA compleja, dependencia de terceros
- Cumplimiento simplificado radicalmente

---

## Retención de Datos

### MINEDUC D.S. 67/2018
- **Actas de evaluación**: 10 años mínimo
- **Recomendación**: Hot (12 meses) → Cold (10 años) → Purga (12 años)

### Tu documento original decía 5 años
- **INSUFICIENTE** según normativa MINEDUC
- **Corrección requerida**: Ajustar a 10 años mínimo

---

## Responsabilidad por Errores de IA

### Responsabilidad Solidaria
Si la IA corrige mal y el profesor confía ciegamente:
- Daño al alumno (nota injusta, pérdida de beca, repitencia)
- Demanda contra: (1) Relevo SpA, (2) Colegio, (3) Profesor

### Estrategia de Limitación Contractual
1. **Cláusula "Human-in-the-loop" obligatoria**: IA sugiere, profesor valida
2. **Límite de responsabilidad**: Máximo 12 meses de fees pagados
3. **Exclusión de garantía de precisión**: "El sistema asiste, no reemplaza juicio pedagógico"
4. **Indemnidad cruzada**: Colegio indemniza por uso indebido (ej. no revisar sugerencias)

### Seguro RC Profesional
- **OBLIGATORIO**: Mínimo 5,000 UF
- Cubra: errores de software, fuga de datos, infracción IP, defensa legal
- Póliza "claims-made" con cola de 3 años
- Costo estimado: $8-12M CLP/año

---

## Contratos SaaS con Colegios

### Cláusulas Críticas

| Cláusula | Qué debe decir | Por qué |
|----------|----------------|---------|
| **Propiedad de datos** | "El Colegio es Controlador. Relevo es Encargado. Datos = propiedad del Colegio." | Art. 12 Ley 19.628 |
| **Licencia de analítica** | "Relevo puede usar datos anonimizados irreversiblemente para mejorar modelos. Sin re-identificación." | Permite mejora IA sin riesgo legal |
| **Migración / Salida** | "Exportación completa en 30 días: PDFs, crops, metadatos, calificaciones. Formato abierto (JSON/CSV)." | Lock-in = riesgo regulatorio |
| **Retención** | "Hot: 12 meses. Cold: 10 años. Purga: 12 años. EXCEPTO: si normativa MINEDUC exige más." | MINEDUC requiere 10 años |
| **SLA / Disponibilidad** | 99.5% mensual. Créditos: 10% fee por cada 0.5% abajo. | Estándar mercado |
| **Terminación por incumplimiento datos** | Colegio puede terminar sin penalidad si Relevo incumple Ley 19.628. | Leverage del cliente |

### Firma
- **Siempre como Relevo SpA** (nunca como "Tiza")
- Tiza es una marca, no una persona jurídica
- Si firman como "Tiza", pierden el velo corporativo

---

## Propiedad Intelectual

| Activo | Dueño | Protección |
|--------|-------|------------|
| **Evaluaciones creadas por profesores** | Profesor / Colegio | Licencia no exclusiva a Relevo para operar |
| **Datos de rendimiento (analítica)** | Colegio (datos personales) | Relevo: licencia para anonimizar y usar en mejora de modelos |
| **Modelos IA entrenados con datos** | Relevo (modelo derivado) | Secreto industrial + cláusula de no ingeniería inversa |
| **Código fuente / Algoritmos** | Relevo SpA | Secreto industrial (Ley 19.039) |
| **Prompts / RAG / Fine-tuning** | Relevo | Know-how. Documentar como secreto industrial |

### Cláusula crítica en ToS
"El uso del servicio no transfiere propiedad de IP. Relevo retiene todos los derechos sobre la plataforma, modelos, algoritmos y mejoras derivadas del uso agregado y anonimizado."

---

## Protección de Datos de Menores

### Medidas Técnicas Obligatorias

| Medida | Estado | Acción |
|--------|--------|--------|
| **Cifrado en tránsito** | TLS 1.3 obligatorio | Verificar terminación TLS en ALB |
| **Cifrado en reposo** | pgcrypto AES-256 | Keys en AWS KMS (no en la DB) |
| **Cifrado en uso** | **FALTA** | Evaluar enclaves (AWS Nitro) para procesamiento IA |
| **Control de acceso** | Schema-per-tenant ✓ | Row-level security + políticas por rol |
| **Auditoría inmutable** | **FALTA** | Log de accesos a datos sensibles en CloudTrail |
| **DPO (Delegado Protección Datos)** | **OBLIGATORIO** | Externo, certificado, reporte a directorio |
| **DPIA (Evaluación Impacto)** | **OBLIGATORIA** | Antes de lanzar. Procesamiento masivo menores + IA = alto riesgo |
| **Derecho al olvido** | Proceso automático | API de supresión: anonimización irreversible + purga S3 |

### Consentimiento Granular
- NO un "acepto todo"
- Checklist separado por tipo de procesamiento
- Firma digital apoderado (ClaveÚnica o firma electrónica avanzada)
- Registro inmutable de consentimientos

---

## Riesgos Legales — Matriz de Mitigación

| Riesgo | Probabilidad | Impacto | Mitigación Concreta |
|--------|--------------|---------|---------------------|
| **Demanda por error corrección IA** | ALTA | ALTA | (1) Human-in-the-loop contractual, (2) Límite responsabilidad 12m fees, (3) Seguro RC 5.000 UF, (4) Logs de validación docente |
| **Fuga datos menores (RUT, nombres, PDFs)** | MEDIA | **CATASTRÓFICO** | (1) Cifrado en reposo/tránsito/uso, (2) Schema-per-tenant + RLS, (3) S3 Object Lock + versionado, (4) Pen-test trimestral, (5) Plan de respuesta incidentes < 72h |
| **Incumplimiento MINEDUC (retención, portabilidad)** | ALTA | ALTA | (1) Retención 10 años mínimo, (2) Exportación automática formato MINEDUC, (3) Monitoreo normativo activo |
| **Multas Ley 19.628 / Nueva ley datos** | ALTA | MEDIA | (1) DPO certificado, (2) DPIA aprobada, (3) ROPA, (4) Consentimiento granular validado |
| **Reclamo SERNAC / Acción colectiva** | MEDIA | ALTA | (1) ToS claros sin cláusulas abusivas, (2) Canal reclamos 48h, (3) Mediación prejudicial obligatoria |

---

## Acciones Inmediatas (Esta Semana)

### BLOQUEANTE — No negociable
1. **Contratar DPO externo certificado** — Externo, con reporte a directorio. Costo: ~$3-5M CLP/mes
2. **Ejecutar DPIA completa** — Antes de cualquier piloto con datos reales
3. **Redactar matriz de consentimiento granular** — 4 checkboxes separados, firma electrónica avanzada
4. **Revisar contrato Batch API Gemini** — Exigir SCC + addendum protección datos + garantías Art. 12
5. **Ajustar retención a 10 años mínimo** — MINEDUC D.S. 67/2018

### CRÍTICO — Próximos 30 días
6. **Plantilla contrato SaaS B2B (RELEVO ↔ Colegio)** — Incluyan: propiedad datos, licencia analítica, migración 30 días, retención 10 años, SLA 99.5%, límite responsabilidad 12m fees
7. **ToS B2C (TIZA ↔ Profesor)** — Versión simplificada: licencia uso, no cesión IP, human-in-the-loop, límite responsabilidad
8. **Adenda procesamiento datos (DPA)** — Anexo obligatorio Art. 12 Ley 19.628
9. **Seguro RC Profesional 5.000 UF** — Coticen 3 ofertas. Cobertura: error software, fuga datos, infracción IP, defensa legal
10. **Pen-test trimestral + Bug Bounty** — Contraten firma certificada

---

## Documentación Legal a Actualizar

1. **Política de Privacidad** — Sección "Procesamiento de imágenes con IA"
2. **Formulario de Consentimiento** — Anexo específico "Reconocimiento de texto manuscrito"
3. **Registro de Actividades de Tratamiento (ROPA)** — Nueva entrada: "OCR multimodal evaluaciones"
4. **DPIA** — Obligatoria para datos sensibles + tecnología nueva
5. **Contratos con Colegios** — Adenda "Procesamiento de evaluaciones"
6. **Procedimiento de Derechos ARCO** — ¿Cómo borra un padre embeddings vectoriales?
7. **Plan de Respuesta a Incidentes** — Brecha de imágenes de niños = notificación 72h a CPLT

---

## Estructura Corporativa

### Una SPA. Punto.
- **Relevo SpA** — única entidad legal
- **Marcas**: RELEVO + TIZA (ambas registradas en INAPI)
- **No holding prematuro** — costo innecesario ($2-3M CLP/año extra)
- **Holding solo cuando**: Series A ($500K+ USD), separación de riesgo, stock options

### Registro de Marcas en INAPI
| Marca | Clases | Costo estimado |
|-------|--------|----------------|
| **RELEVO** | 9, 42, 41, 35 | $350K–$500K CLP |
| **TIZA** | 9, 42, 41, 35 | $350K–$500K CLP |
| **Logo Relevo** | 9, 42, 41 | $200K–$300K CLP |
| **Logo Tiza** | 9, 42, 41 | $200K–$300K CLP |
| **Total** | | **$1.1M–$1.6M CLP** |

**Riesgo**: "Tiza" puede ser objetada por genérica. Plan B: "TIZA APP", "MI TIZA", "TIZA CLASE"

---

## Inversión y Financiamiento

### Levantar en Relevo SpA
- **Pre-seed/Seed**: SAFE o Convertible Note. Valuation cap + discount
- **Series A**: Ronda priced. Nueva serie de acciones (Series A Preferred)
- **ESOP**: 10-15% post-money para equipo. Vesting 4 años, cliff 1 año

### NO creen "Tiza SpA" para levantar capital
- Fragmenta la cap table
- Confunde a inversionistas
- Obliga a hacer M&A interno después (costoso, riesgoso)

---

## Costos Legales Estimados

| Concepto | Costo | Frecuencia |
|----------|-------|------------|
| Constitución Relevo SpA | $300K–$500K CLP | Una vez |
| Búsqueda de antecedentes marca | $150K–$250K CLP | Una vez |
| Registro marcas INAPI (ambas) | $1.1M–$1.6M CLP | Una vez |
| Contratos SaaS (plantilla) | $500K–$800K CLP | Una vez |
| DPO externo certificado | $3-5M CLP/mes | Mensual |
| Seguro RC Profesional | $8-12M CLP/año | Anual |
| Pen-test trimestral | $2-4M CLP/vez | Trimestral |
| **Total Year 1** | **~$50-80M CLP** | |

---

## Frase que Define Todo

*"Firmen los contratos. Registren las marcas. Vendan. Eso es lo que importa."* — Harvey Specter
