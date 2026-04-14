import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { DataverseService } from "../../services/dataverseService.js";

const dataverseService = new DataverseService(
  process.env.DATAVERSE_URL || '',
  process.env.DATAVERSE_CLIENT_ID || '',
  process.env.DATAVERSE_CLIENT_SECRET || '',
  process.env.DATAVERSE_TENANT_ID || ''
);

export async function dataverseCommessas(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const commessas = await dataverseService.getCommesse();
    
    return {
      status: 200,
      jsonBody: {
        success: true,
        data: commessas
      }
    };
  } catch (error: any) {
    console.error('Dataverse error:', error.message);
    return {
      status: 500,
      jsonBody: {
        error: 'Failed to fetch commessas',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    };
  }
}

app.http('dataverseCommessas', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'dataverse/commessas',
  handler: dataverseCommessas
});
