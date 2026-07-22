'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useTenants } from './useRelevoApi';
import type { Tenant } from '@tiza/types';

const STORAGE_KEY = 'relevo-active-tenant';

export interface ActiveTenantContextValue {
  activeTenantId: string | null;
  activeTenant: Tenant | null;
  tenants: Tenant[];
  setActiveTenantId: (id: string) => void;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Contexto global para el colegio activo en el dashboard de RELEVO.
 *
 * El provider obtiene la lista de tenants desde GET /api/tenants,
 * persiste la selección en localStorage (key: "relevo-active-tenant"),
 * y expone tanto la lista como el tenant activo a todas las páginas
 * hijas dentro del dashboard layout.
 */
const ActiveTenantContext = createContext<ActiveTenantContextValue | undefined>(undefined);

export function ActiveTenantProvider({ children }: { children: ReactNode }) {
  const { data: tenants, isLoading, isError } = useTenants();
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const tenantList = Array.isArray(tenants) ? tenants : [];

  // Initialize from localStorage (first priority) or default to first tenant
  useEffect(() => {
    if (initialized) return;
    if (isLoading) return;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && tenantList.some((t) => t.id === stored)) {
      setActiveTenantIdState(stored);
    } else if (tenantList.length > 0) {
      setActiveTenantIdState(tenantList[0].id);
      localStorage.setItem(STORAGE_KEY, tenantList[0].id);
    }
    setInitialized(true);
  }, [initialized, isLoading, tenantList]);

  const setActiveTenantId = useCallback((id: string) => {
    setActiveTenantIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const activeTenant = tenantList.find((t) => t.id === activeTenantId) ?? null;

  return (
    <ActiveTenantContext.Provider
      value={{
        activeTenantId,
        activeTenant,
        tenants: tenantList,
        setActiveTenantId,
        isLoading,
        isError,
      }}
    >
      {children}
    </ActiveTenantContext.Provider>
  );
}

/**
 * Hook para consumir el colegio activo desde cualquier página dentro
 * del dashboard de RELEVO. Lanza error si se usa fuera del provider.
 */
export function useActiveTenant(): ActiveTenantContextValue {
  const ctx = useContext(ActiveTenantContext);
  if (ctx === undefined) {
    throw new Error('useActiveTenant debe usarse dentro de <ActiveTenantProvider>');
  }
  return ctx;
}
