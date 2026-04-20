import { app, HttpRequest, HttpResponseInit } from '@azure/functions';
import { DataverseService } from '../../services/dataverseService.js';
import { requireAuth } from '../../services/auth.js';

const dataverseService = new DataverseService(
  process.env.DATAVERSE_URL || '',
  process.env.DATAVERSE_CLIENT_ID || '',
  process.env.DATAVERSE_CLIENT_SECRET || '',
  process.env.DATAVERSE_TENANT_ID || ''
);

export async function debugRisorse(request: HttpRequest): Promise<HttpResponseInit> {
  if (process.env.NODE_ENV !== 'development') {
    return { status: 404, jsonBody: { error: 'Not found' } };
  }

  const auth = requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const risorse = await dataverseService.query('phyo_risorses', undefined, ['phyo_risorseid', 'phyo_name']);
    return {
      status: 200,
      jsonBody: { data: risorse },
    };
  } catch (error: any) {
    return {
      status: 500,
      jsonBody: { error: error?.message || 'Debug error' },
    };
  }
}

app.http('debugRisorse', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'debug/risorse',
  handler: debugRisorse,
});
