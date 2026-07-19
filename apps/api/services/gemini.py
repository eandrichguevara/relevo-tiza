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
