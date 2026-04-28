import axios from 'axios';
import { CommessaRaw } from '../types/commessa';
import { AssistenzaRegistrazioneRaw } from '../types/assistenzaRegistrazione';
import { enqueue, flushQueue } from './offlineQueue';

const STORAGE_KEY = 'centoraggi_user';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const user = JSON.parse(raw) as Partial<LoginResponse>;
        if (user.token) {
          config.headers = config.headers ?? {};
          (config.headers as Record<string, string>).Authorization = `Bearer ${user.token}`;
        }
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  return config;
});

// Metodi mutanti che vengono accodati quando offline / errore di rete.
// I POST (create) NON sono accodati perché il chiamante necessita dell'id
// di ritorno; restano errori "online-only" gestiti a livello di UI.
const QUEUEABLE_METHODS = new Set(['patch', 'delete', 'put']);

function isOfflineOrNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  if (axios.isAxiosError(error)) {
    if (!error.response) return true; // request did not reach the server
    if (error.code === 'ERR_NETWORK') return true;
  }
  return false;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (typeof window !== 'undefined' && error?.response?.status === 401) {
      sessionStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('auth:expired'));
      return Promise.reject(error);
    }

    const cfg = error?.config as
      | { method?: string; url?: string; data?: unknown; params?: Record<string, unknown>; headers?: Record<string, string>; baseURL?: string; __offlineQueued?: boolean }
      | undefined;
    const method = (cfg?.method ?? '').toLowerCase();

    if (
      cfg &&
      !cfg.__offlineQueued &&
      QUEUEABLE_METHODS.has(method) &&
      isOfflineOrNetworkError(error)
    ) {
      try {
        // Normalizza il body: se è una stringa JSON serializzata da axios,
        // la salviamo così com'è; altrimenti memorizziamo l'oggetto.
        let data = cfg.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { /* keep as-is */ }
        }
        await enqueue(
          {
            url: cfg.url ?? '',
            method,
            data,
            params: cfg.params,
            headers: cfg.headers,
            baseURL: cfg.baseURL,
          },
          `${method.toUpperCase()} ${cfg.url ?? ''}`
        );
        // Tentativo di flush opportunistico (può rientrare la rete a breve)
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          setTimeout(() => { void flushQueue(); }, 2000);
        }
        // Risposta sintetica "accettata": il chiamante prosegue come se ok.
        return {
          data: { success: true, queued: true },
          status: 202,
          statusText: 'Accepted (queued offline)',
          headers: {},
          config: cfg,
          request: undefined,
        };
      } catch (queueErr) {
        console.error('[api] enqueue failed:', queueErr);
      }
    }

    return Promise.reject(error);
  }
);

export async function fetchCommesse(): Promise<CommessaRaw[]> {
  const { data } = await api.get<{ success: boolean; data: CommessaRaw[] }>(
    '/dataverse/commessas'
  );
  return data.data;
}

export interface PaginatedAssistenzeResponse {
  data: AssistenzaRegistrazioneRaw[];
  totalCount: number;
  skipToken: string | null;
  hasMore: boolean;
}

export async function fetchAssistenzeRegistrazioni(
  risorsaId: string,
  options?: { pageSize?: number; skipToken?: string }
): Promise<PaginatedAssistenzeResponse> {
  const params: Record<string, string> = { risorsaId };
  if (options?.pageSize) params.pageSize = String(options.pageSize);
  if (options?.skipToken) params.skipToken = options.skipToken;

  const { data } = await api.get<{
    success: boolean;
    data: AssistenzaRegistrazioneRaw[];
    totalCount?: number;
    skipToken?: string | null;
    hasMore?: boolean;
  }>('/dataverse/assistenze', { params });

  return {
    data: data.data,
    totalCount: data.totalCount ?? data.data.length,
    skipToken: data.skipToken ?? null,
    hasMore: data.hasMore ?? false,
  };
}

export interface LoginResponse {
  id: string;
  nome: string;
  token: string;
  expiresAt?: number;
}

export async function loginRisorsa(password: string): Promise<LoginResponse> {
  const { data } = await api.post<{ success: boolean; data: LoginResponse }>(
    '/auth/login',
    { password }
  );
  return data.data;
}

export interface UpdateAssistenzaPayload {
  phyo_attne?: string | null;
  phyo_oreintervento?: number | null;
  phyo_ore?: number | null;
  phyo_descrizioneintervento?: string | null;
  phyo_materialeutilizzato?: string | null;
  phyo_totale?: string | null;
  phyo_note?: string | null;
  phyo_costoorario?: number | null;
  _phyo_rifassistenza_value?: string | null;
  _phyo_cliente_value?: string | null;
  phyo_tipologia_assistenza?: number | null;
  phyo_statoreg?: number | null;
  phyo_data?: string | null;
}

export async function updateAssistenza(id: string, payload: UpdateAssistenzaPayload): Promise<void> {
  if (!id || typeof id !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    console.error('[updateAssistenza] id non valido:', id);
    throw new Error('ID registrazione non valido');
  }
  await api.patch(`/dataverse/assistenze/${id}`, payload);
}

export interface CreateAssistenzaPayload {
  phyo_attne?: string | null;
  phyo_oreintervento?: number | null;
  phyo_ore?: number | null;
  phyo_descrizioneintervento?: string | null;
  phyo_materialeutilizzato?: string | null;
  phyo_totale?: string | null;
  phyo_note?: string | null;
  phyo_costoorario?: number | null;
  phyo_data?: string | null;
  _phyo_risorsa_value: string;
  _phyo_rifassistenza_value?: string | null;
  _phyo_cliente_value?: string | null;
  phyo_tipologia_assistenza?: number | null;
}

export async function createAssistenza(payload: CreateAssistenzaPayload): Promise<{ id: string }> {
  const { data } = await api.post<{ success: boolean; id: string }>('/dataverse/assistenze', payload);
  return data;
}

export interface RifAssistenza {
  phyo_assistenzeid: string;
  phyo_nrassistenze: string;
  phyo_tipologia_assistenza: string | number | null;
  phyo_indirizzoassistenza: string | null;
  _phyo_cliente_value?: string | null;
  ['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue']?: string;
  ['_phyo_cliente_value@OData.Community.Display.V1.FormattedValue']?: string;
}

export async function fetchRifAssistenze(): Promise<RifAssistenza[]> {
  const { data } = await api.get<{ success: boolean; data: RifAssistenza[] }>('/dataverse/rifassistenze');
  return data.data;
}

export interface Account {
  accountid: string;
  name: string;
}

export async function fetchAccounts(): Promise<Account[]> {
  const { data } = await api.get<{ success: boolean; data: Account[] }>('/dataverse/accounts');
  return data.data;
}

export interface TipologiaAssistenzaOption {
  value: number;
  label: string;
}

export async function fetchTipologieAssistenza(): Promise<TipologiaAssistenzaOption[]> {
  const { data } = await api.get<{ success: boolean; data: TipologiaAssistenzaOption[] }>(
    '/dataverse/tipologie-assistenza'
  );
  return data.data;
}

export interface RequiredField {
  logicalName: string;
  displayName: string;
  requiredLevel: string;
}

export async function fetchRequiredFieldsAssistenza(): Promise<RequiredField[]> {
  const { data } = await api.get<{ success: boolean; data: RequiredField[] }>(
    '/dataverse/assistenze/required-fields'
  );
  return data.data;
}

// --- Image Annotations ---

export interface Annotation {
  annotationid: string;
  subject: string | null;
  filename: string;
  mimetype: string;
  documentbody: string;
  createdon: string;
}

export async function fetchImages(registrazioneId: string): Promise<Annotation[]> {
  const { data } = await api.get<{ success: boolean; data: Annotation[] }>(
    `/dataverse/assistenze/${registrazioneId}/images`
  );
  return data.data;
}

export async function uploadImage(
  registrazioneId: string,
  filename: string,
  mimetype: string,
  documentbody: string,
  subject?: string
): Promise<{ id: string }> {
  const { data } = await api.post<{ success: boolean; id: string }>(
    `/dataverse/assistenze/${registrazioneId}/images`,
    { filename, mimetype, documentbody, subject }
  );
  return data;
}

export async function deleteImage(annotationId: string): Promise<void> {
  await api.delete(`/dataverse/annotations/${annotationId}`);
}

// --- Geocoding (proxy backend → Nominatim) ---

export interface GeocodeAddress {
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
}

export interface GeocodeResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  importance?: number;
  address?: GeocodeAddress;
}

export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const { data } = await api.get<{ success: boolean; data: GeocodeResult[] }>(
    '/geocode',
    { params: { q: query } }
  );
  return data.data || [];
}
