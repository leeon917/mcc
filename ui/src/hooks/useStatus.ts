/**
 * useStatus — polls the dashboard's /api/ping every 5s and exposes a
 * single `connected` boolean. Used by the header's online/offline badge.
 *
 * Kept separate from useProfiles/useMcpConfig because the polling cadence
 * is unrelated to user-initiated reloads and the failure mode is different
 * (a single failed ping → offline, not an error banner).
 */

import { useEffect, useState } from 'react';
import { ping } from '@/lib/api';

const PING_INTERVAL_MS = 5000;

export function useStatus(): boolean {
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      const ok = await ping();
      if (!cancelled) setConnected(ok);
    };
    poll();
    const interval = setInterval(poll, PING_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return connected;
}
