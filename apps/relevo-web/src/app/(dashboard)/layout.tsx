'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useFeatures } from '@/hooks/useFeatures';
import {
  LayoutDashboard,
  School,
  BarChart3,
  Users,
  CreditCard,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Clock,
} from 'lucide-react';

function getNavItems(userRole?: string) {
  const items = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/dashboard/colegios', label: 'Colegios', icon: School },
    { href: '/dashboard/analitica', label: 'Analítica', icon: BarChart3 },
    { href: '/dashboard/usuarios', label: 'Usuarios', icon: Users },
    { href: '/dashboard/facturacion', label: 'Facturación', icon: CreditCard },
  ];

  // Admin-only nav items
  if (userRole === 'ADMIN') {
    items.splice(1, 0, {
      href: '/dashboard/admin/pendientes',
      label: 'Pendientes',
      icon: Clock,
    });
  }

  return items;
}

// ─── Simulated tenants for the selector ───────────────────

const SIMULATED_TENANTS = [
  { id: 't1', name: 'Colegio San Miguel', subdomain: 'san-miguel' },
  { id: 't2', name: 'Liceo Gabriela Mistral', subdomain: 'gabriela-mistral' },
  { id: 't3', name: 'Instituto Nacional', subdomain: 'instituto-nacional' },
  { id: 't4', name: 'Colegio Los Olivos', subdomain: 'los-olivos' },
  { id: 't5', name: 'Colegio Santa María', subdomain: 'santa-maria' },
];

const STORAGE_KEY = 'relevo-active-tenant';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { features, isLoaded } = useFeatures();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ─── Tenant state ───────────────────────────────────
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SIMULATED_TENANTS.some((t) => t.id === stored)) {
      setActiveTenantId(stored);
    } else if (SIMULATED_TENANTS.length > 0) {
      // Default to first tenant
      setActiveTenantId(SIMULATED_TENANTS[0].id);
      localStorage.setItem(STORAGE_KEY, SIMULATED_TENANTS[0].id);
    }
  }, []);

  const handleTenantChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const tenantId = e.target.value;
    setActiveTenantId(tenantId);
    localStorage.setItem(STORAGE_KEY, tenantId);
    // Optionally: update a global context/store here
  }, []);

  const activeTenant = SIMULATED_TENANTS.find((t) => t.id === activeTenantId);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  useEffect(() => {
    if (!isLoading) {
      // First: check if user exists but is not active — redirect to pending
      if (user && user.status && user.status !== 'active') {
        router.push('/pending');
        return;
      }
      // Then: check authentication
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }
      // Then: check role
      if (user && user.role !== 'HOLDER' && user.role !== 'ADMIN') {
        const tizaUrl = process.env.NEXT_PUBLIC_TIZA_URL || 'http://localhost:3001';
        window.location.href = `${tizaUrl}${pathname}`;
      }
    }
  }, [isLoading, isAuthenticated, user, router, pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-light">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Early return: prevenir content flash para roles no-HOLDER ni ADMIN
  if (!isLoading && isAuthenticated && user && user.role !== 'HOLDER' && user.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-light">
        <div className="text-center">
          <div className="text-gray-500 text-lg">Redirigiendo...</div>
          <p className="text-gray-400 text-sm mt-2">No tienes acceso a esta aplicación</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-brand-light">
      {/* Mobile hamburger button */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-md bg-white shadow-md border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
        aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0
          fixed inset-y-0 left-0 z-40
          transform transition-transform duration-200 ease-in-out
          -translate-x-full
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        <div className="p-6 border-b border-gray-100">
          <Link prefetch={false} href="/dashboard" className="flex items-center gap-2">
            <School className="h-7 w-7 text-brand-primary" />
            <span className="text-xl font-bold text-brand-primary">RELEVO</span>
          </Link>
          <p className="text-xs text-gray-500 mt-1">Datos que transforman</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {getNavItems(user?.role).map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
            return (
              <Link
                prefetch={false}
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-primary text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* ─── Sidebar footer: tenant + user ───────────── */}
        <div className="p-4 border-t border-gray-100 space-y-3">
          {/* Tenant selector — solo si multiSchool feature flag está activo */}
          {isLoaded && features.multiSchool && (
            <div>
              <label
                htmlFor="tenant-select-sidebar"
                className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1.5 block"
              >
                Colegio activo
              </label>
              <div className="relative">
                <select
                  id="tenant-select-sidebar"
                  value={activeTenantId || ''}
                  onChange={handleTenantChange}
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 pl-3 pr-8 py-2 text-sm text-gray-900 font-medium
                    focus:outline-none focus:ring-2 focus:ring-[#1A3A5C] focus:border-[#1A3A5C]
                    hover:border-gray-300 transition-colors cursor-pointer"
                  aria-label="Seleccionar colegio activo"
                >
                  {SIMULATED_TENANTS.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>
                      {tenant.name}
                    </option>
                  ))}
                </select>
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-gray-400"
                  aria-hidden="true"
                >
                  <ChevronDown size={14} />
                </div>
              </div>
              {activeTenant && (
                <p className="text-[10px] text-gray-400 mt-1 truncate">
                  {activeTenant.subdomain}.relevo.cl
                </p>
              )}
            </div>
          )}

          {/* User info */}
          <div className="flex items-center gap-3 pt-1">
            <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center text-sm flex-shrink-0">
              {user?.name?.[0] || 'D'}
            </div>
            <div className="text-sm min-w-0 flex-1">
              <p className="font-medium truncate">{user?.name || 'Director'}</p>
              <p className="text-gray-500 text-xs truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={() => logout()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 w-full transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Spacer for hamburger on mobile */}
          <div className="lg:hidden h-10" />
          {children}
        </div>
      </main>
    </div>
  );
}
