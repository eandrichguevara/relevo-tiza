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
        topic: Optional[str] = None,
        question_type: str = "written",
        existing_questions: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Suggest a new question aligned with course subject/grade and context."""
        existing_str = "\n- ".join(existing_questions) if existing_questions else "Ninguna aún"
        prompt = f"""Eres un docente experto en diseño de evaluaciones escolares en Chile.
Genera una pregunta pedagógicamente sólida para:
- Asignatura: {subject or 'General'}
- Nivel: {grade or 'General'}
- Tema / Objetivo: {topic or 'Alineado al currículum nacional'}
- Tipo de pregunta: {'Opción Múltiple (multiple_choice)' if question_type == 'multiple_choice' else 'Desarrollo / Escrita (written)'}

Preguntas ya existentes en la evaluación (NO repetir estos temas):
- {existing_str}

Responde ÚNICAMENTE con un objeto JSON válido con el siguiente formato exacto:
"""
        if question_type == "multiple_choice":
            prompt += """{
  "statement": "Enunciado claro de la pregunta",
  "type": "multiple_choice",
  "correct_answer": "A",
  "alternatives": [
    {"label": "A", "text": "Opción correcta", "is_correct": true},
    {"label": "B", "text": "Distractor plausible 1", "is_correct": false},
    {"label": "C", "text": "Distractor plausible 2", "is_correct": false},
    {"label": "D", "text": "Distractor plausible 3", "is_correct": false}
  ]
}"""
        else:
            prompt += """{
  "statement": "Enunciado claro de la pregunta de desarrollo",
  "type": "written",
  "criteria": [
    {
      "name": "Comprensión / Contenido",
      "levels": [
        {"points": 3.0, "description": "Responde de forma completa y precisa"},
        {"points": 1.5, "description": "Responde parcialmente o con imprecisiones menores"},
        {"points": 0.0, "description": "No responde o la respuesta es incorrecta"}
      ]
    }
  ]
}"""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=1024,
            ),
        )

        raw_text = response.text.strip()
        json_match = re.search(r"\{[\s\S]*\}", raw_text)
        if json_match:
            raw_text = json_match.group(0)

        try:
            return json.loads(raw_text)
        except json.JSONDecodeError:
            if question_type == "multiple_choice":
                return {
                    "statement": "Pregunta de opción múltiple sugerida",
                    "type": "multiple_choice",
                    "correct_answer": "A",
                    "alternatives": [
                        {"label": "A", "text": "Opción correcta", "is_correct": True},
                        {"label": "B", "text": "Opción B", "is_correct": False},
                    ],
                }
            return {
                "statement": "Pregunta de desarrollo sugerida",
                "type": "written",
                "criteria": [
                    {
                        "name": "Criterio General",
                        "levels": [{"points": 3.0, "description": "Respuesta correcta"}],
                    }
                ],
            }

    async def suggest_distractors(
        self, statement: str, correct_answer: str, count: int = 3
    ) -> List[str]:
        """Generate plausible distractors for a multiple choice question."""
        prompt = f"""Eres un profesor diseñando alternativas engañosas pero pedagógicamente valiosas (distractores) para una pregunta de opción múltiple.

Enunciado de la pregunta: "{statement}"
Respuesta correcta: "{correct_answer}"

Genera exactamente {count} distractores plausiblemente incorrectos pero verosímiles que reflejen errores comunes de los estudiantes.

Responde ÚNICAMENTE con un JSON con el siguiente formato exacto:
{{
  "distractors": ["Distractor 1", "Distractor 2", "Distractor 3"]
}}"""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=512,
            ),
        )

        raw_text = response.text.strip()
        json_match = re.search(r"\{[\s\S]*\}", raw_text)
        if json_match:
            raw_text = json_match.group(0)

        try:
            data = json.loads(raw_text)
            return data.get("distractors", [])[:count]
        except json.JSONDecodeError:
            return [f"Opción alternativa {i+1}" for i in range(count)]

    async def refine_question(self, statement: str, action: str) -> str:
        """Improve, simplify, or increase difficulty of a question statement."""
        action_instructions = {
            "improve": "Mejora la claridad, precisión gramatical y ortografía del enunciado sin cambiar su intención ni dificultad.",
            "simplify": "Simplifica el lenguaje para que sea más fácil de comprender por estudiantes con menor comprensión lectora.",
            "harder": "Aumenta el nivel cognitivo de la pregunta (ej: pasando de memorización a análisis o aplicación).",
        }
        instruction = action_instructions.get(
            action, action_instructions["improve"]
        )

        prompt = f"""Eres un docente experto en evaluación escolar.
Tu tarea es modificar el siguiente enunciado de evaluación según esta indicación: {instruction}

Enunciado original: "{statement}"

Responde ÚNICAMENTE con el enunciado refinado final en texto plano, sin comillas adicionales ni explicaciones."""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.4,
                max_output_tokens=512,
            ),
        )

        return response.text.strip().strip('"')

    async def suggest_rubric_criteria(
        self, statement: str, max_score: float = 3.0
    ) -> List[Dict[str, Any]]:
        """Generate evaluation rubric criteria for a written question."""
        prompt = f"""Eres un profesor experto creando rúbricas de evaluación cualitativa en Chile.
Genera criterios e indicadores de evaluación detallados para la siguiente pregunta de desarrollo:

Enunciado de la pregunta: "{statement}"
Puntaje máximo de referencia: {max_score} puntos.

Responde ÚNICAMENTE con un JSON con el siguiente formato exacto:
{{
  "criteria": [
    {{
      "name": "Nombre del Criterio 1",
      "levels": [
        {{"points": 2.0, "description": "Descripción para puntaje alto"}},
        {{"points": 1.0, "description": "Descripción para puntaje medio"}},
        {{"points": 0.0, "description": "Descripción para puntaje insuficiente"}}
      ]
    }}
  ]
}}"""

        response = self.client.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.5,
                max_output_tokens=1024,
            ),
        )

        raw_text = response.text.strip()
        json_match = re.search(r"\{[\s\S]*\}", raw_text)
        if json_match:
            raw_text = json_match.group(0)

        try:
            data = json.loads(raw_text)
            return data.get("criteria", [])
        except json.JSONDecodeError:
            return [
                {
                    "name": "Criterio General",
                    "levels": [
                        {"points": max_score, "description": "Respuesta correcta y fundamentada"},
                        {"points": 0.0, "description": "Respuesta incorrecta o en blanco"},
                    ],
                }
            ]

