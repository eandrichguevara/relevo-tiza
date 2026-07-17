"""Dashboard stats router - teacher and executive views."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from datetime import datetime, timedelta, timezone

from database import get_db, current_tenant_id, _is_postgres as _is_pg
from models.db_models import Evaluation, Result, User, Course, Student, Tenant, TenantMember
from models.schemas import DashboardStatsResponse, MacroStatsResponse
from utils.security import get_current_user, require_role

router = APIRouter()


@router.get("/teacher", response_model=DashboardStatsResponse)
async def teacher_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get teacher dashboard stats (isolated via search_path)."""
    # On SQLite, search_path is a no-op — add explicit tenant_id filter
    _tid = current_tenant_id.get() if not _is_pg() else None

    # Total evaluations (scoped by search_path)
    total_eval_q = select(func.count(Evaluation.id))
    if _tid:
        total_eval_q = total_eval_q.where(Evaluation.tenant_id == _tid)
    total_eval = await db.execute(total_eval_q)
    total_evaluations = total_eval.scalar() or 0

    # Total results (students) — join Evaluation in same schema
    total_res_q = select(func.count(Result.id))
    if _tid:
        total_res_q = total_res_q.join(
            Evaluation, Result.evaluation_id == Evaluation.id
        ).where(Evaluation.tenant_id == _tid)
    total_res = await db.execute(total_res_q)
    total_students = total_res.scalar() or 0

    # Average grade
    avg_grade_q = select(func.avg(Result.final_grade)).where(
        Result.final_grade.isnot(None),
    )
    if _tid:
        avg_grade_q = avg_grade_q.join(
            Evaluation, Result.evaluation_id == Evaluation.id
        ).where(Evaluation.tenant_id == _tid)
    avg_grade = await db.execute(avg_grade_q)
    average_grade = round(avg_grade.scalar() or 0, 1)

    # Completed this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    completed_week_q = select(func.count(Result.id)).where(
        Result.status == "reviewed",
        Result.updated_at >= week_ago,
    )
    if _tid:
        completed_week_q = completed_week_q.join(
            Evaluation, Result.evaluation_id == Evaluation.id
        ).where(Evaluation.tenant_id == _tid)
    completed_week = await db.execute(completed_week_q)
    completed_this_week = completed_week.scalar() or 0

    # Pending review
    pending_q = select(func.count(Result.id)).where(
        Result.requires_review == True,
    )
    if _tid:
        pending_q = pending_q.join(
            Evaluation, Result.evaluation_id == Evaluation.id
        ).where(Evaluation.tenant_id == _tid)
    pending = await db.execute(pending_q)
    pending_review = pending.scalar() or 0

    return DashboardStatsResponse(
        total_evaluations=total_evaluations,
        total_students=total_students,
        average_grade=average_grade,
        completed_this_week=completed_this_week,
        pending_review=pending_review,
    )


async def get_accessible_tenant_ids(db: AsyncSession, user: User) -> list[str]:
    """Get tenant IDs accessible to the user (for isolation filtering).

    Returns raw tenant UUIDs (not schema names). On PostgreSQL,
    schema isolation is handled by search_path; these IDs are for
    public-schema queries (tenants, users) and cross-schema aggregation.

    ponytail: SQLite has no schemas — tenant IDs are used for
    WHERE tenant_id IN (...) filtering as the primary isolation.
    """
    if user.role == "ADMIN":
        if _is_pg():
            result = await db.execute(
                text("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'tenant\\_%'")
            )
            return [row[0].replace("tenant_", "") for row in result.fetchall()]
        else:
            # SQLite: ADMIN sees all tenants
            result = await db.execute(select(Tenant.id))
            return [row[0] for row in result.fetchall()]

    # Non-ADMIN: get tenant IDs from TenantMember membership
    result = await db.execute(
        select(TenantMember.tenant_id).where(TenantMember.user_id == user.id)
    )
    member_ids = [row[0] for row in result.fetchall()]

    # Fallback: user's own tenant (backward compat)
    if not member_ids and user.tenant_id:
        member_ids = [user.tenant_id]

    return member_ids


@router.get("/executive", response_model=MacroStatsResponse)
async def executive_dashboard(
    current_user: User = Depends(require_role("HOLDER")),
    db: AsyncSession = Depends(get_db),
):
    """Get executive dashboard stats — cross-schema view for HOLDER/ADMIN.

    Uses raw SQL UNION ALL queries across tenant schemas for aggregations.
    Public schema tables (tenants, users) are queried directly with
    tenant_id filters for tenant isolation.
    """

    # ── Resolve accessible tenants ────────────────────────────────
    accessible_tenant_ids = await get_accessible_tenant_ids(db, current_user)

    # Build schema names for cross-schema queries (PostgreSQL only)
    schema_names: list[str] = []
    if _is_pg() and accessible_tenant_ids:
        schema_names = [f"tenant_{tid}" for tid in accessible_tenant_ids]

    # ── Total schools (public.tenants) ───────────────────────────────
    total_schools_query = select(func.count(Tenant.id)).where(Tenant.status == "active")
    if accessible_tenant_ids:
        total_schools_query = total_schools_query.where(
            Tenant.id.in_(accessible_tenant_ids)
        )
    elif current_user.role != "ADMIN":
        total_schools_query = total_schools_query.where(text("1=0"))
    total_schools_res = await db.execute(total_schools_query)
    total_schools = total_schools_res.scalar() or 0

    # ── Total teachers (public.users) ────────────────────────────────
    total_teachers_query = select(func.count(User.id)).where(User.role == "TEACHER")
    if accessible_tenant_ids:
        total_teachers_query = total_teachers_query.where(
            User.tenant_id.in_(accessible_tenant_ids)
        )
    elif current_user.role != "ADMIN":
        total_teachers_query = total_teachers_query.where(text("1=0"))
    total_teachers_res = await db.execute(total_teachers_query)
    total_teachers = total_teachers_res.scalar() or 0

    # ── Total evaluations (cross-schema UNION ALL on PG, tenant_id filter on SQLite)
    total_evaluations = 0
    if schema_names:
        parts = []
        for schema_name in schema_names:
            safe = schema_name.replace('"', '""')
            parts.append(f"SELECT COUNT(*) FROM \"{safe}\".evaluations")
        sql = " UNION ALL ".join(parts)
        res = await db.execute(text(sql))
        total_evaluations = sum(row[0] for row in res.fetchall())
    elif accessible_tenant_ids:
        # SQLite fallback: query public schema with tenant_id filter
        ev_query = select(func.count(Evaluation.id))
        if current_user.role != "ADMIN":
            ev_query = ev_query.where(Evaluation.tenant_id.in_(accessible_tenant_ids))
        ev_res = await db.execute(ev_query)
        total_evaluations = ev_res.scalar() or 0

    # ── Average performance (cross-schema on PG, tenant_id filter on SQLite)
    average_performance = 0.0
    if schema_names:
        parts = []
        for schema_name in schema_names:
            safe = schema_name.replace('"', '""')
            parts.append(
                f"SELECT SUM(final_grade) AS total, COUNT(*) AS cnt "
                f"FROM \"{safe}\".results WHERE final_grade IS NOT NULL"
            )
        sql = " UNION ALL ".join(parts)
        res = await db.execute(text(sql))
        rows = res.fetchall()
        total_sum = sum(row[0] or 0 for row in rows)
        total_cnt = sum(row[1] or 0 for row in rows)
        average_performance = round(total_sum / total_cnt, 1) if total_cnt > 0 else 0.0
    elif accessible_tenant_ids:
        # SQLite fallback: query public schema with tenant_id filter via JOIN
        avg_query = (
            select(func.avg(Result.final_grade))
            .join(Evaluation, Result.evaluation_id == Evaluation.id)
            .where(Result.final_grade.isnot(None))
        )
        if current_user.role != "ADMIN":
            avg_query = avg_query.where(Evaluation.tenant_id.in_(accessible_tenant_ids))
        avg_res = await db.execute(avg_query)
        avg_val = avg_res.scalar()
        average_performance = round(avg_val, 1) if avg_val else 0.0

    return MacroStatsResponse(
        total_schools=total_schools,
        total_teachers=total_teachers,
        total_evaluations=total_evaluations,
        average_performance=average_performance,
    )


@router.get("/course/{course_id}")
async def course_stats(
    course_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get stats for a specific course (isolated via search_path)."""
    # On SQLite, search_path is a no-op — add explicit tenant_id filter
    _tid = current_tenant_id.get() if not _is_pg() else None

    # Verify access
    course_q = select(Course).where(Course.id == course_id)
    if _tid:
        course_q = course_q.where(Course.tenant_id == _tid)
    course_result = await db.execute(course_q)
    course = course_result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Count students
    student_count_q = select(func.count(Student.id)).where(Student.course_id == course_id)
    if _tid:
        student_count_q = student_count_q.join(
            Course, Student.course_id == Course.id
        ).where(Course.tenant_id == _tid)
    student_count = await db.execute(student_count_q)
    total_students = student_count.scalar() or 0

    # Count evaluations for this course grade/subject
    eval_count_q = select(func.count(Evaluation.id)).where(
        Evaluation.grade == course.grade,
        Evaluation.subject == course.subject,
    )
    if _tid:
        eval_count_q = eval_count_q.where(Evaluation.tenant_id == _tid)
    eval_count = await db.execute(eval_count_q)
    total_evaluations = eval_count.scalar() or 0

    # Average for results in this course's evaluations
    avg_result_q = (
        select(func.avg(Result.final_grade))
        .join(Evaluation)
        .where(
            Evaluation.grade == course.grade,
            Evaluation.subject == course.subject,
            Result.final_grade.isnot(None),
        )
    )
    if _tid:
        avg_result_q = avg_result_q.where(Evaluation.tenant_id == _tid)
    avg_result = await db.execute(avg_result_q)
    average_grade = round(avg_result.scalar() or 0, 1)

    # Students list with their latest result
    students_q = select(Student).where(Student.course_id == course_id).order_by(Student.full_name)
    if _tid:
        students_q = students_q.join(
            Course, Student.course_id == Course.id
        ).where(Course.tenant_id == _tid)
    students_result = await db.execute(students_q)
    students = students_result.scalars().all()

    student_stats = []
    for student in students:
        latest = await db.execute(
            select(Result)
            .join(Evaluation)
            .where(
                Result.student_code == student.student_code,
            )
            .order_by(Result.created_at.desc())
            .limit(1)
        )
        latest_result = latest.scalar_one_or_none()

        student_stats.append({
            "student_id": student.id,
            "full_name": student.full_name,
            "student_code": student.student_code,
            "latest_grade": latest_result.final_grade if latest_result else None,
            "evaluations_completed": 0,  # simplified
        })

    return {
        "course_id": course_id,
        "course_name": course.name,
        "total_students": total_students,
        "total_evaluations": total_evaluations,
        "average_grade": average_grade,
        "students": student_stats,
    }
