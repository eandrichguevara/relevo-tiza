'use client';

import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { getFeaturesMap, type Brand, type FeatureFlagsMap } from '@tiza/config';

interface FeaturesResponse {
  brand: Brand;
  features: FeatureFlagsMap;
}

/**
 * Hook que obtiene los feature flags desde GET /api/features
 * con el header X-Tenant-Brand: tiza (incluido automáticamente por apiFetch).
 *
 * Cachea en React Query (staleTime: Infinity) para no refetear durante la sesión.
 * Si el API falla, cae a los defaults estáticos de @tiza/config.
 */
export function useFeatures() {
  const { data, isLoading, isError } = useQuery<FeaturesResponse>({
    queryKey: ['features', 'tiza'],
    queryFn: () => apiFetch<FeaturesResponse>('/api/features'),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  return {
    features: data?.features ?? (isError ? getFeaturesMap('tiza') : ({} as FeatureFlagsMap)),
    brand: (data?.brand ?? 'tiza') as Brand,
    isLoading,
    isLoaded: !!data || isError,
  };
}
