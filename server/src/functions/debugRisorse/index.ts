import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import { DataverseService } from "../../services/dataverseService.js";

const dataverseService = new DataverseService(
  process.env.DATAVERSE_URL || '',
  process.env.DATAVERSE_CLIENT_ID || '',
  process.env.DATAVERSE_CLIENT_SECRET || '',
  process.env.DATAVERSE_TENANT_ID || ''
);

export async function debugRisorse(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const risorse = await dataverseService.query(
      'phyo_risorses',
      undefined,
      ['phyo_risorseid', 'phyo_name', 'phyo_password']
    );
    return {
      status: 200,
      jsonBody: { data: risorse }
    };
  } catch (error: any) {
    return {
      status: 500,
      jsonBody: { error: error.message }
    };
  }
}

app.http('debugRisorse', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'debug/risorse',
  handler: debugRisorse
});
