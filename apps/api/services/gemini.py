"""Gemini AI service for OCR and grading."""
import json
import re
from typing import List, Dict, Any
from google import genai
from google.genai import types
from config import settings

CORRECTION_PROMPT = """Eres un profesor experto corrigiendo evaluaciones escolares en Chile.
Tu tarea es leer las respuestas manuscritas de estudiantes y corregirlas según la rúbrica proporcionada.

Rúbrica de la evaluación:
{rubric}

Para cada pregunta, DEBES devolver un JSON con el siguiente formato exacto:
{{
  "answers": [
    {{
      "question_number": 1,
      "student_answer": "texto exacto que escribió el estudiante",
      "score": 3.0,
      "max_score": 5.0,
      "confidence": 0.85,
      "requires_review": false,
      "ai_feedback": "retroalimentación pedagógica para el estudiante"
    }}
  ]
}}

Reglas:
- confidence debe ser un número entre 0 y 1
- Si no puedes leer la respuesta o tienes baja confianza (< 0.65), marca requires_review = true
- Sé justo pero riguroso en la corrección
- El feedback debe ser constructivo y en español chileno
- Para preguntas de alternativas, compara con la respuesta correcta
- Para preguntas de desarrollo, evalúa según los criterios de la rúbrica
- student_answer debe ser EXACTAMENTE el texto que el estudiante escribió, incluyendo errores
- Si la respuesta está en blanco, score = 0, confidence = 1.0 y student_answer = ""

IMPORTANTE: Responde ÚNICAMENTE con el JSON, sin markdown ni explicaciones adicionales."""


class GeminiService:
    """Service for processing evaluations using Google Gemini.
    Client is created lazily so missing/invalid keys don't crash startup."""

    def __init__(self):
        self._client = None
        self._api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL
        self.fast_model = settings.GEMINI_FAST_MODEL  # para sugerencias inline

    @property
    def client(self):
        if self._client is None:
            if not self._api_key:
                raise ValueError(
                    "GEMINI_API_KEY is not configured. "
                    "Set it in .env or environment variables."
                )
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    async def process_evaluation(
        self, evaluation, pdf_contents: bytes
    ) -> List[Dict[str, Any]]:
        """Process a scanned evaluation PDF and return graded results."""
        rubric_text = json.dumps(
            evaluation.rubric, indent=2, ensure_ascii=False
        )
        prompt = CORRECTION_PROMPT.format(rubric=rubric_text)

        contents = [
            types.Part.from_bytes(data=pdf_contents, mime_type="application/pdf"),
            types.Part.from_text(text=prompt),
        ]

        response = self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.0,
                max_output_tokens=4096,
            ),
        )

        raw_text = response.text.strip()

        # Extract JSON from response (handle markdown code blocks)
        json_match = re.search(r"\{[\s\S]*\}", raw_text)
        if json_match:
            raw_text = json_match.group(0)

        try:
            result_data = json.loads(raw_text)
        except json.JSONDecodeError:
            # Fallback: return empty results with high review flag
            rubric_items = (
                evaluation.rubric
                if isinstance(evaluation.rubric, list)
                else []
            )
            return [
                {
                    "student_code": "UNKNOWN",
                    "answers": [
                        {
                            "question_number": item.get(
                                "question_number", i + 1
                            ),
                            "student_answer": "",
                            "score": 0,
                            "max_score": item.get("max_score", 0),
                            "confidence": 0.0,
                            "requires_review": True,
                            "ai_feedback": "Error al procesar. Requiere revisión manual.",
                        }
                        for i, item in enumerate(rubric_items)
                    ],
                    "confidence": 0.0,
                    "requires_review": True,
                }
            ]

        # Wrap single student results or return multiple
        if "answers" in result_data and not isinstance(
            result_data.get("students"), list
        ):
            answers = result_data.get("answers", [])
            confidence_values = [a.get("confidence", 0) for a in answers]
            avg_confidence = (
                sum(confidence_values) / len(confidence_values)
                if confidence_values
                else 0
            )

            return [
                {
                    "student_code": "STUDENT-001",
                    "answers": answers,
                    "confidence": avg_confidence,
                    "requires_review": avg_confidence
                    < settings.CONFIDENCE_THRESHOLD,
                }
            ]

        return []

    async def correct_single_answer(
        self, image_bytes: bytes, question: Dict
    ) -> Dict:
        """Correct a single student answer image."""
        rubric_text = json.dumps(
            [question], indent=2, ensure_ascii=False
        )
        prompt = CORRECTION_PROMPT.format(rubric=rubric_text)

        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
            types.Part.from_text(text=prompt),
        ]

        response = self.client.models.generate_content(
            model=self.model,
            contents=contents,
            config=types.GenerateContentConfig(
                temperature=0.0,
                max_output_tokens=1024,
            ),
        )

        raw_text = response.text.strip()
        json_match = re.search(r"\{[\s\S]*\}", raw_text)
        if json_match:
            raw_text = json_match.group(0)

        try:
            data = json.loads(raw_text)
            answers = data.get("answers", [])
            return (
                answers[0]
                if answers
                else {
                    "student_answer": "",
                    "score": 0,
                    "max_score": question.get("max_score", 0),
                    "confidence": 0.0,
                    "requires_review": True,
                    "ai_feedback": "No se pudo procesar la respuesta.",
                }
            )
        except json.JSONDecodeError:
            return {
                "student_answer": "",
                "score": 0,
                "max_score": question.get("max_score", 0),
                "confidence": 0.0,
                "requires_review": True,
                "ai_feedback": "Error en el procesamiento.",
            }

    def check_health(self) -> bool:
        """Check if Gemini API is accessible."""
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents="Respond with 'OK'",
                config=types.GenerateContentConfig(max_output_tokens=5),
            )
            return "OK" in response.text
        except Exception:
            return False

    async def suggest_next_question(
        self,
        subject: Optional[str] = None,
        grade: Optional[str] = None,
        evaluation_title: Optional[str] = None,
        topic: Optional[str] = None,
        question_type: str = "written",
        existing_questions: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Suggest a new question aligned with course subject/grade, Mineduc Chile OA and context."""
        existing_str = "\n- ".join(existing_questions) if existing_questions else "Ninguna aún"

        # Construir contexto curricular: topic tiene precedencia; si no, se usa subject+grade
        topic_line = (
            f"- Unidad / Contenido curricular específico: {topic}"
            if topic
            else "- Unidad / Contenido curricular: Seleccionar contenidos propios del nivel y asignatura según las Bases Curriculares del Mineduc"
        )
        title_line = (
            f"- Título administrativo de la prueba (solo referencia, NO es el contenido a evaluar): {evaluation_title}"
            if evaluation_title
            else ""
        )

        prompt = f"""Eres un docente experto en el sistema educativo escolar de Chile.
Tu objetivo es redactar UNA pregunta de evaluación pedagógicamente rigurosa, alineada a las Bases Curriculares y Objetivos de Aprendizaje (OA) del Mineduc de Chile para la asignatura y nivel indicados.

Parámetros de la evaluación:
- Asignatura: {subject or 'General'}
- Nivel / Curso: {grade or 'General'}
{topic_line}
{title_line}
- Tipo de pregunta requerida: {'Opción Múltiple (multiple_choice)' if question_type == 'multiple_choice' else 'Desarrollo / Escrita (written)'}

Preguntas ya existentes en la prueba (DEBES evitar repetir estos conceptos o enunciados):
- {existing_str}

REGLAS ABSOLUTAS:
1. La pregunta debe evaluar CONTENIDOS DE {(subject or 'la asignatura').upper()} propios de {grade or 'el nivel'}, nunca contenidos de otras asignaturas.
2. NUNCA hagas referencia al nombre o título de la evaluación en el enunciado — la pregunta es para el estudiante, no sobre la prueba.
3. El `statement` DEBE SER directamente la pregunta o consigna para el estudiante (ej: "¿Cuál de los siguientes...?" o "Analiza las principales causas..."). PROHIBIDO iniciar con prefijos como "Pregunta de desarrollo:", "Pregunta:", "Enunciado:", etc.
4. Para preguntas de desarrollo, incluye criterios con MÚLTIPLES NIVELES DE DESEMPEÑO graduados con puntajes ESTRICTAMENTE MAYORES A 0 (ej: 3.0 pts, 2.0 pts, 1.0 pts).

Responde ÚNICAMENTE con el siguiente JSON (sin texto adicional):
"""
        if question_type == "multiple_choice":
            prompt += """{
  "statement": "¿Cuál es la causa principal del fenómeno X en Chile?",
  "type": "multiple_choice",
  "correct_answer": "A",
  "alternatives": [
    {"label": "A", "text": "Opción correcta basada en el OA", "is_correct": true},
    {"label": "B", "text": "Distractor verosímil que aborda un error frecuente", "is_correct": false},
    {"label": "C", "text": "Distractor plausible 2", "is_correct": false},
    {"label": "D", "text": "Distractor plausible 3", "is_correct": false}
  ]
}"""
        else:
            prompt += """{
  "statement": "Analiza las causas del proceso X y explica su impacto.",
  "type": "written",
  "criteria": [
    {
      "name": "Nombre del criterio (ej: Comprensión y Análisis)",
      "levels": [
        {"points": 3.0, "description": "Destacado: descripción breve del logro máximo."},
        {"points": 2.0, "description": "Adecuado: descripción breve del logro esperado."},
        {"points": 1.0, "description": "Elemental: descripción breve del logro mínimo."}
      ]
    }
  ]
}"""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=4096,
                response_mime_type="application/json",
            ),
        )

        raw_text = response.text.strip()
        data = None
        try:
            data = json.loads(raw_text)
        except json.JSONDecodeError:
            json_match = re.search(r"\{[\s\S]*\}", raw_text)
            if json_match:
                try:
                    data = json.loads(json_match.group(0))
                except Exception:
                    pass

        if data and isinstance(data, dict):
            if "statement" in data and isinstance(data["statement"], str):
                # Limpiar prefijos no deseados como "Pregunta de desarrollo:" o "Pregunta:"
                data["statement"] = re.sub(
                    r"^(Pregunta(\s+de\s+desarrollo|\s+de\s+opci[oó]n\s+m[uú]ltiple|\s*\d+)?\s*:?\s*)",
                    "",
                    data["statement"],
                    flags=re.IGNORECASE,
                ).strip()

            if "criteria" in data:
                data["criteria"] = self._sanitize_criteria(data["criteria"])
            return data

        # Si la IA no devolvió un JSON válido con 'statement', es un error real — no fabricar contenido
        raise ValueError(
            f"La IA no pudo generar una pregunta válida para {subject or 'la asignatura'} "
            f"({grade or 'nivel no especificado'}). Intenta de nuevo o especifica un tema curricular."
        )


    def _sanitize_criteria(self, criteria: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Asegura puntajes enteros, > 0, y orden estrictamente decreciente."""
        if not isinstance(criteria, list):
            return []

        sanitized = []
        for criterion in criteria:
            if not isinstance(criterion, dict):
                continue
            c_name = criterion.get("name", "Criterio de Evaluación")
            raw_levels = criterion.get("levels", [])
            if not isinstance(raw_levels, list) or len(raw_levels) == 0:
                continue

            cleaned_levels = []
            n = len(raw_levels)
            for i, level in enumerate(raw_levels):
                if not isinstance(level, dict):
                    continue
                desc = level.get("description", "").strip()
                pts = max(1, round(float(level.get("points", 0))))  # entero, mínimo 1
                cleaned_levels.append({"points": pts, "description": desc or "Nivel de desempeño"})

            # Ordenar descendente primero, luego garantizar diferencia mínima de 1
            # Recorrido de abajo hacia arriba para propagar ajustes correctamente
            cleaned_levels.sort(key=lambda x: x["points"], reverse=True)
            for i in range(len(cleaned_levels) - 2, -1, -1):
                if cleaned_levels[i]["points"] <= cleaned_levels[i + 1]["points"]:
                    cleaned_levels[i]["points"] = cleaned_levels[i + 1]["points"] + 1

            sanitized.append({"name": c_name, "levels": cleaned_levels})
        return sanitized

    async def suggest_distractors(
        self, statement: str, correct_answer: str, count: int = 3
    ) -> List[str]:
        """Generate plausible distractors for a multiple choice question."""
        prompt = f"""Eres un profesor experto en diseño de evaluaciones escolares en Chile.
Genera alternativas engañosas pero pedagógicamente valiosas (distractores) para una pregunta de opción múltiple.

Enunciado de la pregunta: "{statement}"
Respuesta correcta: "{correct_answer}"

Genera exactamente {count} distractores plausibles que reflejen concepciones erróneas comunes de estudiantes.

Responde únicamente con el siguiente formato JSON:
{{
  "distractors": ["Distractor 1", "Distractor 2", "Distractor 3"]
}}"""

        response = self.client.models.generate_content(
            model=self.fast_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=512,
                response_mime_type="application/json",
            ),
        )

        raw_text = response.text.strip()
        try:
            data = json.loads(raw_text)
            return data.get("distractors", [])[:count]
        except json.JSONDecodeError:
            json_match = re.search(r"\{[\s\S]*\}", raw_text)
            if json_match:
                data = json.loads(json_match.group(0))
                return data.get("distractors", [])[:count]
            return [f"Opción alternativa {i+1}" for i in range(count)]

    async def refine_question(
        self,
        statement: str,
        action: str,
        criteria: Optional[List[Dict[str, Any]]] = None,
        evaluation_title: Optional[str] = None,
        subject: Optional[str] = None,
        grade: Optional[str] = None,
        section_context: Optional[str] = None,
        field_type: Optional[str] = "statement",
        question_statement: Optional[str] = None,
        criterion_name: Optional[str] = None,
        question_type: Optional[str] = None,
        existing_alternatives: Optional[List[str]] = None,
        current_level_points: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Refine or autocomplete a question statement or field and adapt its criteria accordingly."""
        action_instructions = {
            "autocomplete": "Completa el texto ingresado por el profesor.",
            "improve": "Mejora la claridad, precisión gramatical y ortografía del enunciado sin cambiar su intención ni nivel cognitivo.",
            "simplify": "Simplifica el lenguaje del enunciado para hacerlo más comprensible, reduciendo el nivel cognitivo según la Taxonomía de Bloom.",
            "harder": "Aumenta SUTILMENTE el nivel cognitivo del enunciado según la Taxonomía de Bloom, manteniendo el mismo tema y formato.",
        }
        instruction = action_instructions.get(action, action_instructions["autocomplete"])

        # Ruta ultra-rápida e incremental (~100 caracteres por fragmento) para autocompletado Copilot
        if action == "autocomplete":
            field_descriptions = {
                "evaluation_title": "Título o nombre principal de la prueba escolar.",
                "divider_title": "Título de un separador o sección del examen (ej: 'Sección II: Desarrollo').",
                "info_title": "Título de un texto o lectura de referencia.",
                "info_content": "Cuerpo del texto, lectura o pasaje informativo de referencia.",
                "statement": "Enunciado o problema de una pregunta de evaluación.",
                "alternative_correct": "Opción/alternativa CORRECTA de la pregunta de selección múltiple.",
                "alternative_distractor": "Opción/alternativa DISTRACTORA (incorrecta pero verosímil).",
                "criterion_name": "Nombre del aspecto o criterio a evaluar en la rúbrica.",
                "level_description": "Descripción del nivel de logro o desempeño esperado en la rúbrica.",
            }
            target_field_desc = field_descriptions.get(field_type or "statement", "Campo de texto de la evaluación.")

            context_parts = []
            if evaluation_title:
                context_parts.append(f"Prueba: {evaluation_title}")
            if subject:
                context_parts.append(f"Asignatura: {subject}")
            if grade:
                context_parts.append(f"Curso: {grade}")
            if question_type:
                q_type_str = "Selección Múltiple (con alternativas)" if question_type == "multiple_choice" else "Desarrollo (respuesta escrita abierta)"
                context_parts.append(f"Formato de pregunta: {q_type_str}")
                if field_type == "statement":
                    target_field_desc = f"Enunciado de una pregunta de {q_type_str}."
            if section_context:
                context_parts.append(f"Sección actual: {section_context}")
            if question_statement:
                context_parts.append(f"Pregunta correspondiente: {question_statement}")
            if existing_alternatives:
                alts_str = ", ".join([f'"{a}"' for a in existing_alternatives if a and a.strip()])
                if alts_str:
                    context_parts.append(f"Otras alternativas ya escritas (NUNCA REPETIR NINGUNA): [{alts_str}]")
            if criterion_name:
                context_parts.append(f"Criterio actual: {criterion_name}")
            if criteria:
                crit_parts = []
                for c in criteria:
                    c_name = c.get("name") or "Sin nombre"
                    levels = c.get("levels") or []
                    l_strs = [f"{l.get('points', 0)} pts: \"{l.get('description', '')}\"" for l in levels]
                    crit_parts.append(f"Criterio '{c_name}' -> [{', '.join(l_strs)}]")
                context_parts.append(f"Rúbrica/Criterios existentes de la pregunta: [{'; '.join(crit_parts)}]")
            if current_level_points is not None:
                context_parts.append(
                    f"PUNTAJE ESPECÍFICO DEL NIVEL ACTUAL: {current_level_points} pts. "
                    f"¡ENFASIS CRÍTICO!: La sugerencia debe reflejar un desempeño y nivel de logro equivalente y coherente con exactamente {current_level_points} puntos."
                )

            ctx_str = ("\nContexto secundario de fondo (USAR SOLO SI ES DE LA MISMA TEMÁTICA DEL PROFESOR): " + " | ".join(context_parts)) if context_parts else ""

            sys_inst = (
                "Eres el motor de autocompletado para evaluaciones escolares en Chile.\n"
                f"Tu función es continuar redactando el campo de tipo: {target_field_desc}\n"
                "REGLAS ESTRICTAS DE CONTINUIDAD:\n"
                "1. NUNCA repitas el texto inicial que ya escribió el profesor.\n"
                "2. REGLA DE ESPACIADO INICIAL: Tu respuesta debe incluir o no un espacio inicial según corresponda. Si estás continuando una palabra incompleta (ej: el profesor escribió 'la explíc'), tu respuesta DEBE comenzar inmediatamente sin espacio (ej: 'ita de al menos...'). Si el profesor ya terminó la palabra anterior (ej: escribió 'la cebolla'), tu respuesta DEBE comenzar con un espacio de separación (ej: ' y el tomate...').\n"
                "3. REGLA DE ABSTENCIÓN (NO_SUGGESTION): Si el texto ingresado por el profesor ya constituye una idea u oración completa, autosuficiente o cerrada que no requiere continuación (o si no hay nada relevante que agregar), responde ÚNICAMENTE con la palabra 'NO_SUGGESTION' sin ningún otro texto.\n"
                "4. NO incluyas explicaciones, títulos, etiquetas ni JSON.\n"
                "5. NUNCA sugieras ni repitas una alternativa que ya esté presente en las otras alternativas escritas.\n"
                "6. PRIORIDAD ABSOLUTA DE CONTINUIDAD SEMÁNTICA: Continúa ÚNICAMENTE el tema e intención exacta de las palabras que el profesor comenzó a escribir. NUNCA saltes a problemas matemáticos o ejercicios que aparezcan en el contexto de fondo si el profesor está redactando otro tema. El texto del profesor manda sobre el contexto."
            )

            if field_type in ("level_description", "criterion_name"):
                sys_inst += (
                    "\nEXIGENCIA RIGUROSA DE RÚBRICA PEDAGÓGICA (PROHIBIDO TÉRMINOS VAGOS):\n"
                    "1. PROHIBIDO USAR EXPRESIONES VAGAS O AMBIGUAS: Queda strictly prohibido usar términos indeterminados como 'la mayoría', 'algunos', 'casi todos', 'imprecisiones menores', 'buen trabajo', 'esfuerzo' o 'parcialmente'.\n"
                    "2. CRITERIOS 100% OBSERVABLES Y CUANTIFICABLES: Describe métricas concretas y evidencias objetivas directamente verificables (ej: 'al menos 3 de 4 elementos', 'identifica las 2 fases principales', 'comete máximo 1 error en los cálculos').\n"
                    "3. ALINEADO AL OBJETIVO: Conecta directamente el desempeño con la competencia solicitada en la pregunta.\n"
                    "4. INDEPENDENCIA Y SIN JUICIOS DE VALOR PREMATUROS: Mantén el criterio aislado y sin adjetivos calificativos subjetivos ('excelente', 'bueno') en el título."
                )

            user_prompt = (
                f"Caja de texto que el profesor está escribiendo: {target_field_desc}\n"
                f"Texto ingresado por el profesor hasta ahora: \"{statement}\"{ctx_str}"
            )

            config_kwargs: Dict[str, Any] = {
                "system_instruction": sys_inst,
                "temperature": 0.2,
                "max_output_tokens": 35,
            }
            if "2.5-flash" in self.fast_model:
                config_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=0)

            response = self.client.models.generate_content(
                model=self.fast_model,
                contents=user_prompt,
                config=types.GenerateContentConfig(**config_kwargs),
            )
            raw = (response.text or "")
            # ponytail: strip solo comillas/punto final que Gemini a veces añade, pero NO tocar espacios
            raw_cleaned = raw.strip('"').strip("'").rstrip('.')

            if "NO_SUGGESTION" in raw_cleaned.upper() or not raw_cleaned.strip():
                return {"refined_statement": statement, "criteria": []}

            # ─── Merge determinista: respetar lo que ambos lados dicen ───
            continuation = raw_cleaned
            stmt_lower = statement.lower()
            cont_lower = continuation.lower()

            # Detectar si Gemini repitió parte del texto del profesor al inicio (overlap)
            max_check = min(len(statement), len(continuation))
            overlap = 0
            for k in range(max_check, 0, -1):
                if stmt_lower.endswith(cont_lower[:k]):
                    overlap = k
                    break

            if overlap > 0:
                continuation = continuation[overlap:]

            if not continuation.strip():
                return {"refined_statement": statement, "criteria": []}

            merged = statement + continuation
            import re
            clean_output = re.sub(r'  +', ' ', merged)

            return {"refined_statement": clean_output, "criteria": []}

        criteria_json = json.dumps(criteria, ensure_ascii=False) if criteria else "[]"
        criteria_instruction = (
            "Adapta también los criterios de evaluación para que sean coherentes con el nuevo enunciado."
            if criteria
            else "No hay criterios existentes."
        )

        prompt = f"""Eres un docente experto en evaluación escolar en Chile (Taxonomía de Bloom, Bases Curriculares Mineduc).

Acción solicitada: {instruction}
{context_block}
Texto ingresado por el usuario:
\"\"\"{statement}\"\"\"

Criterios de evaluación actuales (JSON):
{criteria_json}

{criteria_instruction}

REGLAS:
- Si la acción es 'autocomplete', el resultado DEBE EMPEZAR con las mismas palabras ingresadas por el usuario (o su corrección ortográfica leve).
- El enunciado refinado debe estar COMPLETO, sin truncar ni resumir partes.
- Mantén el mismo formato (partes a, b, c; fórmulas matemáticas, etc.) si existen.
- NO uses prefijos como "Pregunta:", "Enunciado:", etc.

Responde ÚNICAMENTE con este JSON:
{{
  "refined_statement": "enunciado completo refinado aquí",
  "criteria": [
    {{
      "name": "Nombre del criterio",
      "levels": [
        {{"points": 3.0, "description": "Destacado: descripción breve."}},
        {{"points": 2.0, "description": "Adecuado: descripción breve."}},
        {{"points": 1.0, "description": "Elemental: descripción breve."}}
      ]
    }}
  ]
}}"""

        response = self.client.models.generate_content(
            model=self.fast_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=2048,
                response_mime_type="application/json",
            ),
        )

        raw_text = response.text.strip()
        clean_text = re.sub(r"^```(?:json)?\s*", "", raw_text, flags=re.IGNORECASE).strip()
        clean_text = re.sub(r"```$", "", clean_text).strip()

        data = None
        try:
            data = json.loads(clean_text)
        except json.JSONDecodeError:
            json_match = re.search(r"\{[\s\S]*\}", clean_text)
            if json_match:
                try:
                    data = json.loads(json_match.group(0))
                except json.JSONDecodeError:
                    pass

        # Regex fallback si json.loads falló
        if not data or not isinstance(data, dict) or "refined_statement" not in data:
            stmt_match = re.search(r'"refined_statement"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', clean_text)
            if stmt_match:
                data = {"refined_statement": stmt_match.group(1), "criteria": []}
            else:
                raise ValueError("La IA no devolvió un enunciado refinado válido. Intenta de nuevo.")

        if "criteria" in data:
            data["criteria"] = self._sanitize_criteria(data["criteria"])

        return data

    async def suggest_rubric_criteria(
        self, statement: str, max_score: float = 3.0
    ) -> List[Dict[str, Any]]:
        """Generate evaluation rubric criteria for a written question."""
        prompt = f"""Eres un profesor experto creando rúbricas de evaluación cualitativa en Chile.
Genera criterios e indicadores de evaluación detallados para la siguiente pregunta de desarrollo:

Enunciado de la pregunta: "{statement}"
Puntaje máximo de referencia: {max_score} puntos.

Responde únicamente con un JSON con la lista de criterios (IMPORTANTE: Cada nivel debe tener puntaje estrictamente mayor que cero > 0):
{{
  "criteria": [
    {{
      "name": "Nombre del Criterio",
      "levels": [
        {{"points": {max_score}, "description": "Descripción para desempeño destacado"}},
        {{"points": {max_score * 0.6}, "description": "Descripción para desempeño suficiente"}},
        {{"points": {max_score * 0.3}, "description": "Descripción para desempeño inicial/parcial"}}
      ]
    }}
  ]
}}"""

        response = self.client.models.generate_content(
            model=self.fast_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.5,
                max_output_tokens=4096,
                response_mime_type="application/json",
            ),
        )

        raw_text = response.text.strip()
        criteria = []
        try:
            data = json.loads(raw_text)
            criteria = data.get("criteria", [])
        except json.JSONDecodeError:
            json_match = re.search(r"\{[\s\S]*\}", raw_text)
            if json_match:
                try:
                    data = json.loads(json_match.group(0))
                    criteria = data.get("criteria", [])
                except Exception:
                    pass

        if not criteria:
            raise ValueError("La IA no pudo generar criterios de evaluación. Intenta de nuevo.")

        return self._sanitize_criteria(criteria)



