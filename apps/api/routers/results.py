"""Results router - get, review, generate reports."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from database import get_db
from models.db_models import Result, Evaluation, User
from models.schemas import ResultResponse, ReviewRequest
from utils.security import get_current_user
from services.pdf import generate_result_report_pdf

router = APIRouter()


@router.get("/evaluation/{evaluation_id}", response_model=List[ResultResponse])
async def list_results(
    evaluation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all results for an evaluation."""
    eval_result = await db.execute(
        select(Evaluation).where(
            Evaluation.id == evaluation_id,
            Evaluation.tenant_id == current_user.tenant_id,
        )
    )
    evaluation = eval_result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    results = await db.execute(
        select(Result).where(Result.evaluation_id == evaluation_id)
    )
    return results.scalars().all()


@router.get("/pending-review", response_model=List[ResultResponse])
async def get_pending_reviews(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all results pending teacher review for the current tenant."""
    res = await db.execute(
        select(Result)
        .join(Evaluation)
        .where(
            Evaluation.tenant_id == current_user.tenant_id,
            Result.requires_review == True,
            Result.status == "requires_review",
        )
        .order_by(Result.created_at.desc())
        .limit(50)
    )
    return res.scalars().all()


@router.get("/{result_id}", response_model=ResultResponse)
async def get_result(
    result_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single result."""
    res = await db.execute(
        select(Result)
        .join(Evaluation)
        .where(
            Result.id == result_id,
            Evaluation.tenant_id == current_user.tenant_id,
        )
    )
    result = res.scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    return result


@router.post("/{result_id}/review", response_model=ResultResponse)
async def review_result(
    result_id: str,
    body: ReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Teacher reviews and corrects AI grading."""
    res = await db.execute(
        select(Result)
        .join(Evaluation)
        .where(
            Result.id == result_id,
            Evaluation.tenant_id == current_user.tenant_id,
        )
    )
    result = res.scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    # Apply corrections
    answers = result.answers if isinstance(result.answers, list) else []
    for correction in body.corrections:
        q_num = correction.get("question_number")
        for answer in answers:
            if answer.get("question_number") == q_num:
                answer["teacher_score"] = correction.get(
                    "teacher_score", answer["score"]
                )
                answer["teacher_correction"] = correction.get(
                    "teacher_correction", ""
                )
                answer["requires_review"] = False

    result.answers = answers
    result.requires_review = False
    result.status = "reviewed"

    # Recalculate final grade
    total_score = sum(
        a.get("teacher_score", a.get("score", 0)) for a in answers
    )
    max_score = sum(a.get("max_score", 0) for a in answers)
    result.final_grade = (total_score / max_score * 7.0) if max_score > 0 else 0

    await db.flush()
    await db.refresh(result)
    return result


@router.get("/{result_id}/report")
async def generate_report(
    result_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a PDF report for a student result."""
    res = await db.execute(
        select(Result)
        .join(Evaluation)
        .where(
            Result.id == result_id,
            Evaluation.tenant_id == current_user.tenant_id,
        )
    )
    result = res.scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")

    pdf_buffer = generate_result_report_pdf(result)

    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=report_{result.student_code}.pdf"
        },
    )
