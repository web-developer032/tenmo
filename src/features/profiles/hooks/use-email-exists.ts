'use client';

import { useEffect, useState } from 'react';

/**
 * Client hook: looks up whether an email is already on Tenantly.
 *
 * Debounced + AbortController-aware so rapid typing doesn't hammer the
 * endpoint. Returns `null` while the email is invalid / pending — only
 * flips to `true` / `false` once the lookup actually resolves.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function useEmailExists(email: string | undefined, debounceMs = 400): boolean | null {
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    if (!email || !EMAIL_REGEX.test(email)) {
      setExists(null);
      return;
    }
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setExists(null);
      return;
    }
    const ctl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/profiles/lookup-by-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmed }),
          signal: ctl.signal,
        });
        if (!res.ok) {
          setExists(null);
          return;
        }
        const json = (await res.json().catch(() => null)) as { data?: { exists?: boolean } } | null;
        if (typeof json?.data?.exists === 'boolean') {
          setExists(json.data.exists);
        } else {
          setExists(null);
        }
      } catch {
        setExists(null);
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timer);
      ctl.abort();
    };
  }, [email, debounceMs]);

  return exists;
}
