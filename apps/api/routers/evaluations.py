"""Evaluations router - CRUD, upload, processing."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional

from database import get_db, current_tenant_id
from models.db_models import Evaluation, User, Course, Student
from models.schemas import CreateEvaluationRequest, EvaluationResponse
from utils.security import verify_tenant_access
from services.gemini import GeminiService
from services.pdf import generate_evaluation_pdf
from services.pipeline import pipeline as ai_pipeline

router = APIRouter()
gemini_service = GeminiService()


@router.post("", response_model=EvaluationResponse, status_code=201)
async def create_evaluation(
    body: CreateEvaluationRequest,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Create a new evaluation with rubric."""
    evaluation = Evaluation(
        title=body.title,
        subject=body.subject,
        grade=body.grade,
        rubric=[item.model_dump() for item in body.rubric],
        status="pending",
    )
    db.add(evaluation)
    await db.flush()
    await db.refresh(evaluation)
    return evaluation


@router.get("", response_model=List[EvaluationResponse])
async def list_evaluations(
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """List evaluations for the current tenant (isolated via search_path).
    Excludes soft-deleted evaluations."""
    query = select(Evaluation).where(Evaluation.deleted_at.is_(None))
    if status:
        query = query.where(Evaluation.status == status)
    query = (
        query.order_by(Evaluation.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{evaluation_id}", response_model=EvaluationResponse)
async def get_evaluation(
    evaluation_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Get a single evaluation by ID (isolated via search_path). Excludes soft-deleted."""
    result = await db.execute(
        select(Evaluation).where(Evaluation.id == evaluation_id, Evaluation.deleted_at.is_(None))
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")
    return evaluation


@router.get("/{evaluation_id}/pdf")
async def generate_pdf(
    evaluation_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Generate a printable PDF for the evaluation."""
    result = await db.execute(
        select(Evaluation).where(Evaluation.id == evaluation_id, Evaluation.deleted_at.is_(None))
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    pdf_buffer = generate_evaluation_pdf(evaluation)
    evaluation.pdf_url = f"/api/evaluations/{evaluation_id}/pdf"
    evaluation.status = "processing"
    await db.flush()

    from fastapi.responses import StreamingResponse

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={evaluation.title.encode('ascii', 'replace').decode()}.pdf"
        },
    )


@router.post("/{evaluation_id}/process")
async def process_scanned(
    evaluation_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Upload and process a scanned evaluation PDF."""
    result = await db.execute(
        select(Evaluation).where(Evaluation.id == evaluation_id, Evaluation.deleted_at.is_(None))
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    # Process with Gemini
    contents = await file.read()
    processing_results = await gemini_service.process_evaluation(
        evaluation, contents
    )

    # Store results
    from models.db_models import Result

    for res_data in processing_results:
        db_result = Result(
            evaluation_id=evaluation.id,
            student_code=res_data["student_code"],
            answers=res_data["answers"],
            confidence=res_data["confidence"],
            requires_review=res_data["requires_review"],
            status=(
                "corrected"
                if not res_data["requires_review"]
                else "requires_review"
            ),
        )
        db.add(db_result)

    evaluation.status = "completed"
    await db.flush()

    return {"message": "Procesamiento completado", "results_count": len(processing_results)}


@router.delete("/{evaluation_id}")
async def delete_evaluation(
    evaluation_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete an evaluation. Sets deleted_at instead of removing from DB."""
    result = await db.execute(
        select(Evaluation).where(Evaluation.id == evaluation_id, Evaluation.deleted_at.is_(None))
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    evaluation.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Evaluación eliminada (soft delete)"}


@router.get("/{evaluation_id}/answer-sheet/{course_id}")
async def generate_answer_sheet(
    evaluation_id: str,
    course_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Generate answer sheets for all students in a course."""
    from services.pdf import generate_answer_sheet_pdf

    eval_result = await db.execute(
        select(Evaluation).where(Evaluation.id == evaluation_id, Evaluation.deleted_at.is_(None))
    )
    evaluation = eval_result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    course_result = await db.execute(
        select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    )
    course = course_result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    students_result = await db.execute(
        select(Student).where(Student.course_id == course_id, Student.deleted_at.is_(None)).order_by(Student.full_name)
    )
    students = students_result.scalars().all()

    if not students:
        raise HTTPException(status_code=400, detail="No hay estudiantes en este curso. Agrega estudiantes primero.")

    pdf_buffer = generate_answer_sheet_pdf(course.name, evaluation.title, students)

    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=answer_sheet_{course.name.encode('ascii', 'replace').decode()}.pdf"}
    )


@router.post("/{evaluation_id}/simulate/{course_id}")
async def simulate_answers(
    evaluation_id: str,
    course_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Simulate student answers for a course evaluation (for demo/testing)."""
    from models.db_models import Result as ResultModel
    import random

    eval_result = await db.execute(
        select(Evaluation).where(Evaluation.id == evaluation_id, Evaluation.deleted_at.is_(None))
    )
    evaluation = eval_result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    course_result = await db.execute(
        select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    )
    if not course_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    students_result = await db.execute(
        select(Student).where(Student.course_id == course_id, Student.deleted_at.is_(None))
    )
    students = students_result.scalars().all()

    if not students:
        raise HTTPException(status_code=400, detail="No hay estudiantes en el curso")

    rubric = evaluation.rubric if isinstance(evaluation.rubric, list) else []
    results_created = []

    for student in students:
        answers = []
        total_score = 0
        max_score_total = 0

        for item in rubric:
            max_score = float(item.get("max_score", 5))
            # Simulate a score (student gets 40-100% of max)
            score = round(random.uniform(max_score * 0.4, max_score), 1)
            confidence = random.uniform(0.6, 1.0)

            answers.append({
                "question_number": item.get("question_number", 0),
                "student_answer": f"Respuesta simulada de {student.full_name} para pregunta {item.get('question_number', '?')}",
                "score": score,
                "max_score": max_score,
                "confidence": confidence,
                "requires_review": confidence < 0.65,
                "ai_feedback": "Respuesta correcta. Bien argumentada." if score > max_score * 0.7 else "Requiere mejorar la argumentación.",
            })
            total_score += score
            max_score_total += max_score

        avg_confidence = sum(a["confidence"] for a in answers) / len(answers)
        final_grade = round((total_score / max_score_total) * 7.0, 1) if max_score_total > 0 else 0

        result = ResultModel(
            evaluation_id=evaluation.id,
            student_code=student.student_code,
            answers=answers,
            confidence=avg_confidence,
            requires_review=avg_confidence < 0.65,
            final_grade=final_grade,
            status="corrected" if not (avg_confidence < 0.65) else "requires_review",
        )
        db.add(result)
        results_created.append({
            "student_code": student.student_code,
            "full_name": student.full_name,
            "grade": final_grade,
            "confidence": round(avg_confidence, 2),
        })

    evaluation.status = "completed"
    await db.flush()

    await db.commit()

    return {
        "message": f"Respuestas simuladas para {len(students)} estudiantes",
        "evaluation_id": evaluation.id,
        "course_id": course_id,
        "generated": len(results_created),
        "results": results_created,
    }


# ─── Async Pipeline Endpoints ───────────────────────────────────────


@router.post("/{evaluation_id}/process-async")
async def process_scanned_async(
    evaluation_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Upload a scanned PDF and process asynchronously via the AI pipeline.

    Returns a job_id immediately. Poll GET /api/evaluations/{id}/status
    to check progress. The pipeline runs OCR + LLM grading in the background.
    The sync POST /{id}/process endpoint is still available for direct use.
    """
    result = await db.execute(
        select(Evaluation).where(Evaluation.id == evaluation_id, Evaluation.deleted_at.is_(None))
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    contents = await file.read()

    # Process via the async pipeline (saves to storage, enqueues, updates status)
    job_id = await ai_pipeline.process_evaluation(
        evaluation_id=evaluation.id,
        tenant_id=current_tenant_id.get(),
        rubric=evaluation.rubric if isinstance(evaluation.rubric, list) else [],
        pdf_bytes=contents,
        db_session=db,
    )

    await db.commit()

    return {
        "job_id": job_id,
        "status": "processing",
        "message": "Evaluación encolada para procesamiento con IA",
        "poll_url": f"/api/evaluations/{evaluation_id}/status",
    }


@router.get("/{evaluation_id}/status")
async def get_processing_status(
    evaluation_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Get the current processing status of an evaluation.

    Returns the evaluation status + a summary of results if complete.
    Use this for polling after submitting via process-async.
    """
    result = await db.execute(
        select(Evaluation).where(Evaluation.id == evaluation_id, Evaluation.deleted_at.is_(None))
    )
    evaluation = result.scalar_one_or_none()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluación no encontrada")

    # Count results
    from models.db_models import Result
    results_count = await db.execute(
        select(func.count(Result.id)).where(Result.evaluation_id == evaluation_id)
    )
    count = results_count.scalar() or 0

    return {
        "evaluation_id": evaluation_id,
        "status": evaluation.status,
        "title": evaluation.title,
        "results_count": count,
    }
