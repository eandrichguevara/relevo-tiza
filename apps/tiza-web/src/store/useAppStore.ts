'use client';

import { create } from 'zustand';

interface AppState {
  brand: 'tiza';
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  currentEvaluationId: string | null;
  setCurrentEvaluationId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  brand: 'tiza',
  sidebarOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  currentEvaluationId: null,
  setCurrentEvaluationId: (id) => set({ currentEvaluationId: id }),
}));
