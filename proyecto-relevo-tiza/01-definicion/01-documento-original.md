# Documento de Definición del Proyecto: Sistema RELEVO/TIZA

## 1. Visión General y Objetivos

RELEVO/TIZA es un sistema multitenant SaaS diseñado para colegios, cuyo objetivo principal es agilizar la corrección de evaluaciones y reducir la carga administrativa docente. A través del procesamiento masivo de documentos con IA y visión computacional, el sistema extrae datos cuantificables de rendimiento para mejorar la calidad educativa y los resultados en mediciones estandarizadas (SIMCE, PAES).

**Problema a resolver:** Exceso de tiempo invertido por los profesores en la revisión manual de pruebas, limitando el tiempo para la planificación y el análisis pedagógico.

**Solución:** Automatización del flujo de evaluación mediante hardware estandarizado (escáner proporcionado al colegio), procesamiento asíncrono en la nube y corrección asistida por IA con un modelo de "Human-in-the-loop".

## 2. Alcance del MVP

**Asignaturas Iniciales:** Pruebas de concepto en Lenguaje y Matemáticas, pero con una arquitectura agnóstica basada en rúbricas (JSONB) capaz de procesar cualquier asignatura desde el día uno.

**Tipos de Preguntas:** Soporte para alternativas y desarrollo escrito.

**Generación de Evaluaciones:** Plataforma interna donde el profesor diseña la prueba y rúbricas. El sistema renderiza el PDF final y las hojas de respuestas con coordenadas exactas y códigos QR, permitiendo al profesor elegir entre tamaños preestablecidos para las cajas de texto.

**Integraciones:** Excluidas en la fase MVP para priorizar el núcleo del producto.

## 3. Arquitectura y Stack Tecnológico

**Frontend:** Next.js (SSR/CSR híbrido), Middlewares para captura de subdominios (colegio.tiza.app). Implementación de Polling/SSE para actualizaciones de estado en tiempo real.

**Backend:** FastAPI (Python) nativamente asíncrono, ideal para manejar orquestación, roles de JWT (Admin/Teacher) y scripts de visión computacional (OpenCV/ZBar).

**Pipeline de IA:** Arquitectura de procesamiento por lotes usando AWS SQS como buffer y la Batch API de Gemini con Context Caching (ahorro radical de costos).

**Base de Datos:** PostgreSQL en Amazon RDS con arquitectura Schema-per-Tenant (un esquema por colegio para aislamiento total).

**Almacenamiento:** Amazon S3 inmutable para PDFs originales y crops de respuestas.

## 4. Privacidad, Seguridad y Cumplimiento (Ley N° 19.628)

**Seudonimización:** Los documentos procesados por la IA no incluirán el nombre explícito del alumno. Se utilizará un código identificador (ej. iniciales + últimos dígitos del RUT) para mitigar sesgos y proteger la identidad.

**Cifrado de Base de Datos:** Los datos sensibles (RUT, Nombres) se encriptarán a nivel de tabla utilizando herramientas nativas como pgcrypto.

**Retención de Datos en S3:**
- Hot Storage (12 meses): PDFs y crops disponibles en capa estándar durante el año escolar activo.
- Cold Storage (3-4 años): Archivo automático (ej. Glacier) por requerimientos del MINEDUC.
- Purga (5 años): Eliminación definitiva de archivos pesados, conservando solo analítica en texto plano.

**NOTA IMPORTANTE:** La retención debe ajustarse a 10 años mínimo según D.S. 67/2018 de MINEDUC para actas de evaluación.

## 5. Experiencia de Usuario y Flujo Operativo

**Creación:** El profesor estructura la prueba y las rúbricas en el frontend. El sistema exporta el documento listo para imprimir.

**Ejecución y Escaneo:** Los alumnos rinden la prueba. El colegio utiliza el escáner proporcionado, el cual envía los PDFs directamente a S3 vía SFTP/AWS Transfer.

**Procesamiento:** FastAPI detecta el documento, OpenCV recorta las respuestas, SQS agrupa lotes de 400 recortes y se envían a Gemini.

**Revisión Manual:** Un motor de reglas evalúa la confianza de la IA. Si la confianza no llega al umbral, la prueba se marca con REQUIERE_REVISIÓN_URGENTE para que el profesor valide la transcripción.

**Retroalimentación:** El sistema genera automáticamente un reporte individual en PDF para el alumno, explicando sus errores según la rúbrica.

## 6. Analítica y Reportabilidad

El sistema explotará los datos generados ofreciendo distintos niveles de profundidad:

**Nivel Macrozona (Directores/Jefes UTP - RELEVO):** Dashboards estadísticos a nivel de colegio, niveles o cursos.

**Nivel Microzona (Profesores - TIZA):** Dashboards enfocados en el rendimiento individual del alumno.

**Cruces de Datos:** En ambos niveles, los resultados se podrán filtrar y cruzar por Habilidades Cognitivas (Inferencia, Retención, etc.) y Tipo de Evaluación (SIMCE, PAES, Ensayo, Formativa).

## 7. Desafíos Técnicos y de Factibilidad

**Equipo:** Proyecto desarrollado por un solo-founder apoyado intensivamente por agentes de IA. Requiere una extrema disciplina en la gestión de repositorios, documentación de código y pruebas automatizadas.

**Optimización de Costos:** Mantener la estricta disciplina del procesamiento asíncrono (Batch API) para que los costos de infraestructura (AWS + LLM) sean sostenibles con el modelo de negocio SaaS.

**Visión Computacional:** Asegurar que los crops y la lectura de códigos QR mantengan una tasa de éxito casi perfecta bajo las condiciones del hardware proporcionado.

**Procesamiento Multimodal:** El sistema debe leer texto manuscrito por niños, lo cual requiere modelos de IA de alta capacidad (Gemini 2.5 Pro, Kimi K2.6, o pipeline híbrido OCR+LLM).

## 8. Arquitectura Dual-Brand (RELEVO + TIZA)

### Frontend
- **Dos apps Next.js separadas**: `apps/tiza-web` y `apps/relevo-web`
- **Subdominios**: `colegio.tiza.app` / `colegio.relevo.cl`
- **Auth compartido**: NextAuth.js con roles (teacher vs holder)

### Backend
- **Backend único FastAPI**: Compartido por ambas marcas
- **Brand resolution**: Middleware detecta marca por subdominio
- **Feature flags**: Configuración por marca (TIZA: scannerGuided, itemAnalysis; RELEVO: bulkUpload, executiveKPIs)

### Mapeo de Features
| Feature | RELEVO | TIZA |
|---------|--------|------|
| Dashboard macro | ✅ Principal | ❌ |
| Dashboard micro | ❌ | ✅ Principal |
| Escáner hardware | ✅ Marca RELEVO | ❌ |
| Reportes PDF | ✅ Ejecutivos | ✅ Pedagógicos |
| Emails transaccionales | noreply@relevo.cl | noreply@tiza.app |
| Gestión de usuarios | ✅ CRUD completo | ❌ Solo su curso |
| Facturación/Planes | ✅ Completo | ❌ |

## 9. Estrategia de IA (LLM)

### Opción Recomendada: Pipeline Híbrido
1. **OCR local especializado**: TrOCR-large-hand + TrOCR-large-print + EasyOCR (consensus voting)
2. **LLM local**: Qwen2.5-7B INT4 (3.3 GB VRAM) para comprensión
3. **Fallback API**: Gemini Flash para casos edge (confianza < 0.65)

### Costos
- Pipeline híbrido: ~$40-60/mes (GPU propia)
- API pura (Gemini 2.5 Pro): ~$120/mes (10K evaluaciones)
- Self-hosted Qwen2.5-VL-72B: ~$2,500-3,500/mes

### Roadmap de IA
- **Fase 1**: Pipeline híbrido (FusionOCR + Qwen2.5-7B)
- **Fase 2**: Fine-tune E-TrOCR con datos chilenos
- **Fase 3**: Destilar conocimiento de Gemini en modelo propio

## 10. Consideraciones Legales Críticas

### Ley 19.628 (Protección de Datos Chile)
- Las imágenes de evaluaciones SON datos personales sensibles
- Requieren consentimiento específico de padres/apoderados
- Transferencia internacional (APIs EE.UU.) requiere DPIA + SCC
- Autohosting simplifica cumplimiento significativamente

### Acciones Inmediatas
1. Contratar DPO externo certificado
2. Ejecutar DPIA completa antes de piloto
3. Matriz de consentimiento granular (4 checkboxes separados)
4. Contrato con Google Cloud (DPA firmado)
5. Seguro RC Profesional 5,000 UF

### Retención de Datos
- Ajustar a 10 años mínimo (MINEDUC D.S. 67/2018)
- Hot: 12 meses, Cold: 10 años, Purga: 12 años
