# 07 — Datos para IA

> **Tiempo estimado**: 2-4 semanas (recolección + etiquetado)
> **Costo estimado**: $2-5M CLP (si pagas a etiquetadores / profesores)
> **Bloqueante**: 🔴 Parcial — Tener evaluaciones reales es BLOQUEANTE para calibrar el pipeline. El resto es Alto/Medio.

---

## 7.1 Recolectar Evaluaciones Reales Anonimizadas

### Qué es
Obtener 100+ evaluaciones reales de alumnos chilenos (Lenguaje y Matemáticas, 4° básico a 4° medio) para calibrar y probar el pipeline de OCR+LLM.

### Qué necesitas exactamente

| Tipo | Cantidad | Formato |
|------|----------|---------|
| Pruebas de Lenguaje (alternativas) | 30+ | PDF escaneado a 300 DPI |
| Pruebas de Matemáticas (alternativas) | 30+ | PDF escaneado a 300 DPI |
| Pruebas con preguntas de desarrollo (manuscritas) | 40+ | PDF escaneado a 300 DPI |
| **Total** | **100+ evaluaciones** | |

### Cómo obtenerlas
1. **Teacher advisors**: Pedir a los profesores del piloto que compartan pruebas ANTERIORES (anonimizadas)
2. **Colegios piloto**: Como parte del acuerdo, solicitar acceso a evaluaciones históricas
3. **Compra de dataset**: Contratar a una empresa de recolección de datos educativos (caro, ~$5-10M CLP)
4. **Web scraping ético**: Buscar evaluaciones de ejemplo en sitios educativos chilenos (currículum nacional, educarchile)

### ⚠️ Anonimización OBLIGATORIA antes de usar

Antes de que cualquier evaluación llegue a tus manos, el colegio DEBE:
1. Tachar/eliminar nombres y RUT de los alumnos
2. Reemplazar con código genérico (ej. "ALUMNO_001")
3. Eliminar logos del colegio
4. Eliminar nombres de profesores

**Tú NUNCA debes ver datos personales de menores sin consentimiento firmado.**

### Proceso de recolección
```
1. Contactar al Jefe de UTP del colegio piloto
2. Solicitar: "¿Tienen pruebas del semestre pasado que ya no necesiten?"
3. El colegio anonimiza las pruebas (tachar nombres)
4. Escanear a 300 DPI (usando el escáner del piloto)
5. Subir a bucket S3 privado (NO público)
6. Etiquetar con metadata: asignatura, nivel, tipo de pregunta, fecha
```

### Estructura de almacenamiento

```
s3://tiza-datasets/
├── evaluations/
│   ├── lenguaje/
│   │   ├── 4to-basico/
│   │   │   ├── eval_001.pdf
│   │   │   └── ...
│   │   └── 2do-medio/
│   ├── matematicas/
│   └── desarrollo/          # Preguntas de desarrollo manuscritas
├── ground-truth/            # Transcripciones manuales
└── metadata.csv             # Índice de todas las evaluaciones
```

---

## 7.2 Etiquetar Ground Truth (Transcripción Manual)

### Qué es
Para cada evaluación recolectada, necesitas la transcripción manual exacta de lo que el alumno escribió. Esto es el "ground truth" contra el cual medirás el CER (Character Error Rate) de tu pipeline.

### Cuántas necesitas
- Mínimo: 50 evaluaciones con ground truth
- Ideal: 100+ evaluaciones
- Para fine-tuning de E-TrOCR (Fase 2): 1,800+ líneas de texto manuscrito

### Quién lo hace
- **Opción A (económica)**: Tú mismo transcribes (lento, ~30 min por evaluación)
- **Opción B (recomendada)**: Contratar a 2-3 profesores como transcriptores ($15-20K CLP/hora)
- **Opción C (escalable)**: Usar Gemini 2.5 Pro para pre-transcribir, luego un humano corrige (más rápido)

### Proceso
```
1. Para cada evaluación:
   a. Abrir PDF
   b. Para cada pregunta de desarrollo:
      - Transcribir EXACTAMENTE lo que el alumno escribió
      - Incluir faltas de ortografía, tachones, garabatos
      - Si no se entiende, marcar como [ILEGIBLE]
   c. Guardar transcripción en formato JSON
   
2. JSON de ground truth:
   {
     "eval_id": "eval_001",
     "student_code": "ALUMNO_001",
     "question_id": "q3",
     "transcription": "La selula es la unidad basica de...",
     "illegible_words": 0,
     "transcriber_notes": "Letra inclinada, dificultad con 'b' y 'd'"
   }
```

### Herramienta recomendada
- Construir una mini-app en Streamlit o Gradio para que los transcriptores trabajen más rápido
- O usar Label Studio (open source) para etiquetado de imágenes

### Costo
- 50 evaluaciones × 30 min × $20K/hora = $500K CLP
- 1,800 líneas de texto × 2 min × $20K/hora = $1.2M CLP
- **Total**: ~$1.7M CLP

---

## 7.3 Preparar Rúbricas de Ejemplo

### Qué es
10 rúbricas reales que los profesores usan para corregir, que servirán como prompt del sistema de IA.

### Estructura de una rúbrica (JSONB)

```json
{
  "subject": "Lenguaje",
  "grade": "4to básico",
  "title": "Comprensión lectora: texto narrativo",
  "questions": [
    {
      "id": "q1",
      "type": "alternativa",
      "text": "¿Cuál es el personaje principal del texto?",
      "options": ["A) Pedro", "B) Juan", "C) María", "D) José"],
      "correct_answer": "C",
      "skill": "Comprensión literal",
      "weight": 1.0
    },
    {
      "id": "q5",
      "type": "desarrollo",
      "text": "Explica por qué el personaje tomó esa decisión.",
      "rubric": {
        "max_score": 4,
        "criteria": [
          {"score": 1, "description": "Menciona un motivo"},
          {"score": 2, "description": "Menciona un motivo y cita el texto"},
          {"score": 3, "description": "Explica el motivo, cita el texto, conecta con contexto"},
          {"score": 4, "description": "Explica, cita, conecta y ofrece interpretación personal"}
        ]
      },
      "skill": "Inferencia",
      "weight": 4.0
    }
  ],
  "total_score": 30.0,
  "passing_score": 18.0,
  "grade_scale": "1.0-7.0"
}
```

### Cómo obtenerlas
1. Pedir a los teacher advisors que compartan sus rúbricas
2. Recolectar rúbricas de plataformas educativas chilenas
3. Crear 5 rúbricas "sintéticas" basadas en el currículum nacional (para testing)

---

## 7.4 Definir Taxonomía de Habilidades Cognitivas

### Qué es
Clasificación estándar de habilidades que el sistema usará para etiquetar preguntas y generar analíticas.

### Propuesta de taxonomía (adaptada de Barrett + MINEDUC)

```json
{
  "taxonomy": {
    "version": "1.0",
    "levels": [
      {
        "id": "literal",
        "name": "Comprensión Literal",
        "description": "Reconocer información explícita en el texto",
        "simce_alignment": "Nivel Inicial",
        "verbs": ["identificar", "reconocer", "nombrar", "seleccionar"]
      },
      {
        "id": "inferential",
        "name": "Inferencia",
        "description": "Deducir información implícita, relacionar ideas",
        "simce_alignment": "Nivel Intermedio",
        "verbs": ["inferir", "deducir", "relacionar", "interpretar"]
      },
      {
        "id": "critical",
        "name": "Evaluación Crítica",
        "description": "Emitir juicios, evaluar argumentos, contrastar",
        "simce_alignment": "Nivel Avanzado",
        "verbs": ["evaluar", "juzgar", "argumentar", "contrastar"]
      },
      {
        "id": "application",
        "name": "Aplicación",
        "description": "Usar conceptos en situaciones nuevas",
        "simce_alignment": "Nivel Avanzado",
        "verbs": ["aplicar", "resolver", "calcular", "demostrar"]
      }
    ]
  }
}
```

---

## 📊 Resumen de Datos para IA

| Entregable | Cantidad | Tiempo | Costo |
|------------|----------|--------|-------|
| Evaluaciones recolectadas | 100+ | 2-4 semanas | $0-2M CLP |
| Ground truth etiquetado | 50+ | 2-3 semanas | $500K-1.7M CLP |
| Rúbricas de ejemplo | 10+ | 1-2 semanas | $0 |
| Taxonomía de habilidades | 1 | 1 semana | $0 |
| **Total** | | **4-6 semanas** | **$500K-3.7M CLP** |

---

*"El modelo es un commodity. La infraestructura de evaluación es el activo. Sin ground truth, tu IA corrige con los ojos vendados."* — Tyrion Lannister
