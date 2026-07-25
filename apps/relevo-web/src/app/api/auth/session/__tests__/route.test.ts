import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

function createSessionRequest(token?: string): NextRequest {
  const url = new URL('http://localhost:3002/api/auth/session');
  const headers = new Headers();

  if (token) {
    headers.set('cookie', `relevo-auth-token=${token}`);
  }

  return new NextRequest(url, { headers });
}

function buildJwt(payload: Record<string, unknown>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

  return `${encode(header)}.${encode(payload)}.fake-signature`;
}

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  it('retorna user y accessToken cuando el token es válido', async () => {
    const payload = {
      sub: 'user-1',
      email: 'director@colegio.cl',
      name: 'Director Test',
      role: 'GESTION',
      status: 'active',
      tenant_id: 't1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = buildJwt(payload);
    const req = createSessionRequest(token);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toEqual({
      id: 'user-1',
      email: 'director@colegio.cl',
      name: 'Director Test',
      role: 'GESTION',
      status: 'active',
      tenantId: 't1',
    });
    expect(body.accessToken).toBe(token);
  });

  it('retorna user y accessToken cuando el token no tiene exp', async () => {
    const payload = {
      sub: 'user-2',
      email: 'test@test.com',
      name: 'Test',
      role: 'TEACHER',
      tenant_id: 't1',
    };
    const token = buildJwt(payload);
    const req = createSessionRequest(token);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toBeDefined();
    expect(body.user.id).toBe('user-2');
    expect(body.accessToken).toBe(token);
  });

  it('retorna user y accessToken cuando el token tiene status "pending"', async () => {
    const payload = {
      sub: 'user-3',
      email: 'pending@test.com',
      name: 'Pending User',
      role: 'GESTION',
      status: 'pending',
      tenant_id: 't1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = buildJwt(payload);
    const req = createSessionRequest(token);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.status).toBe('pending');
    expect(body.accessToken).toBe(token);
  });

  it('retorna user null cuando no hay cookie', async () => {
    const req = createSessionRequest();
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toBeNull();
    expect(body.accessToken).toBeNull();
  });

  it('retorna user null cuando el payload no tiene sub', async () => {
    const payload = { email: 'no-sub@test.com', exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = buildJwt(payload);
    const req = createSessionRequest(token);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toBeNull();
    expect(body.accessToken).toBeNull();
  });

  it('retorna user null cuando el token está expirado', async () => {
    const payload = {
      sub: 'user-expired',
      email: 'expired@test.com',
      name: 'Expired',
      role: 'GESTION',
      tenant_id: 't1',
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1h ago
    };
    const token = buildJwt(payload);
    const req = createSessionRequest(token);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toBeNull();
    expect(body.accessToken).toBeNull();
  });

  it('retorna user null cuando el token es inválido (no tiene 2 segmentos)', async () => {
    const req = createSessionRequest('invalid-token-format');
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toBeNull();
    expect(body.accessToken).toBeNull();
  });

  it('retorna user null cuando el payload no es JSON válido', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' }))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    // Payload is not valid base64-encoded JSON
    const req = createSessionRequest(`${header}.invalid-json-payload.signature`);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toBeNull();
    expect(body.accessToken).toBeNull();
  });

  it('retorna user null cuando exp es justo el momento actual (borde exacto)', async () => {
    const payload = {
      sub: 'user-edge',
      email: 'edge@test.com',
      name: 'Edge Case',
      role: 'GESTION',
      tenant_id: 't1',
      exp: Math.floor(Date.now() / 1000), // exact current time
    };
    const token = buildJwt(payload);
    const req = createSessionRequest(token);
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user).toBeNull();
    expect(body.accessToken).toBeNull();
  });
});
