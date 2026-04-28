/**
 * Coda offline per le scritture API (PATCH/DELETE/POST).
 *
 * Persiste le richieste in IndexedDB quando il browser è offline o la rete
 * fallisce, e le rigioca automaticamente al ritorno della connettività.
 *
 * Esposta tramite eventi DOM personalizzati per aggiornare l'UI:
 *   - 'offline-queue:change' → ogni volta che la coda cambia
 *   - 'offline-queue:flushed' → al termine di un flush riuscito
 *   - 'offline-queue:error' → quando una richiesta fallisce in modo definitivo
 */

import axios, { AxiosRequestConfig } from 'axios';

const DB_NAME = 'centoraggi-offline';
const DB_VERSION = 1;
const STORE = 'write-queue';

export interface QueuedRequest {
  id: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  config: {
    url: string;
    method: string;
    data?: unknown;
    params?: Record<string, unknown>;
    headers?: Record<string, string>;
    baseURL?: string;
  };
  // Etichetta leggibile per UI/logging (es. "Aggiornamento assistenza ABC")
  label?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB non disponibile in questo ambiente'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

function emit(event: string, detail?: unknown) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(event, { detail }));
  }
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function enqueue(
  config: QueuedRequest['config'],
  label?: string
): Promise<QueuedRequest> {
  const item: QueuedRequest = {
    id: genId(),
    createdAt: Date.now(),
    attempts: 0,
    config,
    label,
  };
  const store = await tx('readwrite');
  await new Promise<void>((resolve, reject) => {
    const r = store.add(item);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  emit('offline-queue:change', { size: await getQueueSize() });
  return item;
}

export async function getQueueSize(): Promise<number> {
  const store = await tx('readonly');
  return new Promise<number>((resolve, reject) => {
    const r = store.count();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function listQueue(): Promise<QueuedRequest[]> {
  const store = await tx('readonly');
  return new Promise<QueuedRequest[]>((resolve, reject) => {
    const r = store.getAll();
    r.onsuccess = () => resolve((r.result as QueuedRequest[]).sort((a, b) => a.createdAt - b.createdAt));
    r.onerror = () => reject(r.error);
  });
}

async function remove(id: string): Promise<void> {
  const store = await tx('readwrite');
  await new Promise<void>((resolve, reject) => {
    const r = store.delete(id);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

async function update(item: QueuedRequest): Promise<void> {
  const store = await tx('readwrite');
  await new Promise<void>((resolve, reject) => {
    const r = store.put(item);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
}

export async function clearQueue(): Promise<void> {
  const store = await tx('readwrite');
  await new Promise<void>((resolve, reject) => {
    const r = store.clear();
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
  });
  emit('offline-queue:change', { size: 0 });
}

const MAX_ATTEMPTS = 5;

let flushing = false;

/**
 * Replay sequenziale della coda. È sicuro chiamarla più volte: se è già
 * in corso un flush, le chiamate successive vengono ignorate.
 */
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  if (flushing) return { ok: 0, failed: 0 };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: 0, failed: 0 };
  }
  flushing = true;
  let ok = 0;
  let failed = 0;
  try {
    const items = await listQueue();
    for (const item of items) {
      try {
        // Prepara una richiesta axios "pulita" (no interceptor di queueing).
        const cfg: AxiosRequestConfig = {
          url: item.config.url,
          method: item.config.method as AxiosRequestConfig['method'],
          data: item.config.data,
          params: item.config.params,
          headers: item.config.headers,
          baseURL: item.config.baseURL ?? '/api',
          timeout: 30000,
        };
        await axios.request(cfg);
        await remove(item.id);
        ok++;
        emit('offline-queue:change', { size: await getQueueSize() });
      } catch (err) {
        const isNetworkError =
          axios.isAxiosError(err) && (!err.response || err.code === 'ERR_NETWORK');
        item.attempts += 1;
        item.lastError = err instanceof Error ? err.message : String(err);
        if (isNetworkError && item.attempts < MAX_ATTEMPTS) {
          // Probabilmente la rete è ancora instabile: interrompi il flush e riprova dopo
          await update(item);
          break;
        }
        if (!isNetworkError && item.attempts < MAX_ATTEMPTS) {
          // Errore server (es. 500): rimanda al prossimo flush
          await update(item);
          failed++;
          continue;
        }
        // Soglia tentativi superata: rimuovi e notifica
        await remove(item.id);
        failed++;
        emit('offline-queue:error', { item });
      }
    }
  } finally {
    flushing = false;
    emit('offline-queue:flushed', { ok, failed, remaining: await getQueueSize() });
  }
  return { ok, failed };
}

let started = false;

/**
 * Avvia il flusher: registra listener `online` e tenta un flush iniziale.
 * Idempotente: chiamabile più volte senza effetti collaterali.
 */
export function startQueueFlusher(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  const tryFlush = () => {
    void flushQueue();
  };

  window.addEventListener('online', tryFlush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tryFlush();
  });

  // Tentativo iniziale (es. all'apertura dell'app dopo un crash con coda piena)
  if (navigator.onLine) {
    // micro-delay per non bloccare il bootstrap iniziale
    setTimeout(tryFlush, 1000);
  }
}
