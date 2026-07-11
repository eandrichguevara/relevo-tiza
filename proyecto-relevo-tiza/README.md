# RELEVO + TIZA — Documentación Completa del Proyecto

## 🎯 Propósito de este Repositorio

Este repositorio contiene **toda la documentación necesaria** para que una configuración multiagente de OpenCode pueda desarrollar el proyecto RELEVO/TIZA de principio a fin.

**RELEVO**: Empresa/holding (B2B, venta a sostenedores de colegios)
**TIZA**: Aplicación para profesores (B2C, adopción orgánica)

---

## 📚 Estructura de Documentación

### 01-definicion/
Documentos fundacionales del proyecto.
- `00-resumen-ejecutivo.md` — Visión general, modelo de negocio, fechas clave
- `01-documento-original.md` — Documento técnico original (arquitectura, flujo, MVP)

### 02-arquitectura/
Decisiones de arquitectura técnica.
- `01-arquitectura-tecnica.md` — Stack, mono-repo, dual-brand, base de datos, flujos

### 03-legal/
Cumplimiento legal y regulatorio.
- `01-cumplimiento-ley-19628.md` — Protección de datos, consentimiento, contratos, estructura corporativa

### 04-marketing/
Estrategia de marca y negocio.
- `01-decisiones-naming.md` — Decisiones del consejo sobre naming (RELEVO + TIZA)
- `02-estrategia-negocio.md` — Modelo de negocio, pricing, go-to-market, competencia

### 05-tecnico/
Decisiones técnicas específicas.
- `01-estrategia-llm.md` — Pipeline híbrido OCR+LLM, benchmarks, roadmap de IA
- `02-seguridad.md` — Análisis de amenazas, controles, incident response

### 06-roadmap/
Plan de ejecución.
- `01-roadmap-12-meses.md` — Roadmap mes a mes, hitos, métricas, condiciones de aborto

---

## 🚀 Cómo Usar esta Documentación

### Para Agentes de IA (OpenCode Multi-Agente)

1. **Leer primero**: `01-definicion/00-resumen-ejecutivo.md` para entender el contexto general
2. **Según el área de trabajo**:
   - **Frontend/Backend**: `02-arquitectura/01-arquitectura-tecnica.md`
   - **IA/ML**: `05-tecnico/01-estrategia-llm.md`
   - **Legal/Compliance**: `03-legal/01-cumplimiento-ley-19628.md`
   - **Marketing/Ventas**: `04-marketing/02-estrategia-negocio.md`
   - **Seguridad**: `05-tecnico/02-seguridad.md`
   - **Project Management**: `06-roadmap/01-roadmap-12-meses.md`

3. **Para desarrollo completo**: Leer todos los documentos en orden

### Para Humanos

1. **Entender el proyecto**: Empezar con `00-resumen-ejecutivo.md`
2. **Profundizar en un área**: Ir a la carpeta correspondiente
3. **Ver decisiones del consejo**: `04-marketing/01-decisiones-naming.md` contiene todas las perspectivas

---

## 🎯 Decisiones Clave Tomadas

### Naming y Marca
- ✅ **RELEVO** = Empresa/holding (B2B, sostenedores)
- ✅ **TIZA** = App para profesores (B2C, docentes)
- ✅ Estructura dual-brand: "Tiza by Relevo" (visible solo para sostenedores)

### Arquitectura Técnica
- ✅ **Mono-repo Turborepo** con dos frontends Next.js separados
- ✅ **Backend único FastAPI** con brand resolution por header
- ✅ **Schema-per-tenant** en PostgreSQL para aislamiento de colegios
- ✅ **Subdominios**: `colegio.tiza.app` / `colegio.relevo.cl`

### Estrategia de IA (LLM)
- ✅ **Pipeline híbrido**: OCR local (FusionOCR) + LLM local (Qwen2.5-7B) + fallback API
- ❌ **NO Kimi K2.6**: Licencia desconocida, pesos no públicos
- ❌ **NO Llama 3.3 70B para visión**: No tiene capacidad multimodal
- ✅ **Qwen2.5-VL-72B**: Mejor opción open-source multimodal (si se necesita)
- ✅ **Fine-tuning con datos chilenos**: Roadmap para superar Gemini en CER

### Legal y Compliance
- ✅ **Una SPA**: Relevo SpA (no holding prematuro)
- ✅ **Registrar ambas marcas**: RELEVO + TIZA en INAPI
- ✅ **DPO externo certificado**: Obligatorio para datos de menores
- ✅ **Retención 10 años mínimo**: MINEDUC D.S. 67/2018
- ✅ **Seguro RC Profesional**: 5,000 UF mínimo

### Modelo de Negocio
- ✅ **RELEVO cobra**: $3-5K USD/año por colegio
- ✅ **TIZA gratis**: Para profesores (incluido en licencia RELEVO)
- ✅ **Hardware incluido**: Escáner amortizado en 3 años
- ✅ **Margen bruto**: 85-90%

---

## ⚠️ Riesgos Críticos Identificados

### Legal
- **Exposición**: $500M - $2B CLP (multas, demandas, daño reputacional)
- **Mitigación**: DPO, DPIA, consentimiento granular, seguro RC

### Técnico
- **Calidad de OCR**: Modelos open-source no igualan Gemini en letra de niños
- **Mitigación**: Pipeline híbrido + fine-tuning con datos chilenos

### Seguridad
- **Datos de menores**: Fuga = fin del negocio
- **Mitigación**: Cifrado E2E, schema-per-tenant, pentesting, incident response

### Negocio
- **Adopción pasiva**: Profesores no usan la herramienta
- **Mitigación**: Co-diseño con profesores, NPS tracking, usage-based renewal

---

## 📊 Métricas de Éxito

### Fase 1 (Mes 1-6): Product-Market Fit
- Teacher NPS > 40
- Teacher activation > 70%
- CER < 10% (Character Error Rate)
- 40 colegios activos

### Fase 2 (Mes 7-12): Scale
- ARR: $400K USD
- 80 colegios activos
- Gross margin > 85%
- Series A cerrada ($1.5-2M USD)

### Fase 3 (Mes 13-24): Expansion
- ARR: $1.5M USD
- 300 colegios en Chile
- 10 colegios piloto en LatAm
- Expansión internacional iniciada

---

## 🗓️ Fechas Clave

| Mes | Hito | Responsable |
|-----|------|-------------|
| 1 | Constitución Relevo SpA + Registro marcas | Founder + Legal |
| 2 | Piloto 5 colegios | Founder + Sales |
| 4 | CER < 10% validado | ML Engineer |
| 6 | 40 colegios activos | Sales + Customer Success |
| 7 | Series A cerrada | Founder + Investors |
| 12 | 300 colegios, ARR $1.5M | Todo el equipo |

---

## 💰 Presupuesto Estimado (Year 1)

| Concepto | Costo (CLP) |
|----------|-------------|
| Legal (constitución, marcas, contratos, DPO, seguro) | $50-80M |
| Técnico (infra, GPUs, herramientas) | $30-50M |
| Marketing (landing, campaña, PR) | $20-30M |
| Equipo (MLOps, ML engineer, devs) | $200-300M |
| **Total Year 1** | **$300-460M CLP** (~$350-540K USD) |

---

## 🎓 Lecciones Aprendidas del Consejo

### De Megamente (CMO)
*"No vendemos un escáner. Vendemos la primera noche de domingo que una profesora se va a dormir sin 60 pruebas encima."*

### De Xavier (Capital Humano)
*"Tiza y Relevo no son productos. Son puentes entre tres mundos que necesitan desesperadamente entenderse."*

### De Tyrion (Estrategia)
*"El modelo es un commodity. La infraestructura de evaluación es el activo."*

### De Harvey (Legal)
*"Firmen los contratos. Registren las marcas. Vendan. Eso es lo que importa."*

### De Levi (Seguridad)
*"Trust is earned, not given. And I don't give it until I've verified."*

### De Bulma (CTO)
*"Self-hosting isn't a cost optimization. It's a strategic pivot from 'AI consumer' to 'AI producer.'"*

---

## 🔗 Recursos Externos

### Herramientas Recomendadas
- **Mono-repo**: Turborepo (https://turbo.build/)
- **Frontend**: Next.js 14 (https://nextjs.org/)
- **Backend**: FastAPI (https://fastapi.tiangolo.com/)
- **Base de datos**: PostgreSQL + Prisma (https://www.prisma.io/)
- **IA/ML**: vLLM (https://vllm.ai/), Hugging Face (https://huggingface.co/)
- **Cloud**: AWS (https://aws.amazon.com/)
- **Auth**: NextAuth.js (https://next-auth.js.org/)

### Documentación Legal Chile
- Ley 19.628 (Protección de Datos): https://www.bcn.cl/leychile/navegar?idNorma=141599
- MINEDUC D.S. 67/2018 (Retención de documentos): https://www.leychile.cl/
- Consejo para la Transparencia: https://www.consejotransparencia.cl/

### Benchmarks de Modelos
- Open LLM Leaderboard: https://huggingface.co/spaces/HuggingFaceH4/open_llm_leaderboard
- OCRBench: https://arxiv.org/abs/2305.05535
- DocVQA: https://rrc.cvc.uab.es/?ch=17

---

## 📞 Contacto y Soporte

**Para preguntas sobre el proyecto**: Revisar documentación primero
**Para decisiones estratégicas**: Convocar consejo (Tío Iroh + subagentes)
**Para decisiones técnicas**: Bulma (CTO) + equipo técnico
**Para decisiones legales**: Harvey (Legal) + DPO externo

---

## 📝 Changelog

### Julio 2026
- Documentación inicial creada
- Decisiones de naming: RELEVO + TIZA
- Arquitectura técnica definida
- Estrategia de IA: Pipeline híbrido
- Plan legal: Cumplimiento Ley 19.628
- Roadmap 12 meses definido

---

## ⚖️ Licencia

Este documento es propiedad de Relevo SpA (una vez constituida).
Todo el contenido es confidencial y no debe compartirse externamente sin autorización.

---

*"El destino es como el té: se revela cuando lo dejas reposar. Pero a veces, hay que servirlo."* — Tío Iroh
