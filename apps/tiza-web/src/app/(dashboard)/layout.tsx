'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useAppStore } from '@/store/useAppStore';
import { useFeatures } from '@/hooks/useFeatures';
import { usePendingReviews } from '@/hooks/useApi';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  BarChart3,
  LogOut,
  BookOpen,
  Menu,
  X,
  CreditCard,
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useAppStore();
  const { features, isLoaded } = useFeatures();
  const { data: pendingReviews } = usePendingReviews();
  const pendingCount = pendingReviews?.length ?? 0;

  const navItems = [
    { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
    { href: '/dashboard/cursos', label: 'Cursos', icon: BookOpen },
    { href: '/dashboard/evaluaciones', label: 'Evaluaciones', icon: FileText },
    { href: '/dashboard/revisar', label: 'Revisar', icon: AlertTriangle },
    { href: '/dashboard/reportes', label: 'Reportes', icon: BarChart3 },
    // Facturación visible solo si billing feature flag está activo
    ...(isLoaded && features.billing
      ? [{ href: '/dashboard/facturacion' as const, label: 'Facturación', icon: CreditCard }]
      : []),
  ];

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

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
            <BookOpen className="h-7 w-7 text-brand-primary" />
            <span className="text-xl font-bold text-brand-secondary">TIZA</span>
          </Link>
          <p className="text-xs text-gray-500 mt-1">Tu tiempo, tu enseñanza</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
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
                {item.href === '/dashboard/revisar' && pendingCount > 0 && (
                  <span
                    className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full"
                    aria-label={`${pendingCount} evaluaciones pendientes de revisión`}
                  >
                    {pendingCount > 9 ? '9+' : pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-brand-primary text-white flex items-center justify-center text-sm font-medium">
              {user?.name?.[0] || 'P'}
            </div>
            <div className="text-sm">
              <p className="font-medium text-gray-900">{user?.name || 'Profesor'}</p>
              <p className="text-gray-500 text-xs">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => logout()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-600 transition-colors w-full"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
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
