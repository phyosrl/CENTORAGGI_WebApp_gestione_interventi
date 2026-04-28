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

// In-memory fallback usato quando localStorage non è disponibile (SSR,
// Safari private mode, quota piena, errori di accesso).
let memoryStore: ActiveTimerItem[] | null = null;
let storageAvailable: boolean | null = null;

function isStorageAvailable(): boolean {
  if (storageAvailable !== null) return storageAvailable;
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      storageAvailable = false;
      return false;
    }
    const probe = '__centoraggi_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    storageAvailable = true;
    return true;
  } catch (err) {
    console.warn('[timerStore] localStorage non disponibile, uso memoria volatile', err);
    storageAvailable = false;
    return false;
  }
}

function readRaw(): string | null {
  if (!isStorageAvailable()) return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[timerStore] errore lettura localStorage', err);
    storageAvailable = false;
    return null;
  }
}

function writeRaw(value: string): void {
  if (isStorageAvailable()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
      return;
    } catch (err) {
      // Quota / SecurityError — degrada a memoria
      console.warn('[timerStore] errore scrittura localStorage, fallback memoria', err);
      storageAvailable = false;
    }
  }
  // Persistenza in memoria (volatile)
  try {
    memoryStore = JSON.parse(value) as ActiveTimerItem[];
  } catch {
    memoryStore = [];
  }
}

function clearRaw(): void {
  if (isStorageAvailable()) {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
  memoryStore = [];
}

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

  // Se siamo in fallback memoria, usa quello
  if (storageAvailable === false && memoryStore) return memoryStore;

  const raw = readRaw();
  if (!raw) return memoryStore ?? [];

  try {
    const parsed = JSON.parse(raw) as Partial<ActiveTimerItem>[];
    return Array.isArray(parsed)
      ? parsed.filter((timer) => !!timer?.key).map(normalizeTimer)
      : [];
  } catch (err) {
    console.warn('[timerStore] JSON corrotto in localStorage, reset', err);
    clearRaw();
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
  writeRaw(JSON.stringify(next));
  emitTimersChanged();
}

export function removeActiveTimer(key: string) {
  const timers = getActiveTimers();
  const next = timers.filter((item) => item.key !== key);
  writeRaw(JSON.stringify(next));
  emitTimersChanged();
}

export function formatTimerDuration(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
