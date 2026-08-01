import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAutosave } from '../useAutosave';

describe('useAutosave', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('detects no draft on initial state', () => {
    const { result } = renderHook(() =>
      useAutosave({ key: 'test:key', data: { foo: 'bar' } })
    );

    expect(result.current.hasDraft).toBe(false);
    expect(result.current.lastSavedAt).toBeNull();
    expect(result.current.loadDraft()).toBeNull();
  });

  it('saves data after debounce interval', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useAutosave({ key: 'test:key', data, debounceMs: 1000 }),
      { initialProps: { data: { title: 'Initial' } } }
    );

    // Update data to trigger save
    rerender({ data: { title: 'Updated Title' } });
    expect(result.current.savingStatus).toBe('saving');

    // Fast-forward timer
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.savingStatus).toBe('saved');
    expect(result.current.hasDraft).toBe(true);
    expect(result.current.lastSavedAt).toBeInstanceOf(Date);
    expect(result.current.loadDraft()).toEqual({ title: 'Updated Title' });
  });

  it('clears draft properly', () => {
    localStorage.setItem(
      'test:key',
      JSON.stringify({ _ts: Date.now(), _version: 1, data: { test: 123 } })
    );

    const { result, rerender } = renderHook(() =>
      useAutosave({ key: 'test:key', data: { test: 123 } })
    );

    expect(result.current.hasDraft).toBe(true);

    act(() => {
      result.current.clearDraft();
    });

    // hasDraft is computed synchronously from localStorage on each render,
    // so we need a re-render to see the updated value
    rerender();

    expect(result.current.hasDraft).toBe(false);
    expect(result.current.loadDraft()).toBeNull();
    expect(localStorage.getItem('test:key')).toBeNull();
  });

  it('ignores expired drafts past TTL', () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      'test:key',
      JSON.stringify({ _ts: eightDaysAgo, _version: 1, data: { test: 'old' } })
    );

    const { result } = renderHook(() =>
      useAutosave({ key: 'test:key', data: { test: 'new' }, ttlDays: 7 })
    );

    expect(result.current.hasDraft).toBe(false);
    expect(localStorage.getItem('test:key')).toBeNull();
  });

  it('does not re-trigger save when data reference changes but content is the same', () => {
    const { result, rerender } = renderHook(
      ({ data }) => useAutosave({ key: 'test:key', data, debounceMs: 1000 }),
      { initialProps: { data: { title: 'Same' } } }
    );

    // Re-render with same content but new object reference
    rerender({ data: { title: 'Same' } });

    // Status should still be idle because serialized data hasn't changed
    expect(result.current.savingStatus).toBe('idle');
  });

  it('hasDraft is true synchronously when localStorage has a valid draft', () => {
    localStorage.setItem(
      'test:key',
      JSON.stringify({ _ts: Date.now(), _version: 1, data: { title: 'Draft' } })
    );

    const { result } = renderHook(() =>
      useAutosave({ key: 'test:key', data: { title: '' } })
    );

    // hasDraft should be true on the very first render, not after an async effect
    expect(result.current.hasDraft).toBe(true);
    expect(result.current.loadDraft()).toEqual({ title: 'Draft' });
  });
});
