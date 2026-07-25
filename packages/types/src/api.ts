import type { Evaluation, Result, User, DashboardStats, MacroStats, CriterionItem } from './models';

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
  join_code?: string;
}

export interface AlternativeItem {
  label: string;
  text: string;
  is_correct: boolean;
}

export interface CreateEvaluationRequest {
  title: string;
  subject: string;
  grade: string;
  course_id: string;
  rubric: Array<{
    item_type?: 'question' | 'info_section' | 'divider';
    question_number?: number;
    statement?: string;
    type?: 'multiple_choice' | 'written';
    max_score?: number;
    correct_answer?: string;
    criteria?: CriterionItem[];
    alternatives?: AlternativeItem[];
    section_title?: string;
    section_content?: string;
    section_image_url?: string;
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
