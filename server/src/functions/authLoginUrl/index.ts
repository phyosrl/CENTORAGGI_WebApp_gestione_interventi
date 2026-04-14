import { app, HttpRequest, HttpResponseInit } from "@azure/functions";

export async function authLoginUrl(request: HttpRequest): Promise<HttpResponseInit> {
  const state = Math.random().toString(36).substring(7);
  const clientId = process.env.DATAVERSE_CLIENT_ID;
  const redirectUri = `${process.env.API_URL}/auth/callback`;
  const scope = `${process.env.DATAVERSE_URL}/.default offline_access`;

  const loginUrl = `https://login.microsoftonline.com/${process.env.DATAVERSE_TENANT_ID}/oauth2/v2.0/authorize?` +
    `client_id=${clientId}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&state=${state}`;

  return {
    status: 200,
    jsonBody: {
      loginUrl,
      state
    }
  };
}

app.http('authLoginUrl', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/login-url',
  handler: authLoginUrl
});
