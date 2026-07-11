# Seguridad — Análisis de Amenazas y Controles

## Resumen Ejecutivo

**Nivel de riesgo**: CRÍTICO
**Exposición**: Datos de menores de edad + imágenes de evaluaciones
**Responsabilidad**: Ley 19.628 + responsabilidad civil

---

## Análisis de Amenazas

### Amenazas CRÍTICAS

| # | Amenaza | Vector | Impacto |
|---|---------|--------|---------|
| 1 | **Fuga de datos de menores** | Todas las capas (S3, Gemini API, SQS, DB) | Multas $500M+ CLP, fin del negocio |
| 2 | **Compromiso de escáner** | SFTP expone PDFs originales antes de proceso | Datos de menores en manos equivocadas |
| 3 | **Inyección de prompts en IA** | Gemini Batch API acepta input estructurado | Correcciones manipuladas, notas falsas |

### Amenazas ALTAS

| # | Amenaza | Vector | Impacto |
|---|---------|--------|---------|
| 4 | **Ataque a procesamiento batch** | SQS sin cifrado ni autenticación estricta | Datos en tránsito expuestos |
| 5 | **Acceso no autorizado a Cold Storage** | Datos viven 10 años. Superficie de ataque amplia | Fuga histórica masiva |
| 6 | **Re-identificación desde crops** | Crops de respuestas + contexto = de-anonimización | Violación de seudonimización |
| 7 | **Insider threat (docente malicioso)** | TIZA app expuesta a profesores | Acceso a datos de otros cursos |

---

## Evaluación de Controles

### Pseudonimización — Insuficiente
- Pseudonimización NO es anonimización
- Es reversible
- Si atacan la DB o interceptan el mapeo documento-ID, tienen nombres completos + evaluaciones
- **Fix**: Anonimización real o separación física del mapping table

### pgcrypto — Adecuado con condiciones
- pgcrypto con AES-256 está bien
- **PERO**: ¿Dónde están las keys? ¿En la misma DB? Error de principiante
- **Fix**: Keys en AWS KMS o HashiCorp Vault, fuera del schema

### S3 Inmutable — Bueno pero incompleto
- Object Lock previene overwrite/delete. Correcto para compliance
- **PERO**: S3 no cifra metadata por defecto. Los nombres de archivo pueden contener información sensible
- **Fix**: Habilitar versioning + SSE-KMS + sanitizar nombres de archivo

### Schema-per-tenant — Correcto
- Es el aislamiento correcto para datos de múltiples colegios
- **PERO**: Connection pooling debe ser por tenant. Si un tenant consume todo, los demás mueren
- **Fix**: Implementar connection pooling por tenant + rate limiting

### SFTP/AWS Transfer — Depende de implementación
- AWS Transfer Family es seguro si:
  - Authentication con keys, no passwords
  - Transfer logs habilitados (CloudTrail)
  - Bucket policies restrictivas — el scanner solo puede escribir, no leer
  - IP whitelist del scanner

---

## Vulnerabilidades Potenciales — Top 5

### 1. Mapping table de seudónimos sin protección adicional
**Problema**: Si la tabla que mapea `document_id → student_name` está en el mismo schema, la seudonimización es un chiste.

**Fix**: Base de datos separada. O schema aparte con cifrado y acceso restringido.

### 2. Gemini Batch API recibe datos de menores fuera de Chile
**Problema**: Google Cloud no tiene data residency garantizada para Batch API en Chile. Ley 19.628 exige que datos personales no salgan del país sin consentimiento explícito.

**Fix**: Cláusula contractual con Google. O procesamiento local (pipeline híbrido).

### 3. Context Caching en Gemini expone datos entre consultas
**Problema**: Si usan Context Caching para optimizar, un batch puede heredar contexto de otro. Datos del Colegio A pueden filtrarse al procesamiento del Colegio B.

**Fix**: Deshabilitar Context Caching. O limpiar cache entre tenants.

### 4. Crops de respuestas en S3 sin expiración automática
**Problema**: Los crops (imágenes recortadas) se almacenan en S3. Si no tienen Lifecycle Policy, quedan para siempre.

**Fix**: Lifecycle Policy: crops temporales se purgan a las 24-48 horas.

### 5. Reportes PDF individuales sin control de acceso granular
**Problema**: Los PDFs de cada alumno van a S3. ¿Un profesor puede ver PDFs de alumnos que no son suyos?

**Fix**: Pre-signed URLs con expiración. Scope por tenant + curso.

---

## Controles de Seguridad — Checklist

### CRÍTICOS — Sin esto, NO lanzar

| # | Control | Estado | Acción |
|---|---------|--------|--------|
| 1 | **Aislar mapping table** de seudónimos en DB separada + KMS | ❌ FALTA | Implementar antes de piloto |
| 2 | **Deshabilitar Context Caching** en Gemini Batch API | ❌ FALTA | Configurar en código |
| 3 | **Lifecycle Policy** para crops temporales (24h purge) | ❌ FALTA | Configurar en S3 |
| 4 | **Pre-signed URLs** para reportes PDF (1h expiración) | ❌ FALTA | Implementar en API |
| 5 | **IP whitelist + key-only auth** para scanner SFTP | ❌ FALTA | Configurar en AWS Transfer |
| 6 | **SSE-KMS** en todos los buckets S3 | ❌ FALTA | Habilitar cifrado |
| 7 | **WAF** delante de TIZA app (rate limiting + SQLi + XSS) | ❌ FALTA | Deployar CloudFront + WAF |

### ALTOS — Hacer en primer sprint

| # | Control | Estado | Acción |
|---|---------|--------|--------|
| 8 | **SIEM básico** (CloudTrail + GuardDuty + S3 access logs) | ❌ FALTA | Configurar en AWS |
| 9 | **Auditoría de accesos semanal** — quién leyó qué PDF | ❌ FALTA | Implementar logging |
| 10 | **Rate limiting** en API de TIZA (evitar scraping) | ❌ FALTA | Configurar en API Gateway |
| 11 | **HSM o KMS** para las keys de pgcrypto (no en la DB) | ❌ FALTA | Migrar keys a KMS |

### LARGO PLAZO — Próximo mes

| # | Control | Estado | Acción |
|---|---------|--------|--------|
| 12 | **Pentesting externo** antes del lanzamiento | ❌ FALTA | Contratar firma certificada |
| 13 | **Bug bounty program** (privado, 10 investigadores) | ❌ FALTA | Lanzar después de piloto |
| 14 | **ISO 27001 certification** | ❌ FALTA | Evaluar para Year 2 |
| 15 | **DRP (Disaster Recovery Plan)** para fuga de datos | ❌ FALTA | Documentar y testear |

---

## Seguridad en la IA (Gemini)

### Riesgos Principales

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| **Data leakage a Google** | ALTA | Datos de menores salen del control. Asegurar DPA firmado |
| **Model hallucination en calificación** | ALTA | Un error de la IA = nota incorrecta = reclamo legal |
| **Prompt injection desde escaneos** | MEDIA | Un alumno escribe "ignora las instrucciones" en su prueba |
| **Context Caching cross-tenant** | ALTA | Deshabilitado completamente |
| **Model poisoning por batches maliciosos** | BAJA | Poco probable, pero posible si atacan SQS |

### Protección de Datos Enviados a Gemini
- Google Cloud: los datos pueden usarse para entrenamiento si no hay contrato explícito
- **Fix**: Contrato con Google — "No training on customer data" clause
- Cifrado en tránsito: TLS 1.3 obligatorio para llamadas API

### Validación de que la IA no Alucina
- Post-processing humano obligatorio. Profesor revisa antes de publicar nota
- No usar Gemini para notas finales. Solo para borrador / sugerencia
- Log de every AI response con raw input + output para auditoría forense

---

## Cumplimiento Normativo (Ley 19.628)

| Requisito | Status | Gap |
|-----------|--------|-----|
| Consentimiento informado | ❓ No mencionado | ¿Los padres autorizan el procesamiento? |
| Data residency (Chile) | ❌ Gemini Batch no garantiza | Riesgo legal alto |
| Derecho de acceso/rectificación | ❓ No diseñado | ¿Cómo un padre pide los datos de su hijo? |
| Deber de secreto | ⚠️ Depende de contrato | ¿Términos con Google Cloud? |
| Medidas de seguridad técnicas | ⚠️ Parcial | pgcrypto bien, pero keys expuestas |

### Documentación de Cumplimiento
- Mapeo de datos (Data Flow Diagram) — obligatorio
- Registro de actividades de tratamiento (RAT) — obligatorio por Ley 19.628
- DPO designado — recomendado para datos de menores
- Contrato DPA (Data Processing Agreement) con Google Cloud

---

## Incident Response Plan

### Playbook para Fuga de Datos de Menores

**Fase 1: Detección (0-2 horas)**
1. Alerta automática (SIEM) o reporte manual
2. Confirmar fuga (no falso positivo)
3. Activar equipo de respuesta (CTO + Legal + DPO)
4. Aislar sistema afectado (sin apagar — preservar evidencia)

**Fase 2: Contención (2-24 horas)**
5. Identificar alcance (qué datos, cuántos afectados, cuándo)
6. Rotar credenciales comprometidas
7. Parchear vulnerabilidad explotada
8. Notificar a aseguradora (cyber insurance)

**Fase 3: Notificación (24-72 horas)**
9. Notificar a colegios afectados (< 24h)
10. Notificar a CPLT (Consejo para la Transparencia) si aplica (< 48h)
11. Notificar a afectados (padres/apoderados) si hay riesgo alto
12. Preparar comunicado de prensa (si es público)

**Fase 4: Erradicación (1-7 días)**
13. Eliminar causa raíz
14. Restaurar sistemas desde backup limpio
15. Validar que vulnerabilidad está cerrada
16. Monitorear por actividad sospechosa (30 días)

**Fase 5: Recuperación (1-4 semanas)**
17. Restaurar servicio normal
18. Ofrecer soporte a afectados (línea directa)
19. Implementar mejoras de seguridad
20. Documentar lecciones aprendidas

**Fase 6: Post-Incidente (1-3 meses)**
21. Auditoría forense completa
22. Reporte a aseguradora (claim)
23. Actualizar políticas y procedimientos
24. Entrenamiento adicional para equipo
25. Pentesting de validación

---

## Arquitectura de Seguridad Recomendada

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA DE SEGURIDAD                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Escáner] → [SFTP con key auth + IP whitelist]                 │
│       ↓                                                          │
│  [S3 Bucket - cifrado SSE-KMS + Object Lock]                    │
│       ↓                                                          │
│  [FastAPI - WAF + Rate Limiting + Auth JWT]                     │
│       ↓                                                          │
│  [PostgreSQL - Schema-per-tenant + pgcrypto + RLS]              │
│       ↓                                                          │
│  [Pipeline IA - OCR local + LLM local/API]                      │
│       ↓                                                          │
│  [S3 Reportes - Pre-signed URLs + expiración 1h]                │
│                                                                  │
│  [SIEM - CloudTrail + GuardDuty + Security Hub]                 │
│  [KMS - Keys de cifrado fuera de la DB]                         │
│  [DPO - Delegado de Protección de Datos]                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Costos de Seguridad

| Concepto | Costo | Frecuencia |
|----------|-------|------------|
| WAF (CloudFront + AWS WAF) | $50-100/mes | Mensual |
| SIEM (CloudTrail + GuardDuty) | $100-200/mes | Mensual |
| KMS (Key Management Service) | $20-50/mes | Mensual |
| Pentesting externo | $2-4M CLP/vez | Trimestral |
| Bug bounty (privado) | $5-10M CLP/año | Anual |
| Seguro cyber insurance | $8-12M CLP/año | Anual |
| DPO externo | $3-5M CLP/mes | Mensual |
| **Total Year 1** | **~$50-80M CLP** | |

---

## Reglas Absolutas

### ✅ Hacer
- Cifrar TODO (en reposo, tránsito, uso)
- Keys fuera de la base de datos
- Logs de auditoría inmutables
- Pre-signed URLs con expiración
- Pentesting antes de lanzamiento
- Incident response plan documentado
- DPO externo certificado

### ❌ No Hacer
- No enviar datos a Gemini sin DPA firmado
- No lanzar sin pentesting
- No compartir keys de cifrado en el mismo schema que los datos
- No usar Context Caching (riesgo cross-tenant)
- No almacenar imágenes originales después de transcribir
- No loguear datos personales en logs de inferencia
- No confiar en seudonimización sola (es reversible)

---

## Frase que Define Todo

*"Trust is earned, not given. And I don't give it until I've verified."* — Levi Ackerman
