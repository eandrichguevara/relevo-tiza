# 01 — Legal y Corporativo

> **Tiempo estimado**: 4-8 semanas
> **Costo estimado**: $20-30M CLP (primeros trámites)
> **Bloqueante**: 🔴 SÍ — Sin esto no hay empresa, no hay contratos, no hay protección.

---

## 1.1 Constituir Relevo SpA

### Qué es
Crear la persona jurídica "Relevo SpA" mediante escritura pública ante notario, inscripción en el Registro de Comercio y publicación en el Diario Oficial.

### Qué implica exactamente
1. Redactar estatutos sociales (objeto social amplio: tecnología educativa, IA, SaaS, hardware)
2. Definir capital inicial ($1-5M CLP típico para SpA)
3. Firmar escritura ante notario
4. Inscribir en Registro de Comercio (Conservador de Bienes Raíces)
5. Publicar extracto en Diario Oficial
6. Obtener RUT de la empresa en SII (iniciación de actividades)

### Por qué es BLOQUEANTE
- Los contratos con colegios los firma Relevo SpA, no tú como persona natural
- Sin RUT empresa no puedes abrir cuenta bancaria, contratar AWS, Stripe, ni emitir boletas
- Responsabilidad limitada: si algo sale mal, responden los activos de la SpA, no los tuyos personales
- TIZA es una marca, no una persona jurídica. No puede firmar contratos

### Documentos que necesitas
- Cédula de identidad vigente
- Comprobante de domicilio
- Capital para constitución

### Costo
- Honorarios abogado/gestor: $200K-400K CLP
- Notaría: $50K-100K CLP
- Diario Oficial: $30K-50K CLP
- Conservador: $20K-40K CLP
- **Total**: ~$300K-500K CLP

### Tiempo
- 2-4 semanas si usas gestor
- 4-8 semanas si lo haces tú solo

---

## 1.2 Obtener RUT Tributario (SII)

### Qué es
Inicio de actividades ante el Servicio de Impuestos Internos como empresa de tecnología.

### Qué implica
1. Con la escritura de constitución, ir a SII.cl
2. Iniciar actividades como persona jurídica
3. Código de actividad: 620900 (actividades de tecnología de información)
4. Definir régimen tributario (recomendado: Pro-Pyme General o 14 D N°3)
5. Obtener RUT empresa (ej: 77.123.456-7)

### Costo
- $0 (trámite gratuito en SII)
- Si usas contador para configurar: $50K-100K CLP

### Tiempo
- 1-3 días hábiles

---

## 1.3 Registrar Marcas en INAPI

### Qué es
Registrar las marcas "RELEVO" y "TIZA" (y sus logos) en el Instituto Nacional de Propiedad Industrial.

### Marcas a Registrar

| Marca | Clases | Qué cubre |
|-------|--------|-----------|
| **RELEVO** (denominativa) | 9, 41, 42, 35 | Software, educación, SaaS, gestión |
| **TIZA** (denominativa) | 9, 41, 42, 35 | App móvil, educación, SaaS |
| **Logo RELEVO** (mixta) | 9, 41, 42 | Diseño + nombre |
| **Logo TIZA** (mixta) | 9, 41, 42 | Diseño + nombre |

### Clases Niza relevantes
- **Clase 9**: Software, apps descargables, hardware (escáner)
- **Clase 41**: Servicios educativos, formación, evaluación
- **Clase 42**: SaaS, plataformas tecnológicas, IA
- **Clase 35**: Publicidad, gestión empresarial, administración

### Riesgo: "Tiza" puede ser objetada por genérica
- Plan B: "TIZA APP", "MI TIZA", "TIZA CLASE", "TIZA EVALÚA"
- Realizar búsqueda de antecedentes ANTES de presentar solicitud

### Costo
- Búsqueda de antecedentes por marca: $150K-250K CLP
- Presentación INAPI por marca por clase: ~$80K CLP (3 UTM por clase)
- Publicación Diario Oficial: ~$30K-50K CLP
- **Total estimado**: $1.1M-1.6M CLP

### Tiempo
- Presentación: 1 semana
- Oposición de terceros: 30 días hábiles
- Aprobación final: 6-12 meses (pero puedes usar la marca con "MR" desde el día 1 de presentación)

### Por qué es BLOQUEANTE
- Sin marcas registradas, un competidor puede registrarlas primero y demandarte
- Las marcas son el activo más valioso de la empresa en etapa temprana
- Sin registro no puedes enviar cartas de cese y desista a infractores

---

## 1.4 Contratar DPO Externo Certificado

### Qué es
Delegado de Protección de Datos (DPO) — obligatorio según Ley 19.628 para procesamiento masivo de datos sensibles (menores + evaluaciones + IA).

### Qué implica
1. Buscar empresas certificadas en protección de datos en Chile
2. Evaluar 3 cotizaciones
3. Firmar contrato de servicios profesionales
4. El DPO debe tener independencia, reportar a directorio, y estar certificado

### Responsabilidades del DPO
- Supervisar cumplimiento de Ley 19.628
- Asesorar en DPIA (evaluación de impacto)
- Gestionar solicitudes de derechos ARCO (acceso, rectificación, cancelación, oposición)
- Reportar incidentes de seguridad al CPLT
- Ser punto de contacto para fiscalizaciones

### Costo
- $3-5M CLP/mes (externo, part-time para una startup)
- **Anual**: $36-60M CLP

### Empresas recomendadas (Chile)
- Buscar en el registro de la Agencia de Protección de Datos
- Consultar con estudio jurídico especializado (ej. Magliona, Alessandri, Carey)

---

## 1.5 Ejecutar DPIA (Evaluación de Impacto de Protección de Datos)

### Qué es
Documento formal que evalúa los riesgos para los derechos y libertades de los titulares de datos (alumnos menores de edad) antes de iniciar el tratamiento masivo con IA.

### Qué debe contener
1. Descripción del tratamiento (flujo de datos completo: escáner → S3 → IA → reportes)
2. Evaluación de necesidad y proporcionalidad
3. Evaluación de riesgos para derechos de los titulares
4. Medidas previstas para mitigar riesgos (cifrado, seudonimización, schema-per-tenant)
5. Consulta al DPO y recomendaciones

### Quién la hace
- El DPO la coordina
- Tú (fundador) provees la descripción técnica
- Posible consultoría externa si es muy complejo

### Costo
- Si la hace el DPO: incluido en su fee mensual
- Si contratas consultoría: $3-8M CLP

### Por qué es BLOQUEANTE
- La Ley 19.628 y el Reglamento UE 2016/679 (GDPR, como referencia) exigen DPIA para tratamientos de alto riesgo
- Procesar evaluaciones de menores con IA es ALTO RIESGO
- Sin DPIA aprobada, las multas pueden llegar a 500 UTM por evento

---

## 1.6 Crear Matriz de Consentimiento Granular

### Qué es
Formulario de consentimiento que los apoderados deben firmar, con checkboxes separados para cada tipo de procesamiento. **NO un "acepto todo"**.

### Los 4 checkboxes obligatorios
1. ☐ Autorizo que las evaluaciones de mi pupilo sean procesadas por un sistema de inteligencia artificial con fines de corrección asistida
2. ☐ Autorizo que los datos de rendimiento académico sean utilizados para generar analíticas agregadas y anónimas
3. ☐ Autorizo la transferencia de imágenes de evaluaciones a servidores de Google (EE.UU.) para su procesamiento [*solo si usas Gemini API*]
4. ☐ Autorizo la retención de datos de evaluación por el período exigido por el MINEDUC (10 años según D.S. 67/2018)

### Requisitos del consentimiento
- **Explícito**: Checkbox no pre-marcado
- **Informado**: Cada checkbox con explicación en lenguaje claro (no jurídico)
- **Específico**: Separado por finalidad (no un "acepto todo")
- **Inequívoco**: Acción afirmativa clara (marcar checkbox)
- **Revocable**: El apoderado puede retirar consentimiento en cualquier momento

### Firma
- Idealmente: ClaveÚnica o firma electrónica avanzada
- Mínimo aceptable: Consentimiento informado firmado físicamente con copia para el colegio
- Debe quedar registro inmutable (timestamp, IP, versión del formulario firmado)

### Por qué es BLOQUEANTE
- Sin consentimiento válido, procesar datos de menores es ilegal
- En un piloto, cada apoderado debe firmar antes de que el primer PDF de su hijo entre al sistema
- Multa por procesar datos sin consentimiento: hasta 500 UTM (~$32M CLP en 2026)

---

## 1.7 Contratar Seguro RC Profesional

### Qué es
Seguro de Responsabilidad Civil Profesional que cubra a Relevo SpA frente a demandas por errores del software, fuga de datos, o infracciones de propiedad intelectual.

### Cobertura Mínima
- **Monto asegurado**: 5,000 UF mínimo (~$190M CLP en 2026)
- **Tipo**: "Claims-made" (cubre reclamos hechos durante la vigencia)
- **Cola**: 3 años post-terminación
- **Cubre**: Error de software, fuga de datos, infracción IP, defensa legal

### Costo
- $8-12M CLP/año (~700-1,000 UF)

### Aseguradoras Recomendadas (Chile)
- Sura
- BCI Seguros
- Liberty
- Consorcio

### Por qué es ALTO (no bloqueante pero muy recomendado)
- Sin seguro, una demanda por corrección errónea puede llevarse todo
- El riesgo de demanda es ALTO (ver matriz de riesgos en documento legal)
- Tranquiliza a colegios: "estamos asegurados por 5,000 UF"

---

## 1.8 Redactar Contrato SaaS B2B

### Qué es
Plantilla de contrato entre Relevo SpA y el colegio (sostenedor) para la provisión del servicio.

### Cláusulas críticas (debe incluir)

| Cláusula | Qué debe decir |
|----------|---------------|
| **Propiedad de datos** | "El Colegio es Controlador. Relevo es Encargado. Los datos son propiedad del Colegio." |
| **Licencia de analítica** | "Relevo puede usar datos anonimizados irreversiblemente para mejorar modelos." |
| **Migración/Salida** | "Exportación completa en 30 días: PDFs, crops, metadatos, calificaciones. Formato JSON/CSV." |
| **Retención** | "Hot: 12 meses. Cold: 10 años. Purga: 12 años. Según MINEDUC D.S. 67/2018." |
| **SLA** | "99.5% disponibilidad mensual. Créditos: 10% fee por cada 0.5% abajo." |
| **Límite responsabilidad** | "Máximo 12 meses de fees pagados." |
| **Human-in-the-loop** | "La IA asiste, no reemplaza el juicio pedagógico. El profesor siempre valida." |
| **Terminación por incumplimiento** | "Colegio puede terminar sin penalidad si Relevo incumple Ley 19.628." |

### Quién lo redacta
- Abogado especializado en contratos tecnológicos / SaaS
- **NO uses plantillas genéricas de internet** — este contrato es tu escudo legal

### Costo
- $500K-800K CLP (plantilla inicial)
- $2-4M CLP si necesitas negociaciones personalizadas por colegio grande

---

## 1.9 Redactar Términos de Servicio (Profesores)

### Qué es
Términos y Condiciones que el profesor acepta al usar TIZA. Versión simplificada del contrato B2B.

### Debe incluir
- Licencia de uso (no venta, no propiedad)
- No cesión de propiedad intelectual
- Human-in-the-loop obligatorio
- Límite de responsabilidad
- Datos: qué recolectamos y por qué
- Versión en lenguaje simple (profesores, no abogados)

### Costo
- $300K-500K CLP (versión simplificada del contrato B2B)
- O inclúyelo en el fee del abogado que haga el contrato principal

---

## 1.10 Firmar DPA con Google Cloud

### Qué es
Data Processing Agreement (Acuerdo de Procesamiento de Datos) con Google Cloud. Obligatorio si usas Gemini API.

### Qué debe incluir
- Cláusulas contractuales tipo (SCC) para transferencia internacional
- "No training on customer data" — Google no usa tus datos para entrenar modelos
- Data residency: si es posible, restringir a región Sudamérica
- Notificación de incidentes de seguridad en < 72h
- Auditoría: derecho a auditar medidas de seguridad de Google

### Dónde se firma
- Google Cloud Console → IAM & Admin → Acuerdos legales
- O contactar a tu representante de ventas de Google Cloud

### Costo
- $0 (es parte del servicio)
- PERO: necesitas asesoría legal para revisar que cumple con Ley 19.628

---

## 📊 Resumen de Costos Legales (Year 1)

| Concepto | Costo | Frecuencia |
|----------|-------|------------|
| Constitución Relevo SpA | $300K-500K CLP | Una vez |
| Búsqueda antecedentes marcas | $150K-250K CLP | Una vez |
| Registro marcas INAPI (4 marcas × 4 clases) | $1.1M-1.6M CLP | Una vez |
| Contratos SaaS (plantilla) | $500K-800K CLP | Una vez |
| ToS Profesores | $300K-500K CLP | Una vez |
| DPO externo certificado | $3-5M CLP/mes | Mensual |
| DPIA | $3-8M CLP | Una vez |
| Seguro RC Profesional | $8-12M CLP/año | Anual |
| **Total Year 1** | **~$60-90M CLP** | |

> ⚠️ **No escatimes en legal.** Una multa de la CPLT por procesar datos de menores sin consentimiento puede ser de 500 UTM por evento (~$32M CLP). Un juicio por error de IA puede ser de $500M+. Lo legal es más barato que la alternativa.

---

*"Lo barato sale caro. Lo legal sale más barato que lo ilegal."* — Harvey Specter
