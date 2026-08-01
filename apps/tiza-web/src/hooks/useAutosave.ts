'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseAutosaveOptions<T> {
  key: string;
  data: T;
  debounceMs?: number;
  enabled?: boolean;
  ttlDays?: number;
}

interface DraftEnvelope<T> {
  _ts: number;
  _version: number;
  data: T;
}

export interface UseAutosaveReturn<T> {
  lastSavedAt: Date | null;
  hasDraft: boolean;
  loadDraft: () => T | null;
  clearDraft: () => void;
  savingStatus: 'idle' | 'saving' | 'saved';
}

export function useAutosave<T>({
  key,
  data,
  debounceMs = 2000,
  enabled = true,
  ttlDays = 7,
}: UseAutosaveOptions<T>): UseAutosaveReturn<T> {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRender = useRef(true);
  const dataRef = useRef(data);
  dataRef.current = data;

  // ponytail: hasDraft se calcula síncronamente al leer de localStorage, no como estado async
  const hasDraft = (() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      const envelope: DraftEnvelope<T> = JSON.parse(raw);
      const ageMs = Date.now() - envelope._ts;
      const maxAgeMs = ttlDays * 24 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        localStorage.removeItem(key);
        return false;
      }
      return true;
    } catch {
      return false;
    }
  })();

  // Load draft function — reads synchronously from localStorage
  const loadDraft = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const envelope: DraftEnvelope<T> = JSON.parse(raw);

      // Check expiration
      const ageMs = Date.now() - envelope._ts;
      const maxAgeMs = ttlDays * 24 * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        localStorage.removeItem(key);
        return null;
      }

      return envelope.data;
    } catch (err) {
      console.error('[useAutosave] Failed to parse draft, removing corrupt entry:', err);
      try {
        localStorage.removeItem(key);
      } catch {}
      return null;
    }
  }, [key, ttlDays]);

  // Clear draft function
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setLastSavedAt(null);
      setSavingStatus('idle');
    } catch (err) {
      console.error('[useAutosave] Failed to clear draft:', err);
    }
  }, [key]);

  // Autosave effect — uses serialized data as dependency to avoid
  // re-triggering on every render when data is a new object reference
  const serializedData = JSON.stringify(data, (k, v) => {
    if (k === 'section_image_url' && typeof v === 'string' && v.startsWith('data:image/')) {
      return undefined; // ponytail: excluir imágenes base64 para proteger cuota de localStorage
    }
    return v;
  });

  useEffect(() => {
    // Avoid saving on initial render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    if (!enabled) return;

    setSavingStatus('saving');

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      try {
        const cleanData = JSON.parse(serializedData);

        const envelope: DraftEnvelope<T> = {
          _ts: Date.now(),
          _version: 1,
          data: cleanData,
        };

        localStorage.setItem(key, JSON.stringify(envelope));
        setLastSavedAt(new Date(envelope._ts));
        setSavingStatus('saved');
      } catch (err) {
        console.error('[useAutosave] Error saving to localStorage:', err);
        setSavingStatus('idle');
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serializedData, debounceMs, enabled, key]);

  return {
    lastSavedAt,
    hasDraft,
    loadDraft,
    clearDraft,
    savingStatus,
  };
}
