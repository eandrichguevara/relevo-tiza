"""Evaluation service - business logic for evaluation processing."""
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from models.db_models import Evaluation, Result
from services.gemini import GeminiService


class EvaluationService:
    """Service for evaluation business logic."""

    def __init__(self):
        self.gemini = GeminiService()

    async def calculate_result_grade(self, answers: List[Dict]) -> float:
        """Calculate final grade from answers using Chilean scale (1-7)."""
        total_score = sum(
            a.get("teacher_score", a.get("score", 0)) for a in answers
        )
        max_score = sum(a.get("max_score", 0) for a in answers)
        if max_score == 0:
            return 0.0
        return round((total_score / max_score) * 7.0, 1)

    async def get_processing_stats(
        self, evaluation_id: str, db: AsyncSession
    ) -> Dict[str, int]:
        """Get processing statistics for an evaluation."""
        from sqlalchemy import select, func

        total_query = await db.execute(
            select(func.count(Result.id)).where(
                Result.evaluation_id == evaluation_id
            )
        )
        pending_query = await db.execute(
            select(func.count(Result.id)).where(
                Result.evaluation_id == evaluation_id,
                Result.requires_review == True,
            )
        )
        return {
            "total": total_query.scalar() or 0,
            "pending_review": pending_query.scalar() or 0,
        }
