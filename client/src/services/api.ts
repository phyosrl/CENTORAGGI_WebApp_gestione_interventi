import axios from 'axios';
import { CommessaRaw } from '../types/commessa';
import { AssistenzaRegistrazioneRaw } from '../types/assistenzaRegistrazione';

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error?.response?.status === 401) {
      sessionStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('auth:expired'));
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
  _phyo_rifassistenza_value?: string | null;
  _phyo_cliente_value?: string | null;
  phyo_statoreg?: number | null;
  phyo_data?: string | null;
}

export async function updateAssistenza(id: string, payload: UpdateAssistenzaPayload): Promise<void> {
  await api.patch(`/dataverse/assistenze/${id}`, payload);
}

export interface CreateAssistenzaPayload {
  phyo_attne?: string | null;
  phyo_oreintervento?: number | null;
  phyo_ore?: number | null;
  phyo_descrizioneintervento?: string | null;
  phyo_materialeutilizzato?: string | null;
  phyo_totale?: string | null;
  phyo_data?: string | null;
  _phyo_risorsa_value: string;
  _phyo_rifassistenza_value?: string | null;
  _phyo_cliente_value?: string | null;
}

export async function createAssistenza(payload: CreateAssistenzaPayload): Promise<{ id: string }> {
  const { data } = await api.post<{ success: boolean; id: string }>('/dataverse/assistenze', payload);
  return data;
}

export interface RifAssistenza {
  phyo_assistenzeid: string;
  phyo_nrassistenze: string;
  phyo_tipologia_assistenza: string | null;
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
