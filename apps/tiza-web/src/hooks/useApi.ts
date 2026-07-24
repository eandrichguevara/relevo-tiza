'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, apiUpload } from '@/lib/api';
import { useAuth } from './useAuth';

// ─── Evaluations ──────────────────────────

export function useEvaluations() {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['evaluations'],
    queryFn: () => apiFetch<any[]>('/api/evaluations', { token: accessToken }),
    enabled: isAuthenticated,
  });
}

export function useEvaluation(id: string) {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['evaluation', id],
    queryFn: () => apiFetch<any>(`/api/evaluations/${id}`, { token: accessToken }),
    enabled: isAuthenticated && !!id,
  });
}

export function useCreateEvaluation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: any) =>
      apiFetch('/api/evaluations', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
    },
  });
}

export function useDeleteEvaluation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/evaluations/${id}`, {
        method: 'DELETE',
        token: accessToken,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
    },
  });
}

// ─── Results ──────────────────────────────

export function useResults(evaluationId: string) {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['results', evaluationId],
    queryFn: () =>
      apiFetch<any[]>(`/api/results/evaluation/${evaluationId}`, { token: accessToken }),
    enabled: isAuthenticated && !!evaluationId,
  });
}

export function useResult(id: string) {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['result', id],
    queryFn: () => apiFetch<any>(`/api/results/${id}`, { token: accessToken }),
    enabled: isAuthenticated && !!id,
  });
}

export function usePendingReviews() {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['pending-reviews'],
    queryFn: () => apiFetch<any[]>('/api/results/pending-review', { token: accessToken }),
    enabled: isAuthenticated,
  });
}

export function useReviewResult() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ resultId, corrections }: { resultId: string; corrections: any[] }) =>
      apiFetch(`/api/results/${resultId}/review`, {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({ corrections }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

// ─── Processing ───────────────────────────

export function useProcessEvaluation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ evaluationId, file }: { evaluationId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      return apiUpload<any>(`/api/evaluations/${evaluationId}/process`, formData, accessToken);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      queryClient.invalidateQueries({ queryKey: ['results'] });
    },
  });
}

// ─── Dashboard ────────────────────────────

export function useDashboardStats() {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiFetch<any>('/api/dashboard/teacher', { token: accessToken }),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
}

// ─── Courses (Tiza) ────────────────────────────

export interface Course {
  id: string;
  name: string;
  grade: string;
  subject: string;
  student_count: number;
  created_at: string;
}

export interface TeacherClass {
  course_id: string;
  course_name: string;
  subject: string;
  grade: string;
  student_count: number;
}

export function useCourses() {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery<Course[]>({
    queryKey: ['courses'],
    queryFn: () => apiFetch<Course[]>('/api/courses', { token: accessToken }),
    enabled: isAuthenticated,
  });
}

export function useMyClasses() {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery<TeacherClass[]>({
    queryKey: ['my-classes'],
    queryFn: () => apiFetch<TeacherClass[]>('/api/courses/my-classes', { token: accessToken }),
    enabled: isAuthenticated,
  });
}

export function useCreateCourse() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      name: string;
      grade: string;
      subject: string;
      teachers: Record<string, string>;
    }) =>
      apiFetch<Course>('/api/courses', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

export function useDeleteCourse() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/courses/${id}`, {
        method: 'DELETE',
        token: accessToken,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

// ─── Report PDF ──────────────────────────

export function useGenerateReport() {
  const { accessToken } = useAuth();

  return useMutation({
    mutationFn: async (resultId: string) => {
      const blob = await apiFetch<Blob>(`/api/results/${resultId}/report`, { token: accessToken });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${resultId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}
