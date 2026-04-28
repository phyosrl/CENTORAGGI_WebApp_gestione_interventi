import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { requireAuth } from '../../services/auth.js';

// Proxy server-side per Nominatim (OpenStreetMap):
// - User-Agent corretto (richiesto dal ToS Nominatim)
// - cache in memoria (15 min) per evitare chiamate ripetute
// - rate limit semplice per utente (max ~20 query/min)
// - autenticazione obbligatoria

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  house_number?: string;
  suburb?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  importance?: number;
  address?: NominatimAddress;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { ts: number; data: NominatimResult[] }>();

const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 20;
const userHits = new Map<string, number[]>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const arr = (userHits.get(userId) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    userHits.set(userId, arr);
    return false;
  }
  arr.push(now);
  userHits.set(userId, arr);
  return true;
}

const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ||
  'GestioneCommesseCentoraggi/1.0 (contact: support@centoraggi.it)';

export async function geocode(request: HttpRequest): Promise<HttpResponseInit> {
  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  const q = (request.query.get('q') || '').trim();
  if (q.length < 3) {
    return { status: 400, jsonBody: { error: 'Query troppo corta (min 3 caratteri)' } };
  }
  if (q.length > 200) {
    return { status: 400, jsonBody: { error: 'Query troppo lunga' } };
  }

  if (!checkRateLimit(auth.user.id)) {
    return { status: 429, jsonBody: { error: 'Troppe richieste, riprova tra poco' } };
  }

  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return { status: 200, jsonBody: { success: true, data: cached.data, cached: true } };
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=it&addressdetails=1&dedupe=1&limit=10&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'it',
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      return { status: 502, jsonBody: { error: 'Errore servizio geocoding', upstream: res.status } };
    }
    const raw = (await res.json()) as NominatimResult[];

    // Punteggio: privilegia risultati con strada+civico (indirizzi veri),
    // poi strade (highway), poi residenze (building), infine POI/place generici.
    const scoreOf = (r: NominatimResult): number => {
      const a = r.address || {};
      const hasRoad = !!(a.road || a.pedestrian);
      const hasHouseNumber = !!a.house_number;
      const cls = (r.class || '').toLowerCase();
      const t = (r.type || '').toLowerCase();
      let score = 0;
      if (hasRoad && hasHouseNumber) score += 100;
      else if (hasRoad) score += 60;
      if (cls === 'highway') score += 40;
      else if (cls === 'building' || t === 'house' || t === 'residential') score += 20;
      else if (cls === 'place') score += 5;
      score += (r.importance ?? 0) * 10;
      return score;
    };

    const sorted = (Array.isArray(raw) ? raw : [])
      .slice()
      .sort((a, b) => scoreOf(b) - scoreOf(a));

    const data: NominatimResult[] = sorted.map((r) => ({
      place_id: r.place_id,
      display_name: r.display_name,
      lat: r.lat,
      lon: r.lon,
      class: r.class,
      type: r.type,
      importance: r.importance,
      address: r.address,
    }));
    cache.set(key, { ts: Date.now(), data });
    // Pulisce cache se troppo grande
    if (cache.size > 500) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 100);
      for (const [k] of oldest) cache.delete(k);
    }
    return { status: 200, jsonBody: { success: true, data, cached: false } };
  } catch (err) {
    return { status: 502, jsonBody: { error: 'Errore servizio geocoding' } };
  }
}

app.http('geocode', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'geocode',
  handler: geocode,
});
