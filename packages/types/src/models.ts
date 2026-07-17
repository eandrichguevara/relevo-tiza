export type Brand = 'tiza' | 'relevo';
export type Role = 'TEACHER' | 'HOLDER' | 'ADMIN';
export type TenantMemberRole = 'owner' | 'admin' | 'member';
export type UserStatus = 'pending' | 'active' | 'rejected';
export type QuestionType = 'multiple_choice' | 'written';
export type ProcessingStatus =
  'pending' | 'processing' | 'completed' | 'requires_review' | 'reviewed';
export type AnswerStatus = 'pending' | 'processing' | 'corrected' | 'requires_review' | 'reviewed';

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantMemberRole;
  createdAt: string;
  tenant?: Tenant;
  user?: User;
}

export interface Tenant {
  id: string;
  subdomain: string;
  name: string;
  brand: Brand;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  members?: TenantMember[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  rejectionReason?: string;
  tenantId: string;
  tenant?: Tenant;
  tenantMemberships?: TenantMember[];
}

export interface RubricItem {
  questionNumber: number;
  type: QuestionType;
  maxScore: number;
  correctAnswer?: string;
  criteria?: string;
}

export interface Evaluation {
  id: string;
  tenantId: string;
  title: string;
  subject: string;
  grade: string;
  rubric: RubricItem[];
  pdfUrl?: string;
  status: ProcessingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StudentAnswer {
  questionNumber: number;
  studentAnswer: string;
  score: number;
  maxScore: number;
  confidence: number;
  requiresReview: boolean;
  aiFeedback: string;
  teacherCorrection?: string;
  teacherScore?: number;
}

export interface Result {
  id: string;
  evaluationId: string;
  studentCode: string;
  answers: StudentAnswer[];
  confidence: number;
  requiresReview: boolean;
  finalGrade?: number;
  status: AnswerStatus;
  feedbackPdfUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalEvaluations: number;
  totalStudents: number;
  averageGrade: number;
  processingTime: number;
  completedThisWeek: number;
  pendingReview: number;
}

export interface MacroStats {
  totalSchools: number;
  totalTeachers: number;
  totalEvaluations: number;
  averagePerformance: number;
  subjectBreakdown: Record<string, number>;
  gradeBreakdown: Record<string, number>;
  trendData: Array<{ month: string; value: number }>;
}
