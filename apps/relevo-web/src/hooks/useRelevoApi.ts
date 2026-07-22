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
      return response.items;
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
  const isAdminOrHolder = user?.role === 'ADMIN' || user?.role === 'HOLDER';

  return useQuery<PendingListResponse>({
    queryKey: ['pending-registrations'],
    queryFn: () =>
      apiFetch<PendingListResponse>('/api/admin/pending-registrations', {
        token: accessToken,
      }),
    enabled: isAdminOrHolder && !!accessToken,
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
    },
  });
}
