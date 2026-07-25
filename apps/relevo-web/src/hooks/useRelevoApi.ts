'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from './useAuth';
import type { Tenant, User } from '@tiza/types';
import type { PendingListResponse, ApprovalActionResponse } from '@tiza/types';

// ─── Tenants ──────────────────────────────────────────────

export function useTenants() {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery<Tenant[]>({
    queryKey: ['tenants'],
    queryFn: async () => {
      const response = await apiFetch<{
        items: Tenant[];
        total: number;
        skip: number;
        limit: number;
      }>('/api/tenants', { token: accessToken });
      return response?.items ?? [];
    },
    enabled: isAuthenticated,
  });
}

export function useCreateTenant() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; subdomain: string }) =>
      apiFetch<Tenant>('/api/tenants', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

// ─── Courses ──────────────────────────────────────────────

export interface Course {
  id: string;
  name: string;
  grade: string;
  subject: string;
  teachers?: Record<string, string>;
  student_count: number;
  created_at: string;
}

export function useCourses(tenantId: string | null) {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery<Course[]>({
    queryKey: ['courses', tenantId],
    queryFn: () => {
      const params = tenantId ? `?tenant_id=${tenantId}` : '';
      return apiFetch<Course[]>(`/api/courses${params}`, { token: accessToken });
    },
    enabled: isAuthenticated && !!tenantId,
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
      tenant_id: string;
    }) =>
      apiFetch<Course>('/api/courses', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['courses', variables.tenant_id] });
    },
  });
}

export function useUpdateCourse() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      tenant_id,
      ...data
    }: {
      id: string;
      name?: string;
      grade?: string;
      subject?: string;
      teachers?: Record<string, string>;
      tenant_id?: string;
    }) =>
      apiFetch<Course>(`/api/courses/${id}`, {
        method: 'PUT',
        token: accessToken,
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      if (variables.tenant_id) {
        queryClient.invalidateQueries({ queryKey: ['courses', variables.tenant_id] });
      }
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

export function useCourse(courseId: string | null) {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery<Course>({
    queryKey: ['course', courseId],
    queryFn: () => apiFetch<Course>(`/api/courses/${courseId}`, { token: accessToken }),
    enabled: isAuthenticated && !!courseId,
  });
}

// ─── Users ────────────────────────────────────────────────

export function useUsers(tenantId: string | null) {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery<User[]>({
    queryKey: ['users', tenantId],
    queryFn: () => apiFetch(`/api/users?tenant_id=${tenantId}`, { token: accessToken }),
    enabled: isAuthenticated && !!tenantId,
  });
}

export function useCreateUser() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      email: string;
      name: string;
      password: string;
      tenant_id: string;
      role: string;
    }) =>
      apiFetch<User>('/api/users', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users', variables.tenant_id] });
    },
    onError: () => {
      /* error handled by caller */
    },
  });
}

export function useResetPassword() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ success: boolean; message: string; temporary_password: string }>(
        `/api/users/${userId}/reset-password`,
        {
          method: 'POST',
          token: accessToken,
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// ─── Dashboard stats (existing) ───────────────────────────

export function useExecutiveStats() {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery({
    queryKey: ['executive-stats'],
    queryFn: () => apiFetch<any>('/api/dashboard/executive', { token: accessToken }),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });
}

// ─── Pending Registrations (Admin) ──────────────────────────

export function usePendingRegistrations() {
  const { accessToken, user } = useAuth();
  const isAdminOrGestion = user?.role === 'ADMIN' || user?.role === 'GESTION';

  return useQuery<PendingListResponse>({
    queryKey: ['pending-registrations'],
    queryFn: () =>
      apiFetch<PendingListResponse>('/api/admin/pending-registrations', {
        token: accessToken,
      }),
    enabled: isAdminOrGestion && !!accessToken,
    refetchInterval: 30000, // poll every 30s
  });
}

export function useApproveUser() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<ApprovalActionResponse>(`/api/admin/approve/${userId}`, {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

export function useRejectUser() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      apiFetch<ApprovalActionResponse>(`/api/admin/reject/${userId}`, {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// ─── Students ──────────────────────────────────────────────

export interface Student {
  id: string;
  course_id: string;
  full_name: string;
  student_code: string;
  rut?: string | null;
  created_at: string;
}

export interface BulkCreateResponse {
  count: number;
  students: Student[];
}

export function useStudents(courseId: string | null) {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery<Student[]>({
    queryKey: ['students', courseId],
    queryFn: () => apiFetch<Student[]>(`/api/students/course/${courseId}`, { token: accessToken }),
    enabled: isAuthenticated && !!courseId,
  });
}

export function useBulkCreateStudents() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ courseId, names }: { courseId: string; names: string[] }) =>
      apiFetch<BulkCreateResponse>(`/api/students/course/${courseId}`, {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify({ names }),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students', variables.courseId] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}

export function useDeleteStudent() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ studentId, courseId }: { studentId: string; courseId: string }) =>
      apiFetch<{ message: string }>(`/api/students/${studentId}`, {
        method: 'DELETE',
        token: accessToken,
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students', variables.courseId] });
      queryClient.invalidateQueries({ queryKey: ['courses'] });
    },
  });
}
