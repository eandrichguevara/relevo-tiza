"""Evaluation pipeline — orchestrates OCR + LLM + Queue + Storage.

Flow:
    PDF upload → Storage → Queue → PDF download → Image conversion
    → OCR (preprocess + extract text) → LLM grading → DB save

The pipeline runs asynchronously via the in-memory queue. Each stage
is pluggable so real and simulated providers are interchangeable.
"""
from __future__ import annotations

import io
import json
import logging
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import async_session, set_tenant_search_path
from models.db_models import Evaluation, Result
from services.evaluation import EvaluationService
from services.llm import create_llm_provider
from services.llm.provider import GradingInput
from services.ocr import create_ocr_provider
from services.ocr.provider import OCRResult
from services.queue import queue
from services.storage import storage

logger = logging.getLogger(__name__)


class EvaluationPipeline:
    """Orchestrates the end-to-end evaluation processing pipeline.

    Usage:
        pipeline = EvaluationPipeline()
        job_id = await pipeline.process_evaluation(
            evaluation_id="...",
            tenant_id="...",
            rubric=[...],
            pdf_bytes=b"...",
            db_session=session,
        )
    """

    def __init__(self) -> None:
        self.ocr = create_ocr_provider()
        self.llm = create_llm_provider()
        self.eval_service = EvaluationService()

        # Register the pipeline handler with the queue
        queue.register_handler("process_evaluation", self._run_pipeline)

    async def process_evaluation(
        self,
        evaluation_id: str,
        tenant_id: str,
        rubric: List[Dict[str, Any]],
        pdf_bytes: bytes,
        db_session: AsyncSession,
    ) -> str:
        """Entry point: save PDF, enqueue, update status, return job_id.

        Args:
            evaluation_id: The evaluation's UUID.
            tenant_id: The tenant (school) owning this evaluation.
            rubric: The evaluation rubric as a list of question dicts.
            pdf_bytes: Raw PDF file contents.
            db_session: An active SQLAlchemy session (caller commits).

        Returns:
            The job ID so the caller can track progress via the queue.
        """
        # 1. Save PDF to storage
        pdf_key = f"evaluations/{tenant_id}/{evaluation_id}.pdf"
        await storage.ensure_bucket(settings.S3_BUCKET_EVALUATIONS)
        pdf_url = await storage.upload(
            bucket=settings.S3_BUCKET_EVALUATIONS,
            key=pdf_key,
            data=pdf_bytes,
            content_type="application/pdf",
        )

        # 2. Persist PDF URL on the evaluation record
        eval_obj = await db_session.get(Evaluation, evaluation_id)
        if eval_obj:
            eval_obj.pdf_url = pdf_url
            eval_obj.status = "pending"

        # 3. Enqueue processing job
        payload = {
            "evaluation_id": evaluation_id,
            "tenant_id": tenant_id,
            "pdf_key": pdf_key,
            "rubric": rubric,
        }
        job_id = await queue.enqueue("process_evaluation", payload)

        # 4. Update status to processing
        if eval_obj:
            eval_obj.status = "processing"
            await db_session.flush()

        logger.info(
            "Enqueued evaluation %s (job %s) for tenant %s",
            evaluation_id, job_id, tenant_id,
        )
        return job_id

    async def _run_pipeline(self, payload: Dict[str, Any]) -> None:
        """Execute the full pipeline: PDF → image → OCR → LLM → DB.

        This method is registered as the queue handler for
        ``process_evaluation`` jobs.

        Args:
            payload: Must contain ``evaluation_id``, ``tenant_id``,
                ``pdf_key``, and ``rubric``.
        """
        evaluation_id = payload["evaluation_id"]
        tenant_id = payload["tenant_id"]
        pdf_key = payload["pdf_key"]
        rubric = payload["rubric"]

        async with async_session() as db:
            try:
                # Set search_path for schema-per-tenant isolation
                await set_tenant_search_path(db, tenant_id)

                await self._process_internal(
                    evaluation_id, tenant_id, pdf_key, rubric, db,
                )
                await db.commit()
            except Exception:
                await db.rollback()
                # Mark evaluation as failed
                eval_obj = await db.get(Evaluation, evaluation_id)
                if eval_obj:
                    eval_obj.status = "failed"
                await db.commit()
                logger.exception(
                    "Pipeline failed for evaluation %s", evaluation_id,
                )
                raise

    async def _process_internal(
        self,
        evaluation_id: str,
        tenant_id: str,
        pdf_key: str,
        rubric: List[Dict[str, Any]],
        db: AsyncSession,
    ) -> None:
        """Internal pipeline logic with an active DB session."""
        # 1. Download PDF from storage
        logger.info("Downloading PDF %s for evaluation %s", pdf_key, evaluation_id)
        pdf_bytes = await storage.download(
            bucket=settings.S3_BUCKET_EVALUATIONS,
            key=pdf_key,
        )

        # 2. Convert first page of PDF to PIL Image
        logger.info("Converting PDF to image for evaluation %s", evaluation_id)
        page_image = await self._pdf_to_image(pdf_bytes)

        # 3. OCR: preprocess page and extract text per crop
        logger.info("Running OCR on evaluation %s", evaluation_id)
        layout = await self.ocr.preprocess_page(page_image)

        # Map crops → OCR results, one per rubric item
        ocr_results: List[OCRResult] = []
        for i, crop in enumerate(layout.crops):
            if i >= len(rubric):
                break  # no more questions
            result = await self.ocr.extract_text(crop)
            ocr_results.append(result)

        # 4. LLM: grade answers using OCR text
        logger.info("Grading %d answers with LLM for evaluation %s", len(ocr_results), evaluation_id)
        rubric_context = json.dumps(rubric, indent=2, ensure_ascii=False)

        grading_inputs: List[GradingInput] = []
        for i, ocr_res in enumerate(ocr_results):
            if i >= len(rubric):
                break
            item = rubric[i]
            grading_inputs.append(GradingInput(
                question_number=item.get("question_number", i + 1),
                student_text=ocr_res.text,
                max_score=float(item.get("max_score", 5)),
                criteria=item.get("criteria") or item.get("correct_answer"),
                question_type=item.get("type", "written"),
            ))

        grading_outputs = await self.llm.grade_batch(grading_inputs, rubric_context)

        # 5. Build and save Result
        answers_data = []
        total_confidence = 0.0
        any_review = False

        for g in grading_outputs:
            answers_data.append({
                "question_number": g.question_number,
                "student_answer": g.student_answer,
                "score": g.score,
                "max_score": g.max_score,
                "confidence": g.confidence,
                "requires_review": g.requires_review,
                "ai_feedback": g.ai_feedback,
            })
            total_confidence += g.confidence
            if g.requires_review:
                any_review = True

        avg_confidence = round(
            total_confidence / len(grading_outputs), 2
        ) if grading_outputs else 0.0

        final_grade = await self.eval_service.calculate_result_grade(answers_data)

        result = Result(
            evaluation_id=evaluation_id,
            student_code=layout.student_code or "STUDENT-001",
            answers=answers_data,
            confidence=avg_confidence,
            requires_review=any_review,
            final_grade=final_grade,
            status="requires_review" if any_review else "corrected",
        )
        db.add(result)

        # 6. Update evaluation status
        eval_obj = await db.get(Evaluation, evaluation_id)
        if eval_obj:
            eval_obj.status = "completed"

        logger.info(
            "Evaluation %s completed: grade=%.1f, confidence=%.2f, review=%s",
            evaluation_id, final_grade, avg_confidence, any_review,
        )

    # ── Helpers ──────────────────────────────────────────────────────

    @staticmethod
    async def _pdf_to_image(pdf_bytes: bytes) -> "Image.Image":
        """Convert first page of a PDF to a PIL Image.

        Uses ``pdf2image`` which wraps ``pdftoppm`` (poppler-utils).

        Raises:
            RuntimeError: If pdf2image is not installed or poppler
                is not available.
        """
        try:
            from pdf2image import convert_from_bytes
        except ImportError:
            raise RuntimeError(
                "pdf2image is required. Install with: pip install pdf2image"
            )

        images = convert_from_bytes(
            pdf_bytes,
            first_page=1,
            last_page=1,
            fmt="jpeg",
            dpi=200,
        )
        if not images:
            raise RuntimeError("PDF conversion produced no images")
        return images[0]


# ─── Module-level singleton ─────────────────────────────────────────

_pipeline_instance: Optional[EvaluationPipeline] = None


def get_pipeline() -> EvaluationPipeline:
    """Return the pipeline singleton.

    The singleton pattern is safe because the pipeline is stateless;
    all providers (OCR, LLM, queue, storage) manage their own state.
    """
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = EvaluationPipeline()
    return _pipeline_instance


pipeline: EvaluationPipeline = get_pipeline()
