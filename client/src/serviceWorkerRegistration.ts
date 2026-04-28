/**
 * Registrazione del Service Worker generato da vite-plugin-pwa.
 * Usa workbox-window per gestire l'aggiornamento del SW in modo affidabile.
 */
import { Workbox } from 'workbox-window';
import { flushQueue } from './services/offlineQueue';

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (!import.meta.env.PROD) return; // attivo solo in build di produzione

  window.addEventListener('load', () => {
    const wb = new Workbox('/sw.js', { scope: '/' });

    wb.addEventListener('controlling', () => {
      // Nuovo SW attivo: ricarica per servire gli asset aggiornati.
      window.location.reload();
    });

    wb.addEventListener('activated', () => {
      // Al primo avvio o dopo un update, prova a sincronizzare la coda.
      void flushQueue();
    });

    wb.register().catch((err) => {
      console.error('[sw] registrazione fallita:', err);
    });
  });
}
