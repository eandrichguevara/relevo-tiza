'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from './useAuth';
import type { Tenant, User } from '@tiza/types';

// ─── Tenants ──────────────────────────────────────────────

export function useTenants() {
  const { accessToken, isAuthenticated } = useAuth();

  return useQuery<Tenant[]>({
    queryKey: ['tenants'],
    queryFn: () => apiFetch('/api/tenants', { token: accessToken }),
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
    mutationFn: (data: { email: string; name: string; password: string; tenantId: string }) =>
      apiFetch<User>('/api/users', {
        method: 'POST',
        token: accessToken,
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['users', variables.tenantId] });
    },
    onError: () => {
      /* error handled by caller */
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
