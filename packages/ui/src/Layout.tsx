import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  brand?: 'tiza' | 'relevo';
  sidebar?: React.ReactNode;
}

export function Layout({ children, brand = 'tiza', sidebar }: LayoutProps) {
  return (
    <div className="min-h-screen flex">
      {sidebar && (
        <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0 hidden lg:block">
          {sidebar}
        </aside>
      )}
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
