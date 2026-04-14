import { app, HttpRequest, HttpResponseInit } from "@azure/functions";
import axios from "axios";

export async function authCallback(request: HttpRequest): Promise<HttpResponseInit> {
  try {
    const code = request.query.get('code');
    const state = request.query.get('state');
    const error = request.query.get('error');
    const error_description = request.query.get('error_description');

    // Handle OAuth errors
    if (error) {
      return {
        status: 400,
        jsonBody: {
          error: 'OAuth Error',
          message: error_description || error
        }
      };
    }

    if (!code) {
      return {
        status: 400,
        jsonBody: { error: 'Missing authorization code' }
      };
    }

    // Exchange auth code for access token
    const tokenUrl = `https://login.microsoftonline.com/${process.env.DATAVERSE_TENANT_ID}/oauth2/v2.0/token`;

    const tokenResponse = await axios.post(tokenUrl, new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: process.env.DATAVERSE_CLIENT_ID || '',
      client_secret: process.env.DATAVERSE_CLIENT_SECRET || '',
      redirect_uri: `${process.env.API_URL}/auth/callback`,
      scope: `${process.env.DATAVERSE_URL}/.default`
    }));

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    return {
      status: 200,
      jsonBody: {
        success: true,
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in,
        state: state
      }
    };

  } catch (error: any) {
    console.error('Auth callback error:', error.response?.data || error.message);
    return {
      status: 500,
      jsonBody: {
        error: 'Token exchange failed',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      }
    };
  }
}

app.http('authCallback', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/callback',
  handler: authCallback
});
