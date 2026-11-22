'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function generateKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface UseIdempotencyKeyResult {
  idempotencyKey: string;
  isSubmitting: boolean;
  submit: <T>(fn: (idempotencyKey: string) => Promise<T>) => Promise<T | undefined>;
  reset: () => void;
}

/**
 * Provides a stable idempotency key for one form instance and blocks
 * duplicate submissions while a save is in flight.
 *
 * - The key is generated after mount (never during render) to avoid hydration mismatches.
 * - The same key is reused for every retry of the same form until `reset()` is called,
 *   so the server can return the existing record instead of creating a duplicate.
 * - Call `reset()` after a successful save so the next submission gets a fresh key.
 */
export function useIdempotencyKey(): UseIdempotencyKeyResult {
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const keyRef = useRef<string>('');
  const inFlightRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(false);

  useEffect(() => {
    mountedRef.current = true;
    if (!keyRef.current) {
      keyRef.current = generateKey();
      setIdempotencyKey(keyRef.current);
    }
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    keyRef.current = generateKey();
    setIdempotencyKey(keyRef.current);
  }, []);

  const submit = useCallback(
    async <T>(fn: (key: string) => Promise<T>): Promise<T | undefined> => {
      // Checked synchronously via ref so rapid double-clicks cannot slip through
      // before React has re-rendered with the new isSubmitting state.
      if (inFlightRef.current) return undefined;

      if (!keyRef.current) {
        keyRef.current = generateKey();
        if (mountedRef.current) setIdempotencyKey(keyRef.current);
      }

      inFlightRef.current = true;
      if (mountedRef.current) setIsSubmitting(true);

      try {
        return await fn(keyRef.current);
      } finally {
        inFlightRef.current = false;
        if (mountedRef.current) setIsSubmitting(false);
      }
    },
    [],
  );

  return { idempotencyKey, isSubmitting, submit, reset };
}

export default useIdempotencyKey;