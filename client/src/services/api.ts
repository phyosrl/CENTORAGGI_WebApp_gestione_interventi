import axios from 'axios';
import { CommessaRaw } from '../types/commessa';

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
