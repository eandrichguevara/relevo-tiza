"""Gemini Flash LLM provider for grading student answers.

Uses Google Gemini (text-only) to grade OCR-extracted answers against
a rubric. Falls back to simulated grading when the API is unavailable.

The existing ``GeminiService`` in ``services/gemini.py`` sends PDF/images
directly to the model. This provider operates on **text only** —
the OCR layer has already extracted the student's handwriting into
a string. This separation keeps the pipeline modular and makes it
easy to swap Gemini for another LLM.
"""
from __future__ import annotations

import json
import math
import re
from typing import Any, List, Optional

from config import settings
from services.llm.provider import LLMProvider, GradingInput, GradingOutput

# ─── Grading prompt (Spanish, Chilean context) ──────────────────────

GRADING_SYSTEM_PROMPT = """Eres un profesor experto chileno corrigiendo evaluaciones escolares.
Tu tarea es leer las respuestas de estudiantes y corregirlas según la rúbrica proporcionada.

Rúbrica de la evaluación:
{rubric_context}

Para cada pregunta, debes devolver un JSON con el siguiente formato exacto:
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
- Si no puedes evaluar la respuesta con seguridad (confidence < {threshold}), marca requires_review = true
- Sé justo pero riguroso en la corrección
- El feedback debe ser constructivo y en español chileno
- Para preguntas de alternativas, usa el criterio proporcionado
- Para preguntas de desarrollo, evalúa según los criterios de la rúbrica
- student_answer debe ser EXACTAMENTE el texto que el estudiante escribió, incluyendo errores
- Si la respuesta está en blanco o es ilegible, score = 0, confidence = 1.0 y student_answer = ""

IMPORTANTE: Responde ÚNICAMENTE con el JSON, sin markdown ni explicaciones adicionales."""


# ─── Simulated fallback (when Gemini is unreachable) ────────────────

_FALLBACK_FEEDBACKS = [
    "La respuesta parece incompleta. Se requiere revisión manual del profesor.",
    "No fue posible determinar la corrección automáticamente. Revisar con el estudiante.",
    "El texto extraído no es claro. El profesor debe evaluar personalmente.",
    "La respuesta está en blanco o es ilegible. Sin puntaje asignado.",
    "Error de conexión con el servicio de IA. Corregir manualmente.",
]


def _simulated_fallback(input: GradingInput) -> GradingOutput:
    """Generate a low-confidence fallback grading result.

    Used when the Gemini API call fails (timeout, auth error, etc.).
    Returns requires_review=True so a human teacher inspects the answer.
    """
    import random as _rnd
    return GradingOutput(
        question_number=input.question_number,
        student_answer=input.student_text,
        score=0.0,
        max_score=input.max_score,
        confidence=0.5,
        requires_review=True,
        ai_feedback=_rnd.choice(_FALLBACK_FEEDBACKS),
    )


# ─── Gemini implementation ──────────────────────────────────────────


class GeminiLLMProvider(LLMProvider):
    """Grades student answers using Google Gemini Flash (text-only).

    Sends OCR-extracted text to Gemini with a Spanish grading prompt.
    The model returns a JSON structure with scores and feedback.

    If the API call fails (network, quota, auth), falls back to a
    simulated result with ``confidence=0.5`` and ``requires_review=True``.
    """

    def __init__(self) -> None:
        self._client = None
        self._api_key = settings.GEMINI_API_KEY
        self.model = settings.GEMINI_MODEL
        self.confidence_threshold = settings.CONFIDENCE_THRESHOLD

    @property
    def _genai_client(self):
        """Lazily initialised Gemini client.

        Delayed creation prevents startup crashes when the API key
        is not yet configured in development.
        """
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=self._api_key)
        return self._client

    def _build_prompt(self, inputs: List[GradingInput], rubric_context: str) -> str:
        """Construct the full prompt with rubric and student answers."""
        def _format_criteria(criteria: Any) -> str:
            """Render criteria block for the LLM prompt.

            Supports:
            - Legacy: string criteria ("Criterio: ...")
            - Legacy: list of {description, score} dicts
            - New: list of {name, levels: [{points, description}]} dicts (multi-level rubric)
            """
            if not criteria:
                return ""

            # --- Single string criterion (legacy) ---
            if isinstance(criteria, str):
                return f"Criterio: {criteria}\n"

            # --- List of criteria ---
            if isinstance(criteria, list):
                if not criteria:
                    return ""

                # Detect new multi-level format: {name, levels}
                first = criteria[0] if isinstance(criteria[0], dict) else {}
                if "name" in first and "levels" in first:
                    parts = ["Criterios:"]
                    for c in criteria:
                        name = c.get("name", "Criterio")
                        parts.append(f"\n{name}:")
                        for level in c.get("levels", []):
                            pts = level.get("points", 0)
                            desc = level.get("description", "")
                            parts.append(f"  {pts} pts — {desc}")
                        levels = c.get("levels", [])
                        if levels:
                            max_pts = max(l.get("points", 0) for l in levels)
                            parts.append(f"  (Máximo: {max_pts} pts)")
                    return "\n".join(parts) + "\n"

                # Legacy format: list of {description, score}
                lines = ["Criterios:"]
                for c in criteria:
                    desc = c.get("description", "")
                    score = c.get("score", 0)
                    lines.append(f"  - {desc}: {score} pts")
                return "\n".join(lines) + "\n"

            # --- Single criterion dict ---
            if isinstance(criteria, dict):
                if "name" in criteria and "levels" in criteria:
                    name = criteria.get("name", "Criterio")
                    parts = [f"Criterio — {name}:"]
                    for level in criteria.get("levels", []):
                        pts = level.get("points", 0)
                        desc = level.get("description", "")
                        parts.append(f"  {pts} pts — {desc}")
                    return "\n".join(parts) + "\n"
                desc = criteria.get("description", "")
                score = criteria.get("score", 0)
                return f"Criterio: {desc} ({score} pts)\n"

            return ""

        answers_section = "\n".join(
            f"Pregunta {i.question_number} (tipo: {i.question_type}, puntaje máximo: {i.max_score}):\n"
            f"Texto del estudiante: \"{i.student_text}\"\n"
            + _format_criteria(i.criteria)
            for i in inputs
        )

        prompt = f"""{GRADING_SYSTEM_PROMPT.format(
            rubric_context=rubric_context,
            threshold=self.confidence_threshold,
        )}

Responde ÚNICAMENTE con el JSON para las siguientes preguntas:

{answers_section}"""
        return prompt

    async def grade_answer(
        self,
        input: GradingInput,
        rubric_context: str,
    ) -> GradingOutput:
        """Grade a single student answer."""
        results = await self.grade_batch([input], rubric_context)
        return results[0]

    async def grade_batch(
        self,
        inputs: List[GradingInput],
        rubric_context: str,
    ) -> List[GradingOutput]:
        """Grade multiple answers in one Gemini call."""
        prompt = self._build_prompt(inputs, rubric_context)

        try:
            from google.genai import types

            response = self._genai_client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=4096,
                ),
            )

            raw_text = response.text.strip() if response.text else ""
            if not raw_text:
                return [self._fallback_for(i, ValueError("Empty response"))
                        for i in inputs]
            return self._parse_response(raw_text, inputs)

        except Exception as exc:
            # Log could be added here in production
            return [self._fallback_for(i, exc) for i in inputs]

    def _parse_response(
        self,
        raw_text: str,
        inputs: List[GradingInput],
    ) -> List[GradingOutput]:
        """Extract JSON from Gemini response and map to GradingOutput list."""
        json_match = re.search(r"\{[\s\S]*\}", raw_text)
        if json_match:
            raw_text = json_match.group(0)

        try:
            data = json.loads(raw_text)
            answers = data.get("answers", [])
        except (json.JSONDecodeError, KeyError, TypeError):
            return [self._fallback_for(i, ValueError("Invalid JSON response"))
                    for i in inputs]

        # Build a lookup by question_number
        answer_map: dict[int, dict] = {}
        for a in answers:
            qn = a.get("question_number")
            if qn is not None:
                answer_map[int(qn)] = a

        results: List[GradingOutput] = []
        for inp in inputs:
            raw = answer_map.get(inp.question_number)
            if raw is None:
                results.append(self._fallback_for(
                    inp, KeyError(f"No answer for question {inp.question_number}")
                ))
                continue

            score = float(raw.get("score", 0))
            confidence = float(raw.get("confidence", 0.5))
            requires_review = (
                raw.get("requires_review", False)
                or confidence < self.confidence_threshold
            )

            results.append(GradingOutput(
                question_number=inp.question_number,
                student_answer=raw.get("student_answer", inp.student_text),
                score=min(score, inp.max_score),  # clamp to max
                max_score=inp.max_score,
                confidence=confidence,
                requires_review=requires_review,
                ai_feedback=raw.get("ai_feedback", ""),
            ))

        return results

    def _fallback_for(
        self,
        input: GradingInput,
        exception: Optional[Exception] = None,
    ) -> GradingOutput:
        """Generate a fallback output when Gemini fails."""
        _ = exception  # available for logging in the future
        if not input.student_text.strip():
            # Blank answer — no need for review
            return GradingOutput(
                question_number=input.question_number,
                student_answer="",
                score=0.0,
                max_score=input.max_score,
                confidence=1.0,
                requires_review=False,
                ai_feedback="El estudiante no respondió esta pregunta.",
            )
        return _simulated_fallback(input)
