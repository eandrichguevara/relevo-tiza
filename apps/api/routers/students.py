"""Students router - CRUD for students."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List

from database import get_db
from models.db_models import Student, Course, User
from models.schemas import CreateStudentRequest, StudentResponse, BulkCreateStudentsRequest, BulkCreateStudentsResponse
from utils.security import verify_tenant_access

router = APIRouter()


@router.post("/course/{course_id}", response_model=BulkCreateStudentsResponse, status_code=201)
async def bulk_create_students(
    course_id: str,
    body: BulkCreateStudentsRequest,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple students at once for a course."""
    # Verify course exists (search_path provides isolation)
    result = await db.execute(
        select(Course).where(Course.id == course_id)
    )
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Get existing students count for this course to avoid code collisions
    count_result = await db.execute(
        select(func.count()).select_from(Student).where(Student.course_id == course_id)
    )
    existing_count = count_result.scalar() or 0

    # Extract prefix from course name
    course_prefix = "XXX"
    if course.name is not None:
        name_str = str(course.name)
        if name_str.strip():
            course_prefix = name_str.strip()[:3].upper()

    students = []
    for i, name in enumerate(body.names):
        # Generate student_code based on existing count + current index
        code_index = existing_count + i + 1
        student_code = f"STU-{course_prefix}-{code_index:03d}"

        student = Student(
            course_id=course_id,
            full_name=name,
            student_code=student_code,
        )
        db.add(student)
        students.append(student)

    try:
        await db.flush()
        for s in students:
            await db.refresh(s)
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Some students could not be created. Check for duplicate student codes or names.",
        )

    return BulkCreateStudentsResponse(
        count=len(students),
        students=students,
    )


@router.get("/course/{course_id}", response_model=List[StudentResponse])
async def list_students(
    course_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """List all students in a course."""
    result = await db.execute(
        select(Course).where(Course.id == course_id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Course not found")

    students_result = await db.execute(
        select(Student).where(Student.course_id == course_id).order_by(Student.full_name)
    )
    return students_result.scalars().all()


@router.delete("/{student_id}")
async def delete_student(
    student_id: str,
    current_user: User = Depends(verify_tenant_access),
    db: AsyncSession = Depends(get_db),
):
    """Delete a student."""
    result = await db.execute(
        select(Student).where(Student.id == student_id)
    )
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    await db.delete(student)
    await db.flush()
    return {"message": "Student deleted"}
