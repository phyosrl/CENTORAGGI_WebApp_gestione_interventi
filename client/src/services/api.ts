import axios from 'axios';
import { CommessaRaw } from '../types/commessa';
import { AssistenzaRegistrazioneRaw } from '../types/assistenzaRegistrazione';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export async function fetchCommesse(): Promise<CommessaRaw[]> {
  const { data } = await api.get<{ success: boolean; data: CommessaRaw[] }>(
    '/dataverse/commessas'
  );
  return data.data;
}

export async function fetchAssistenzeRegistrazioni(risorsaId: string): Promise<AssistenzaRegistrazioneRaw[]> {
  const { data } = await api.get<{ success: boolean; data: AssistenzaRegistrazioneRaw[] }>(
    '/dataverse/assistenze',
    { params: { risorsaId } }
  );
  return data.data;
}

export interface LoginResponse {
  id: string;
  nome: string;
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
  ['phyo_tipologia_assistenza@OData.Community.Display.V1.FormattedValue']?: string;
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
