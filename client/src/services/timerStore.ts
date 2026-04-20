export type TimerStatus = 'running' | 'paused' | 'stopped';

export interface ActiveTimerItem {
  key: string;
  assistenzaId?: string;
  risorsaId?: string | null;
  nr: string;
  rifAssistenzaNome: string;
  tipologiaAssistenza: string;
  startedAt: number | null;
  elapsedSeconds: number;
  status: TimerStatus;
}

const STORAGE_KEY = 'centoraggi_active_timers';

function emitTimersChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('timers:changed'));
  }
}

function normalizeTimer(timer: Partial<ActiveTimerItem>): ActiveTimerItem {
  const startedAt = typeof timer.startedAt === 'number' ? timer.startedAt : null;
  const fallbackElapsed = startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0;
  const status: TimerStatus = timer.status === 'running' || timer.status === 'paused' || timer.status === 'stopped'
    ? timer.status
    : startedAt
      ? 'running'
      : 'stopped';

  return {
    key: timer.key || '',
    assistenzaId: timer.assistenzaId,
    risorsaId: timer.risorsaId ?? null,
    nr: timer.nr || 'Registrazione',
    rifAssistenzaNome: timer.rifAssistenzaNome || '',
    tipologiaAssistenza: timer.tipologiaAssistenza || '',
    startedAt,
    elapsedSeconds: typeof timer.elapsedSeconds === 'number' ? timer.elapsedSeconds : fallbackElapsed,
    status,
  };
}

export function getActiveTimers(): ActiveTimerItem[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<ActiveTimerItem>[];
    return Array.isArray(parsed)
      ? parsed.filter((timer) => !!timer?.key).map(normalizeTimer)
      : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function getActiveTimer(key: string): ActiveTimerItem | undefined {
  return getActiveTimers().find((timer) => timer.key === key);
}

export function upsertActiveTimer(timer: ActiveTimerItem) {
  const timers = getActiveTimers();
  const next = timers.filter((item) => item.key !== timer.key);
  next.push(normalizeTimer(timer));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitTimersChanged();
}

export function removeActiveTimer(key: string) {
  const timers = getActiveTimers();
  const next = timers.filter((item) => item.key !== key);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  emitTimersChanged();
}

export function formatTimerDuration(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
