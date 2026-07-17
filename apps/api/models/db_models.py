"""SQLAlchemy ORM models."""
import secrets
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, JSON, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from database import Base


def generate_uuid():
    return str(uuid.uuid4())


def generate_join_code() -> str:
    """Generate a short, human-friendly join code (8 uppercase alphanumeric chars)."""
    return secrets.token_hex(4)[:8].upper()


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String, primary_key=True, default=generate_uuid)
    subdomain = Column(String, unique=True, nullable=False)
    name = Column(String, unique=True, nullable=False)
    brand = Column(String, default="tiza")
    status = Column(String, default="active")  # pending/active/rejected/suspended
    rejection_reason = Column(String, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(String, nullable=True)
    join_code = Column(String(10), unique=True, nullable=False, index=True, default=generate_join_code)
    settings = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    members = relationship("TenantMember", back_populates="tenant", cascade="all, delete-orphan")
    # NOTE: evaluations and courses relationships removed — they live in
    # tenant-specific schemas and cannot be joined cross-schema via ORM.


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_tenant_id", "tenant_id"),
        Index("ix_users_email", "email"),
        Index("ix_users_tenant_role", "tenant_id", "role"),
        Index("ix_users_status", "status"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    password = Column(String, nullable=False)
    status = Column(String, default="active")  # pending/active/rejected/suspended
    rejection_reason = Column(String, nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    approved_by = Column(String, nullable=True)
    role = Column(String, default="TEACHER")
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    tenant = relationship("Tenant", back_populates="users")
    tenant_memberships = relationship("TenantMember", back_populates="user", cascade="all, delete-orphan")


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (
        Index("ix_evaluations_status", "status"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    title = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    grade = Column(String, nullable=False)
    rubric = Column(JSON, nullable=False, default=list)
    pdf_url = Column(String, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    results = relationship("Result", back_populates="evaluation", cascade="all, delete-orphan")


class Result(Base):
    __tablename__ = "results"
    __table_args__ = (
        Index("ix_results_evaluation_id", "evaluation_id"),
        Index("ix_results_status", "status"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    evaluation_id = Column(String, ForeignKey("evaluations.id", ondelete="CASCADE"), nullable=False)
    student_code = Column(String, nullable=False)
    answers = Column(JSON, default=list)
    confidence = Column(Float, default=0.0)
    requires_review = Column(Boolean, default=False)
    final_grade = Column(Float, nullable=True)
    status = Column(String, default="pending")
    feedback_pdf_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    evaluation = relationship("Evaluation", back_populates="results")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_tenant_id", "tenant_id"),
        Index("ix_audit_user_id", "user_id"),
        Index("ix_audit_created_at", "created_at"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    action = Column(String, nullable=False)
    resource = Column(String, nullable=False)
    resource_id = Column(String, nullable=False)
    details = Column(JSON, default=dict)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class Course(Base):
    __tablename__ = "courses"
    __table_args__ = (
        Index("ix_courses_teacher_id", "teacher_id"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    grade = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    teacher_id = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    students = relationship("Student", back_populates="course", cascade="all, delete-orphan")


class Student(Base):
    __tablename__ = "students"
    __table_args__ = (
        UniqueConstraint("course_id", "student_code", name="uq_student_course"),
        Index("ix_students_course_id", "course_id"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    course_id = Column(String, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False)
    full_name = Column(String, nullable=False)
    student_code = Column(String, nullable=False)
    rut = Column(String, nullable=True)
    email = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    course = relationship("Course", back_populates="students")


class TenantMember(Base):
    """Many-to-many relationship between users and tenants.
    Allows a HOLDER to administer multiple tenants (schools)."""
    __tablename__ = "tenant_members"
    __table_args__ = (
        UniqueConstraint("tenant_id", "user_id", name="uq_tenant_member"),
        Index("ix_tenant_members_tenant_id", "tenant_id"),
        Index("ix_tenant_members_user_id", "user_id"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, default="member")  # "owner", "admin", "member"
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    tenant = relationship("Tenant", back_populates="members")
    user = relationship("User", back_populates="tenant_memberships")
