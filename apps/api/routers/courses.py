"""Courses router - CRUD for courses/classes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from database import get_db, current_tenant_id, _is_postgres as _is_pg
from models.db_models import Course, Student, User
from models.schemas import CreateCourseRequest, CourseResponse
from utils.security import verify_tenant_access

router = APIRouter()


@router.post("", response_model=CourseResponse, status_code=201)
async def create_course(
    body: CreateCourseRequest,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Create a new course for the current teacher."""
    course = Course(
        tenant_id=current_tenant_id.get() or current_user.tenant_id,
        name=body.name,
        grade=body.grade,
        subject=body.subject,
        teacher_id=current_user.id,
    )
    db.add(course)
    await db.flush()
    await db.refresh(course)
    return {**course.__dict__, "student_count": 0}


@router.get("", response_model=List[CourseResponse])
async def list_courses(
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """List courses for the current tenant (isolated via search_path)."""
    _tid = current_tenant_id.get() if not _is_pg() else None
    query = select(Course)
    if _tid:
        query = query.where(Course.tenant_id == _tid)
    query = query.order_by(Course.created_at.desc())
    result = await db.execute(query)
    courses = result.scalars().all()

    # Add student count for each course
    response = []
    for course in courses:
        count_result = await db.execute(
            select(func.count(Student.id)).where(Student.course_id == course.id)
        )
        student_count = count_result.scalar() or 0
        course_dict = {k: v for k, v in course.__dict__.items() if not k.startswith("_")}
        course_dict["student_count"] = student_count
        response.append(CourseResponse(**course_dict))
    return response


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Get a single course (isolated via search_path)."""
    _tid = current_tenant_id.get() if not _is_pg() else None
    query = select(Course).where(Course.id == course_id)
    if _tid:
        query = query.where(Course.tenant_id == _tid)
    result = await db.execute(query)
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    count_result = await db.execute(
        select(func.count(Student.id)).where(Student.course_id == course.id)
    )
    student_count = count_result.scalar() or 0
    course_dict = {k: v for k, v in course.__dict__.items() if not k.startswith("_")}
    course_dict["student_count"] = student_count
    return CourseResponse(**course_dict)


@router.delete("/{course_id}")
async def delete_course(
    course_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Delete a course and all its students."""
    _tid = current_tenant_id.get() if not _is_pg() else None
    query = select(Course).where(Course.id == course_id)
    if _tid:
        query = query.where(Course.tenant_id == _tid)
    result = await db.execute(query)
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    await db.delete(course)
    await db.flush()
    return {"message": "Course deleted"}
