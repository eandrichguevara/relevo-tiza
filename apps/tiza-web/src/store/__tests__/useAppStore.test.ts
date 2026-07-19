import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/useAppStore';

describe('useAppStore', () => {
  beforeEach(() => {
    // Reset the store state before each test
    useAppStore.setState({
      sidebarOpen: false,
      currentEvaluationId: null,
    });
  });

  it('tiene estado inicial correcto', () => {
    const state = useAppStore.getState();
    expect(state.brand).toBe('tiza');
    expect(state.sidebarOpen).toBe(false);
    expect(state.currentEvaluationId).toBeNull();
  });

  it('toggleSidebar cambia sidebarOpen de false a true', () => {
    useAppStore.getState().toggleSidebar();
    expect(useAppStore.getState().sidebarOpen).toBe(true);
  });

  it('toggleSidebar cambia sidebarOpen de true a false', () => {
    useAppStore.getState().toggleSidebar(); // false → true
    useAppStore.getState().toggleSidebar(); // true → false
    expect(useAppStore.getState().sidebarOpen).toBe(false);
  });

  it('setCurrentEvaluationId actualiza el ID', () => {
    useAppStore.getState().setCurrentEvaluationId('eval-123');
    expect(useAppStore.getState().currentEvaluationId).toBe('eval-123');
  });

  it('setCurrentEvaluationId acepta null para limpiar', () => {
    useAppStore.getState().setCurrentEvaluationId('eval-123');
    useAppStore.getState().setCurrentEvaluationId(null);
    expect(useAppStore.getState().currentEvaluationId).toBeNull();
  });

  it('setSidebarOpen cambia sidebarOpen a true', () => {
    useAppStore.getState().setSidebarOpen(true);
    expect(useAppStore.getState().sidebarOpen).toBe(true);
  });

  it('setSidebarOpen cambia sidebarOpen a false', () => {
    useAppStore.getState().setSidebarOpen(true);
    useAppStore.getState().setSidebarOpen(false);
    expect(useAppStore.getState().sidebarOpen).toBe(false);
  });
});
