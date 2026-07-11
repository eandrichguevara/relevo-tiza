# Roadmap de Desarrollo — 12 Meses

## Visión General

**Objetivo**: De 0 a 800 colegios en 3 años, con expansión a LatAm.

**Enfoque**: Piloto → Iteración → Escala → Expansión internacional

---

## Mes 1-2: Fundación y Piloto

### Objetivos
- Constituir Relevo SpA
- Registrar marcas RELEVO + TIZA
- Deployar MVP técnico
- Piloto con 5 colegios

### Entregables Clave

#### Legal
- [ ] Constitución Relevo SpA ($300K-500K CLP)
- [ ] Búsqueda de antecedentes de marca ($150K-250K CLP)
- [ ] Registro marcas INAPI ($1.1M-1.6M CLP)
- [ ] Contratar DPO externo certificado ($3-5M CLP/mes)
- [ ] Ejecutar DPIA completa
- [ ] Matriz de consentimiento granular
- [ ] Contrato SaaS B2B (plantilla)
- [ ] Seguro RC Profesional 5,000 UF

#### Técnico
- [ ] Scaffold mono-repo Turborepo
- [ ] Deployar FastAPI backend
- [ ] Deployar Next.js frontend (TIZA)
- [ ] Configurar PostgreSQL schema-per-tenant
- [ ] Configurar S3 + Object Lock
- [ ] Deployar pipeline OCR (FusionOCR)
- [ ] Deployar LLM local (Qwen2.5-7B)
- [ ] Implementar brand middleware
- [ ] Configurar subdominios wildcard

#### Producto
- [ ] Flujo de creación de evaluación (profesor)
- [ ] Generación de PDF con coordenadas + QR
- [ ] Flujo de escaneo (escáner → S3)
- [ ] Pipeline de procesamiento (OCR + LLM)
- [ ] Dashboard TIZA (profesor)
- [ ] Sistema de revisión manual (confianza < 0.65)
- [ ] Generación de reportes PDF

#### Marketing
- [ ] Diseñar logos RELEVO + TIZA
- [ ] Crear landing pages (relevo.cl, tiza.app)
- [ ] Preparar pitch deck para sostenedores
- [ ] Reclutar 5 colegios piloto

### Métricas de Éxito
- 5 colegios piloto activos
- 100+ evaluaciones procesadas
- CER < 15% (Character Error Rate)
- Teacher override rate < 20%
- NPS profesor > 30

### Presupuesto Estimado
- Legal: $20-30M CLP
- Técnico (infra): $5-10M CLP
- Marketing: $5M CLP
- **Total**: $30-45M CLP

---

## Mes 3-4: Iteración y Validación

### Objetivos
- Iterar basado en feedback de piloto
- Mejorar calidad de OCR (CER < 10%)
- Construir dataset de correcciones
- Expandir a 15 colegios

### Entregables Clave

#### Técnico
- [ ] Fine-tuning de E-TrOCR con datos chilenos
- [ ] Implementar fallback a Gemini Flash
- [ ] Dashboard RELEVO (sostenedor)
- [ ] Sistema de analytics (macrozona)
- [ ] API pública (OpenAPI spec)
- [ ] Testing automatizado (cobertura > 80%)

#### Producto
- [ ] Biblioteca de evaluaciones comunitarias
- [ ] Comentarios predefinidos personalizables
- [ ] Historial por alumno
- [ ] Sugerencias pedagógicas
- [ ] Notificaciones en tiempo real
- [ ] Versión imprimible de reportes

#### Marketing
- [ ] Campaña "La Semana del Silencio" (teaser)
- [ ] Evento de lanzamiento "RELEVO presenta TIZA"
- [ ] Primeros testimonios (2 profesores, 1 sostenedor)
- [ ] Contenido LinkedIn (RELEVO) + Instagram (TIZA)

### Métricas de Éxito
- 15 colegios activos
- 500+ evaluaciones procesadas
- CER < 10%
- Teacher override rate < 10%
- NPS profesor > 40
- Tiempo ahorrado ≥ 4h/semana (auto-reportado)

### Presupuesto Estimado
- Técnico (infra + GPU): $10-15M CLP
- Marketing: $10M CLP
- **Total**: $20-25M CLP

---

## Mes 5-6: Escala Inicial

### Objetivos
- Escalar a 40 colegios
- Contratar equipo mínimo (MLOps + ML engineer)
- Preparar para Series A
- Lanzar campaña "IA Soberana"

### Entregables Clave

#### Técnico
- [ ] Contratar MLOps senior ($150K/yr)
- [ ] Contratar ML engineer ($120K/yr)
- [ ] Migrar a GPU dedicada (2× A100)
- [ ] Implementar auto-scaling
- [ ] Observability (Prometheus + Grafana)
- [ ] Disaster recovery plan
- [ ] Pentesting externo (firma certificada)

#### Producto
- [ ] Integración con libro de clases (CSV export)
- [ ] Soporte para múltiples asignaturas (Ciencias, Historia)
- [ ] Sistema de gamificación para profesores
- [ ] Comunidad de profesores (WhatsApp/Telegram)
- [ ] Webinar semanal "Jueves de TIZA"

#### Marketing
- [ ] Campaña "IA Soberana, Datos en Chile"
- [ ] Video de 90 segundos del CEO
- [ ] PR: Pitch a medios edtech
- [ ] Benchmark público: "Nuestra IA vs IA genérica"
- [ ] Casos de éxito (5 colegios)

#### Legal
- [ ] Actualizar contratos basado en feedback
- [ ] Auditoría de cumplimiento Ley 19.628
- [ ] Renovar seguro RC Profesional

### Métricas de Éxito
- 40 colegios activos
- 2,000+ evaluaciones procesadas
- CER < 8%
- Teacher override rate < 5%
- NPS profesor > 50
- Activación > 70% (profesores que escanean ≥1 evaluación/semana)

### Presupuesto Estimado
- Técnico (infra + equipo): $50-70M CLP
- Marketing: $15M CLP
- Legal: $10M CLP
- **Total**: $75-95M CLP

---

## Mes 7: Series A

### Objetivos
- Levantar $1.5-2M USD
- ARR ~$400K (80 colegios × $5K promedio)
- Validar modelo de negocio

### Entregables Clave

#### Finanzas
- [ ] Preparar data room
- [ ] Financial model (3 años)
- [ ] Pitch deck para inversionistas
- [ ] Roadshow (2-3 semanas)
- [ ] Negociar términos (SAFE o priced round)

#### Técnico
- [ ] Escalar infraestructura para 500 colegios
- [ ] Implementar multi-región (preparar LatAm)
- [ ] Certificación ISO 27001 (opcional pero recomendado)
- [ ] Bug bounty program (privado)

#### Equipo
- [ ] Contratar Head of Sales
- [ ] Contratar Customer Success Manager
- [ ] Contratar 1-2 desarrolladores full-stack
- [ ] Contratar Designer (part-time)

### Métricas para Inversionistas
- ARR: $400K
- Growth rate: 100% MoM (mes 1-6)
- Gross margin: 85-90%
- NPS profesor: > 50
- Teacher activation: > 70%
- Retention: > 90% (mes 1-6)

### Uso de Fondos
- Equipo (18 meses): $800K
- Infraestructura (18 meses): $200K
- Marketing (18 meses): $300K
- Legal + compliance: $100K
- Working capital: $100K
- **Total**: $1.5M

---

## Mes 8-12: Escala y Expansión

### Objetivos
- Escalar a 300 colegios en Chile
- Iniciar pilotos en Perú/Colombia
- Lanzar Phase 2 (más asignaturas)
- Construir moat de datos

### Entregables Clave

#### Técnico
- [ ] Fine-tuning de modelo propio (destilación de Gemini)
- [ ] Pipeline de entrenamiento automatizado
- [ ] Multi-idioma (es-CL, es-PE, es-CO, es-MX)
- [ ] Data residency por país
- [ ] API para partners (LMS, SIS)

#### Producto
- [ ] Predictive analytics (alertas tempranas)
- [ ] Adaptive learning (recomendaciones personalizadas)
- [ ] Mobile app (TIZA para profesores)
- [ ] Portal de apoderados (ver reportes)
- [ ] Integración con Google Classroom / Microsoft Teams

#### Marketing
- [ ] Expansión a Perú (5 colegios piloto)
- [ ] Expansión a Colombia (5 colegios piloto)
- [ ] Campaña "La IA que entiende el SIMCE"
- [ ] White paper: "El estado de la evaluación en Chile 2027"
- [ ] Conferencia edtech (sponsor)

#### Equipo
- [ ] Country manager Perú
- [ ] Country manager Colombia
- [ ] 5-10 desarrolladores
- [ ] 3-5 Customer Success
- [ ] 2-3 Sales

### Métricas de Éxito (Mes 12)
- 300 colegios activos en Chile
- 10 colegios piloto en LatAm
- ARR: $1.5M
- Gross margin: 90%+
- NPS profesor: > 60
- Teacher activation: > 80%
- Retention: > 95%

### Presupuesto Estimado (Mes 8-12)
- Equipo: $500K USD
- Infraestructura: $100K USD
- Marketing: $200K USD
- Legal + compliance: $50K USD
- **Total**: $850K USD

---

## Año 2-3: Consolidación y Líder de Mercado

### Objetivos Año 2
- 800 colegios en Chile
- 100 colegios en LatAm
- ARR: $4M
- Serie B ($10-15M USD)

### Objetivos Año 3
- 2,000 colegios en Chile
- 500 colegios en LatAm
- ARR: $15M
- Explorar adquisición o IPO

---

## Hitos Críticos

| Mes | Hito | Riesgo si falla |
|-----|------|-----------------|
| 2 | 5 colegios piloto | No hay validación de producto |
| 4 | CER < 10% | Profesores rechazan herramienta |
| 6 | 40 colegios | No hay tracción para Series A |
| 7 | Series A cerrada | Sin capital para escalar |
| 12 | 300 colegios, ARR $1.5M | No hay product-market fit |
| 18 | Expansión LatAm exitosa | Mercado chileno saturado |
| 24 | 2,000 colegios, ARR $15M | No hay camino a rentabilidad |

---

## Condiciones de Aborto

Si cualquiera de estas condiciones se cumple, **pivotear o detener**:

1. **CER > 15% después de 6 meses** — La tecnología no funciona
2. **Teacher NPS < 20 después de 6 meses** — Los profesores no la aman
3. **Activación < 50% después de 6 meses** — No hay adopción orgánica
4. **Retention < 70% después de 12 meses** — Los colegios se van
5. **No levantar Series A después de 40 colegios** — Inversionistas no ven potencial
6. **Founder burnout** — Contratar COO/CEO externo o detener

---

## Métricas Clave por Fase

### Fase 1 (Mes 1-6): Product-Market Fit
- Teacher NPS > 40
- Teacher activation > 70%
- Time saved ≥ 4h/semana
- CER < 10%
- Teacher override rate < 10%

### Fase 2 (Mes 7-12): Scale
- ARR growth > 100% MoM
- Gross margin > 85%
- Retention > 90%
- NPS > 50
- CAC payback < 12 meses

### Fase 3 (Mes 13-24): Expansion
- LatAm ARR > 20% del total
- Multi-country ops funcionando
- LTV/CAC > 3x
- Rule of 40 (growth + margin > 40%)

---

## Recursos Necesarios

### Equipo (Mes 12)
- Founder/CEO
- CTO (o Head of Engineering)
- MLOps Engineer (senior)
- ML Engineer (mid-level)
- 2-3 Full-stack Developers
- Head of Sales
- 2 Customer Success Managers
- Designer (part-time)
- **Total**: 10-12 personas

### Infraestructura (Mes 12)
- 2× A100 80GB (GPU para inferencia)
- PostgreSQL RDS (multi-AZ)
- S3 (storage)
- CloudFront (CDN)
- **Costo mensual**: ~$5,000 USD

### Herramientas
- GitHub (code)
- Vercel (frontend)
- AWS (backend)
- Linear (project management)
- Notion (documentation)
- Slack (communication)
- **Costo mensual**: ~$1,000 USD

---

## Frase que Define Todo

*"No midan solo 'pruebas corregidas'. Midan 'horas devueltas al profesor' y 'satisfacción docente'. Esas son las métricas que importan."* — Xavier
