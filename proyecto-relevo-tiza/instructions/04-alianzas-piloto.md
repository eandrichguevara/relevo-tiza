# 04 — Alianzas y Piloto

> **Tiempo estimado**: 4-8 semanas (identificar, convencer, firmar, onboardear)
> **Costo estimado**: $5-15M CLP (escáneres, desplazamientos, incentivos)
> **Bloqueante**: 🔴 SÍ — Sin colegios reales usando el producto, no hay validación.

---

## 4.1 Identificar 5 Colegios Piloto

### Qué es
Encontrar y convencer a 5 colegios para que sean los primeros en usar RELEVO + TIZA durante 12 semanas.

### Perfil del colegio ideal para piloto

| Característica | Ideal | Aceptable |
|----------------|-------|-----------|
| **Tipo** | Subvencionado o privado | Público (más lento por burocracia) |
| **Tamaño** | 300-800 estudiantes | 200-2,000 |
| **Niveles** | Básica + Media | Solo básica o solo media |
| **Asignaturas activas** | Lenguaje + Matemáticas (SIMCE) | Al menos una |
| **Jefe de UTP** | Motivado, innovador, influyente | Cauteloso pero abierto |
| **Profesores** | 10+ docentes dispuestos a probar | 5+ docentes |
| **Infraestructura** | Internet estable, enchufe cerca de sala de profesores | Mínimo: WiFi en sala de profesores |
| **Ubicación** | Santiago / RM (cerca del founder) | Regiones (más logística) |

### Mix recomendado para el piloto
1. 🏫 **Colegio privado pagado** (800+ estudiantes) — Budget holgado, exigentes en calidad
2. 🏫 **Colegio subvencionado mediano** (500 estudiantes) — Tu cliente típico
3. 🏫 **Colegio subvencionado pequeño** (200 estudiantes) — Prueba de precio
4. 🏫 **Colegio público / municipal** (1,000+ estudiantes) — Validación MINEDUC
5. 🏫 **Colegio técnico-profesional** — Diferente perfil de asignaturas

### Cómo encontrarlos
1. **Red personal**: Contactos de tu red (ex-compañeros, profesores conocidos)
2. **LinkedIn**: Buscar "Jefe UTP", "Coordinador Académico", "Director" + "colegio"
3. **Eventos educativos**: Asistir a conferencias de educación (SIMCE, CPEIP)
4. **Recomendaciones**: Pedir a cada colegio que recomiende otro
5. **Cold outreach**: Email directo a directores con propuesta de valor clara

### Email de outreach (template)

```
Asunto: 15 horas semanales que sus profesores podrían recuperar

Estimado/a [Nombre del Director/a],

Soy [Tu nombre], founder de Relevo. Estamos construyendo TIZA, una 
herramienta que usa IA para corregir evaluaciones automáticamente, 
ahorrándole a cada profesor 15+ horas semanales.

Estamos buscando 5 colegios para un piloto GRATUITO de 12 semanas. 
Incluye:
- Escáner profesional instalado en su colegio (sin costo)
- App TIZA para todos sus profesores
- Dashboard en tiempo real para usted
- Soporte personalizado del founder

El único requisito: 10+ profesores dispuestos a probarlo durante 
un semestre.

¿Le interesaría una videollamada de 15 minutos para contarle más?

Saludos,
[Nombre]
Founder, Relevo
[Teléfono]
```

---

## 4.2 Firmar Acuerdos de Piloto

### Qué es
Contrato formal entre Relevo SpA y el colegio para el período de piloto (12 semanas).

### El acuerdo debe incluir

| Cláusula | Contenido |
|----------|-----------|
| **Duración** | 12 semanas, renovable |
| **Costo** | GRATUITO durante el piloto (valor real: $3-5K USD/año) |
| **Alcance** | Niveles y asignaturas específicos |
| **Hardware** | Relevo provee escáner en comodato. Colegio cuida y devuelve al terminar. |
| **Datos** | Colegio es dueño de los datos. Relevo puede usar datos anonimizados para mejorar modelos. |
| **Confidencialidad** | NDA mutuo. No compartir screenshots/datos sin autorización. |
| **Consentimientos** | Colegio se compromete a obtener consentimientos de apoderados antes del inicio. |
| **Soporte** | Founder disponible para onboarding, dudas, y visitas semanales. |
| **Testimonios** | Colegio acepta dar testimonial y participar en caso de éxito al final del piloto. |
| **Terminación** | Cualquiera puede terminar con 2 semanas de aviso. |

### ⚠️ NO incluir en el acuerdo de piloto
- Penalizaciones por cancelación
- Exclusividad
- Compromiso de compra al terminar el piloto

### Costo legal
- Plantilla simple de acuerdo de piloto: $300K-500K CLP
- Si usas la plantilla del contrato SaaS y la simplificas: $0 adicional

---

## 4.3 Recolectar Consentimientos de Apoderados

### Qué es
Formulario que cada apoderado debe firmar autorizando que las evaluaciones de su hijo sean procesadas por IA.

### Proceso
1. Preparar formulario de consentimiento granular (ver [01-legal](./01-legal-corporativo.md#16-crear-matriz-de-consentimiento-granular))
2. Entregar al colegio para distribución
3. El colegio recolecta formularios firmados
4. Digitalizar y almacenar de forma segura
5. Solo después de tener >90% de consentimientos del curso → activar el sistema para ese curso

### Template de comunicación a apoderados

```
Estimados apoderados del [Nivel] [Letra],

Nuestro colegio ha sido seleccionado para participar en un piloto 
de TIZA, una plataforma de corrección asistida por inteligencia 
artificial.

¿Qué significa esto?
- Las pruebas de sus hijos serán escaneadas y procesadas por IA
- Un profesor SIEMPRE revisará y validará cada corrección
- Los datos están encriptados y almacenados de forma segura
- Los resultados permitirán detectar áreas de mejora más rápido

Para participar, necesitamos su autorización. Adjunto encontrarán 
el formulario de consentimiento con 4 permisos específicos.

[Adjunto: Formulario de Consentimiento Informado]

Fecha límite: [2 semanas]
```

### Métricas a trackear
- % de consentimientos obtenidos por curso
- Tiempo desde distribución hasta >90%
- Motivos de rechazo (si los hay)

---

## 4.4 Definir Profesores "Teacher Advisors"

### Qué es
Seleccionar 2-3 profesores por colegio piloto que serán co-diseñadores del producto.

### Perfil del Teacher Advisor
- Enseña Lenguaje o Matemáticas (asignaturas del MVP)
- Motivado por la tecnología (no necesariamente experto)
- Buen comunicador (puede articular qué funciona y qué no)
- Influyente entre sus colegas (los demás le preguntan su opinión)
- Dispuesto a reunirse 30 min semanales contigo

### Qué obtienen ellos
- Acceso anticipado a features
- Nombre en los créditos de la app ("Co-diseñado con profesores chilenos")
- Honorarios simbólicos: $50-100K CLP/mes por su tiempo
- Reconocimiento en el evento de lanzamiento

### Qué obtienes tú
- Feedback honesto y crudo (no sesgado por cortesía)
- Detección temprana de bugs de UX
- Validación de que el producto resuelve un dolor real
- Testimonios auténticos para marketing
- Evangelistas internos que convencen a otros profesores

### Ritmo de interacción
- **Semanal**: Entrevista 1:1 de 30 min (qué funcionó, qué no, qué falta)
- **Quincenal**: Grupo focal con todos los teacher advisors
- **Mensual**: Encuesta NPS + features prioritarias

---

## 4.5 Mapear Currículum Chileno (SIMCE/PAES)

### Qué es
Documentar la estructura curricular chilena para que el sistema de rúbricas esté alineado con lo que los profesores realmente evalúan.

### Entregables necesarios
1. **Taxonomía de habilidades**: Inferencia, Retención, Aplicación, Análisis, Evaluación
2. **Objetivos de Aprendizaje (OA)**: Por nivel y asignatura (Bases Curriculares MINEDUC)
3. **Tipos de preguntas**: Alternativas (selección múltiple), Desarrollo (respuesta abierta), Verdadero/Falso
4. **Escalas de evaluación**: Nota 1.0-7.0, % de logro, niveles de desempeño (SIMCE)
5. **Rúbricas de ejemplo**: 10 rúbricas reales de Lenguaje y 10 de Matemáticas

### Fuentes
- [Bases Curriculares MINEDUC](https://www.curriculumnacional.cl)
- [SIMCE](https://www.agenciaeducacion.cl)
- [PAES](https://demre.cl)
- Preguntar a los teacher advisors: "¿Me compartes 5 pruebas que hayas tomado este semestre?"

### Costo
- $0 si lo haces tú con ayuda de teacher advisors
- $2-5M CLP si contratas a un asesor pedagógico para el mapeo formal

---

## 📊 Resumen del Piloto

| Métrica | Target |
|---------|--------|
| Colegios piloto | 5 |
| Duración | 12 semanas |
| Profesores activos | 10+ por colegio |
| Evaluaciones procesadas | 500+ en total |
| Teacher activation | >70% (escanean ≥1 eval/semana) |
| Tiempo ahorrado | ≥4h/semana (auto-reportado) |
| Teacher NPS | >30 |
| Consentimientos | >90% por curso |
| Costo total del piloto | ~$10-15M CLP |

---

*"No construyas en el vacío. Cinco colegios reales, doce semanas reales, feedback real. El resto es ficción."* — Xavier
