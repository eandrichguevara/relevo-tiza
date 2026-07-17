"""Pydantic schemas for API request/response validation."""
from typing import Any, Dict, List, Optional
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field, field_validator, EmailStr


class BrandEnum(str, Enum):
    tiza = "tiza"
    relevo = "relevo"


class RoleEnum(str, Enum):
    TEACHER = "TEACHER"
    HOLDER = "HOLDER"
    ADMIN = "ADMIN"


class UserStatusEnum(str, Enum):
    pending = "pending"
    active = "active"
    rejected = "rejected"
    suspended = "suspended"


class QuestionTypeEnum(str, Enum):
    multiple_choice = "multiple_choice"
    written = "written"


# ─── Auth ─────────────────────────────────


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: Optional[str] = None
    role: Optional[str] = None  # 'teacher' | 'director' | 'holder' | 'admin'
    school: Optional[str] = None  # school name for relevo (HOLDER) registrations
    tenant_id: Optional[str] = None  # pre-existing tenant to assign user to
    join_code: Optional[str] = None  # school join code (TIZA teachers use this instead of tenant_id)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: RoleEnum
    status: UserStatusEnum = UserStatusEnum.active
    tenant_id: str
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AdminUserResponse(UserResponse):
    """Extends UserResponse with moderation fields visible only to admins."""
    rejection_reason: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejected_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PendingRegistrationResponse(BaseModel):
    """A pending user registration for the admin approval list."""
    id: str
    email: str
    name: str
    role: RoleEnum
    tenant_id: str
    tenant_name: Optional[str] = None
    brand: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PendingListResponse(BaseModel):
    items: List[PendingRegistrationResponse]
    total: int
    page: int
    page_size: int


class ApproveRejectRequest(BaseModel):
    reason: Optional[str] = None  # Required for reject, optional for approve


class ApprovalActionResponse(BaseModel):
    success: bool
    message: str
    user_id: str
    status: UserStatusEnum


# ─── Tenants ──────────────────────────────


class CreateTenantRequest(BaseModel):
    name: str = Field(..., min_length=1)
    subdomain: str

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name must not be empty or whitespace only")
        return v


class TenantResponse(BaseModel):
    id: str
    name: str
    subdomain: str
    brand: str
    status: str = "active"
    join_code: Optional[str] = None
    settings: Optional[dict] = {}
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TenantLookupResponse(BaseModel):
    """Public response for tenant lookup by join_code — no auth required."""
    tenant_id: str
    name: str


# ─── Users (multi-tenant admin) ───────────


class CreateUserRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str  # only "teacher" allowed via this endpoint
    tenant_id: str


# ─── Rubric ───────────────────────────────


class RubricItem(BaseModel):
    question_number: int
    type: QuestionTypeEnum
    max_score: float
    correct_answer: Optional[str] = None
    criteria: Optional[str] = None


# ─── Evaluations ──────────────────────────


class CreateEvaluationRequest(BaseModel):
    title: str
    subject: str
    grade: str
    rubric: List[RubricItem]


class EvaluationResponse(BaseModel):
    id: str
    tenant_id: str
    title: str
    subject: str
    grade: str
    rubric: List[RubricItem]
    pdf_url: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ─── Results ──────────────────────────────


class StudentAnswer(BaseModel):
    question_number: int
    student_answer: str = ""
    score: float = 0
    max_score: float
    confidence: float = 0
    requires_review: bool = False
    ai_feedback: str = ""
    teacher_correction: Optional[str] = None
    teacher_score: Optional[float] = None


class ResultResponse(BaseModel):
    id: str
    evaluation_id: str
    student_code: str
    answers: List[StudentAnswer]
    confidence: float
    requires_review: bool
    final_grade: Optional[float] = None
    status: str
    feedback_pdf_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReviewRequest(BaseModel):
    corrections: List[dict]


# ─── Dashboard ────────────────────────────


class DashboardStatsResponse(BaseModel):
    total_evaluations: int
    total_students: int
    average_grade: float
    completed_this_week: int
    pending_review: int


class MacroStatsResponse(BaseModel):
    total_schools: int
    total_teachers: int
    total_evaluations: int
    average_performance: float


# ─── Courses ──────────────────────────────
class CreateCourseRequest(BaseModel):
    name: str
    grade: str
    subject: str

class CourseResponse(BaseModel):
    id: str
    tenant_id: str
    name: str
    grade: str
    subject: str
    teacher_id: str
    student_count: int = 0
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

# ─── Students ─────────────────────────────
class CreateStudentRequest(BaseModel):
    full_name: str
    student_code: Optional[str] = None
    rut: Optional[str] = None

class StudentResponse(BaseModel):
    id: str
    course_id: str
    full_name: str
    student_code: str
    rut: Optional[str] = None
    created_at: datetime
    model_config = {"from_attributes": True}

class BulkCreateStudentsRequest(BaseModel):
    names: List[str]  # lista de nombres, student_code se genera automáticamente

class BulkCreateStudentsResponse(BaseModel):
    count: int
    students: List[StudentResponse]
