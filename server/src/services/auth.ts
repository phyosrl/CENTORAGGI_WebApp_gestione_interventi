import { HttpRequest, HttpResponseInit } from '@azure/functions';
import crypto from 'node:crypto';

export interface AuthenticatedUser {
  id: string;
  nome: string;
  exp: number;
}

function getTokenSecret(): string {
  return process.env.APP_TOKEN_SECRET || process.env.DATAVERSE_CLIENT_SECRET || 'centoraggi-local-dev-secret';
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export function issueSessionToken(user: { id: string; nome: string }, expiresInHours = 12): string {
  const payload: AuthenticatedUser = {
    id: user.id,
    nome: user.nome,
    exp: Date.now() + expiresInHours * 60 * 60 * 1000,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', getTokenSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

export function verifySessionToken(token?: string | null): AuthenticatedUser | null {
  if (!token) return null;

  const [encodedPayload, receivedSignature] = token.split('.');
  if (!encodedPayload || !receivedSignature) return null;

  const expectedSignature = crypto
    .createHmac('sha256', getTokenSecret())
    .update(encodedPayload)
    .digest('base64url');

  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(encodedPayload)) as AuthenticatedUser;
    if (!parsed.id || !parsed.nome || !parsed.exp || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getUserFromRequest(request: HttpRequest): AuthenticatedUser | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifySessionToken(authHeader.slice('Bearer '.length).trim());
}

export function requireAuth(request: HttpRequest): { user?: undefined; response: HttpResponseInit } | { user: AuthenticatedUser; response?: undefined } {
  const user = getUserFromRequest(request);
  if (!user) {
    return {
      response: {
        status: 401,
        jsonBody: { error: 'Sessione non valida o scaduta' },
      },
    };
  }

  return { user };
}

export function isGuid(value?: string | null): boolean {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(value ?? '');
}
