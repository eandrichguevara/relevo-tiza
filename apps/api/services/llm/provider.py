"""Abstract LLM provider interface and data types for grading.

Defines the contract that all LLM grading backends must implement.
Each provider grades one or more student answers against a rubric.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class GradingInput:
    """Input for grading a single student answer.

    Attributes:
        question_number: The question number in the evaluation.
        student_text: The OCR-extracted text of the student's answer.
        max_score: The maximum possible score for this question.
        criteria: Optional grading criteria or expected answer.
        question_type: Either ``"written"`` or ``"multiple_choice"``.
    """
    question_number: int
    student_text: str
    max_score: float
    criteria: Optional[str] = None
    question_type: str = "written"


@dataclass
class GradingOutput:
    """Result of grading a single answer.

    Attributes:
        question_number: The question number this output corresponds to.
        student_answer: The exact student answer text (passthrough from OCR).
        score: The numeric score assigned by the LLM.
        max_score: The maximum possible score for this question.
        confidence: LLM confidence in its grading (0.0 — 1.0).
        requires_review: Whether a human teacher should review this answer.
        ai_feedback: Pedagogical feedback text for the student (in Spanish).
    """
    question_number: int
    student_answer: str
    score: float
    max_score: float
    confidence: float
    requires_review: bool
    ai_feedback: str


class LLMProvider(ABC):
    """Abstract base for all LLM grading backends.

    Subclasses must implement single-answer and batch grading.
    The batch method may call the single method in a loop or use
    a native batch API for efficiency.
    """

    @abstractmethod
    async def grade_answer(
        self,
        input: GradingInput,
        rubric_context: str,
    ) -> GradingOutput:
        """Grade a single student answer against the rubric.

        Args:
            input: The question, student text, max score, and criteria.
            rubric_context: The full rubric text for context.

        Returns:
            A GradingOutput with score, confidence, and feedback.
        """
        ...

    @abstractmethod
    async def grade_batch(
        self,
        inputs: List[GradingInput],
        rubric_context: str,
    ) -> List[GradingOutput]:
        """Grade multiple answers in a single batch call.

        Args:
            inputs: A list of GradingInput instances.
            rubric_context: The full rubric text for context.

        Returns:
            A list of GradingOutput in the same order as the inputs.
        """
        ...
