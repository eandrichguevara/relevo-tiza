import type { Evaluation, Result, User, DashboardStats, MacroStats } from './models';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  role?: string;
  school?: string;
  tenant_id?: string;
}

export interface CreateEvaluationRequest {
  title: string;
  subject: string;
  grade: string;
  rubric: Array<{
    questionNumber: number;
    type: 'multiple_choice' | 'written';
    maxScore: number;
    correctAnswer?: string;
    criteria?: string;
  }>;
}

export interface UploadEvaluationRequest {
  evaluationId: string;
  file: File;
}

export interface ReviewResultRequest {
  resultId: string;
  corrections: Array<{
    questionNumber: number;
    teacherScore: number;
    teacherCorrection: string;
  }>;
}

export interface EvaluationListResponse extends PaginatedResponse<Evaluation> {}
export interface ResultResponse extends ApiResponse<Result> {}
export interface DashboardStatsResponse extends ApiResponse<DashboardStats> {}
export interface MacroStatsResponse extends ApiResponse<MacroStats> {}
