import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { DataverseService } from "../../services/dataverseService.js";

const dataverseService = new DataverseService(
  process.env.DATAVERSE_URL || '',
  process.env.DATAVERSE_CLIENT_ID || '',
  process.env.DATAVERSE_CLIENT_SECRET || '',
  process.env.DATAVERSE_TENANT_ID || ''
);

export async function login(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const body = await request.json() as { password?: string };
    const password = body?.password;

    if (!password || typeof password !== 'string') {
      return {
        status: 400,
        jsonBody: { error: 'Password richiesta' }
      };
    }

    const risorsa = await dataverseService.loginRisorsa(password);

    if (!risorsa) {
      return {
        status: 401,
        jsonBody: { error: 'Codice non valido' }
      };
    }

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          id: risorsa.phyo_risorseid,
          nome: risorsa.phyo_name
        }
      }
    };
  } catch (error: any) {
    console.error('Login error:', error.message);
    return {
      status: 500,
      jsonBody: {
        error: 'Errore durante il login',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    };
  }
}

app.http('login', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/login',
  handler: login
});
