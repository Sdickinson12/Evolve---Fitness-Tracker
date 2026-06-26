import { useEffect, useState } from 'react';

// Ticks once a second, but always recomputes from `startedAt` rather than counting
// up an internal number — so it stays correct after the tab is backgrounded, the
// page is refreshed, or the session resumes on a different day.
export function useElapsedTime(startedAt: number | null): number {
  const [elapsedSec, setElapsedSec] = useState(() => (startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0));

  useEffect(() => {
    if (!startedAt) {
      setElapsedSec(0);
      return;
    }
    const tick = () => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return elapsedSec;
}

export function formatElapsed(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// Past this, a "still running?" nudge shows — long enough to cover a genuinely
// long leg day, short enough to catch a session left running overnight.
export const STALE_SESSION_MS = 4 * 60 * 60 * 1000;
