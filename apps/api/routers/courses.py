"""Courses router - CRUD for courses/classes."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from database import get_db, current_tenant_id
from models.db_models import Course, CourseTeacher, Student, User
from models.schemas import CreateCourseRequest, CourseResponse, SubjectEnum
from utils.security import verify_tenant_access, require_role

router = APIRouter()


@router.post("", response_model=CourseResponse, status_code=201)
async def create_course(
    body: CreateCourseRequest,
    current_user: User = Depends(require_role("HOLDER")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new course with per-subject teachers. Only HOLDER/ADMIN can create courses."""
    tid = current_tenant_id.get()
    if not tid:
        raise HTTPException(status_code=400, detail="Contexto de colegio no disponible")

    # Ensure subject list matches teachers dict keys (data integrity)
    course_subjects = set(s.strip() for s in body.subject.split(","))
    teacher_subjects = set(body.teachers.keys())
    if course_subjects != teacher_subjects:
        raise HTTPException(
            status_code=400,
            detail=f"Las asignaturas del curso ({', '.join(sorted(course_subjects))}) "
                   f"deben coincidir con los profesores asignados ({', '.join(sorted(teacher_subjects))})",
        )

    # Validate each teacher exists, is active TEACHER, and belongs to current tenant
    for subject, teacher_id in body.teachers.items():
        teacher_result = await db.execute(
            select(User).where(
                User.id == teacher_id,
                User.role == "TEACHER",
                User.status == "active",
                User.tenant_id == tid,
            )
        )
        if not teacher_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail=f"Profesor no encontrado para {subject}")

    course = Course(
        name=body.name,
        grade=body.grade,
        subject=body.subject,
    )
    db.add(course)
    await db.flush()
    await db.refresh(course)

    # Insert per-subject teacher assignments
    for subject, teacher_id in body.teachers.items():
        ct = CourseTeacher(course_id=course.id, subject=subject, teacher_id=teacher_id)
        db.add(ct)
    await db.flush()

    return {**course.__dict__, "teachers": dict(body.teachers), "student_count": 0}


@router.get("/subjects")
async def list_subjects():
    """Return the list of available subjects (coincide con SUBJECTS del frontend relevo-web)."""
    return {"subjects": [s.value for s in SubjectEnum]}


@router.get("", response_model=List[CourseResponse])
async def list_courses(
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """List courses for the current tenant (isolated via search_path).
    Excludes soft-deleted courses."""
    query = (
        select(Course)
        .where(Course.deleted_at.is_(None))
        .order_by(Course.created_at.desc())
    )
    result = await db.execute(query)
    courses = result.scalars().all()

    # Add student count and teachers dict for each course
    response = []
    for course in courses:
        count_result = await db.execute(
            select(func.count(Student.id)).where(Student.course_id == course.id)
        )
        student_count = count_result.scalar() or 0

        # Build teachers dict from course_teachers
        ct_result = await db.execute(
            select(CourseTeacher).where(CourseTeacher.course_id == course.id)
        )
        teachers = {ct.subject: ct.teacher_id for ct in ct_result.scalars().all()}

        course_dict = {k: v for k, v in course.__dict__.items() if not k.startswith("_")}
        course_dict["student_count"] = student_count
        course_dict["teachers"] = teachers
        response.append(CourseResponse(**course_dict))
    return response


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Get a single course (isolated via search_path). Excludes soft-deleted."""
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    count_result = await db.execute(
        select(func.count(Student.id)).where(Student.course_id == course.id)
    )
    student_count = count_result.scalar() or 0

    # Build teachers dict from course_teachers
    ct_result = await db.execute(
        select(CourseTeacher).where(CourseTeacher.course_id == course.id)
    )
    teachers = {ct.subject: ct.teacher_id for ct in ct_result.scalars().all()}

    course_dict = {k: v for k, v in course.__dict__.items() if not k.startswith("_")}
    course_dict["student_count"] = student_count
    course_dict["teachers"] = teachers
    return CourseResponse(**course_dict)


@router.delete("/{course_id}")
async def delete_course(
    course_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a course. Sets deleted_at instead of removing from DB."""
    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    course.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    return {"message": "Curso eliminado (soft delete)"}
