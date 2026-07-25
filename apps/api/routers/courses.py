"""Courses router - CRUD for courses/classes."""
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from typing import List

from database import get_db, current_tenant_id
from models.db_models import Course, CourseTeacher, Student, User
from models.schemas import CreateCourseRequest, UpdateCourseRequest, CourseResponse, SubjectEnum, TeacherClassResponse
from utils.security import verify_tenant_access, require_role

router = APIRouter()


@router.post("", response_model=CourseResponse, status_code=201)
async def create_course(
    body: CreateCourseRequest,
    current_user: User = Depends(require_role("GESTION")),
    db: AsyncSession = Depends(get_db),
):
    """Create a new course with per-subject teachers. Only GESTION/ADMIN can create courses."""
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


@router.get("/my-classes", response_model=List[TeacherClassResponse])
async def list_my_classes(
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Return course-subject pairs where the current teacher is assigned.
    
    For each CourseTeacher entry where teacher_id matches the current user,
    returns the course details and the single subject they teach.
    """
    # If user is not a TEACHER, return empty list
    if current_user.role != "TEACHER":
        return []

    # Query CourseTeacher for this teacher
    ct_result = await db.execute(
        select(CourseTeacher).where(CourseTeacher.teacher_id == current_user.id)
    )
    assignments = ct_result.scalars().all()

    if not assignments:
        return []

    # Get all referenced course IDs
    course_ids = list({a.course_id for a in assignments})

    # Fetch courses
    courses_result = await db.execute(
        select(Course).where(Course.id.in_(course_ids), Course.deleted_at.is_(None))
    )
    courses = {c.id: c for c in courses_result.scalars().all()}

    # Build response
    response = []
    for a in assignments:
        course = courses.get(a.course_id)
        if not course:
            continue

        # Count students for this course
        count_result = await db.execute(
            select(func.count(Student.id)).where(
                Student.course_id == course.id,
                Student.deleted_at.is_(None)
            )
        )
        student_count = count_result.scalar() or 0

        response.append(TeacherClassResponse(
            course_id=course.id,
            course_name=course.name,
            subject=a.subject,
            grade=course.grade,
            student_count=student_count,
        ))

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


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: str,
    body: UpdateCourseRequest,
    current_user: User = Depends(require_role("GESTION")),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing course. Only GESTION/ADMIN can edit courses."""
    tid = current_tenant_id.get()
    if not tid:
        raise HTTPException(status_code=400, detail="Contexto de colegio no disponible")

    result = await db.execute(
        select(Course).where(Course.id == course_id, Course.deleted_at.is_(None))
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Curso no encontrado")

    if body.name is not None:
        course.name = body.name
    if body.grade is not None:
        course.grade = body.grade
    if body.subject is not None:
        course.subject = body.subject

    if body.teachers is not None:
        course_subjects = set(s.strip() for s in course.subject.split(","))
        teacher_subjects = set(body.teachers.keys())
        if course_subjects != teacher_subjects:
            raise HTTPException(
                status_code=400,
                detail=f"Las asignaturas del curso ({', '.join(sorted(course_subjects))}) "
                       f"deben coincidir con los profesores asignados ({', '.join(sorted(teacher_subjects))})",
            )

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

        # Remove existing teacher assignments
        await db.execute(
            delete(CourseTeacher).where(CourseTeacher.course_id == course.id)
        )

        # Insert new teacher assignments
        for subject, teacher_id in body.teachers.items():
            ct = CourseTeacher(course_id=course.id, subject=subject, teacher_id=teacher_id)
            db.add(ct)

    course.updated_at = datetime.now(timezone.utc)
    await db.flush()

    count_result = await db.execute(
        select(func.count(Student.id)).where(Student.course_id == course.id)
    )
    student_count = count_result.scalar() or 0

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

