import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

/**
 * Helper to create a mock NextRequest with a cookie.
 */
function createSessionRequest(token?: string): NextRequest {
  const url = 'http://localhost:3001/api/auth/session';
  const headers = new Headers();
  if (token) {
    headers.set('cookie', `tiza-auth-token=${token}`);
  }
  return new NextRequest(url, { headers });
}

/**
 * Build a valid-looking JWT with a given payload.
 */
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

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('retorna user y accessToken cuando hay token válido', async () => {
    const payload = {
      sub: 'user-1',
      email: 'teacher@test.com',
      name: 'Profesor Test',
      role: 'teacher',
      status: 'active',
      tenant_id: 'tenant-1',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const req = createSessionRequest(buildJwt(payload));
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      user: {
        id: 'user-1',
        email: 'teacher@test.com',
        name: 'Profesor Test',
        role: 'teacher',
        status: 'active',
        tenantId: 'tenant-1',
      },
      accessToken: expect.any(String),
    });
  });

  it('retorna user null y accessToken null cuando no hay cookie', async () => {
    const req = createSessionRequest();
    const response = await GET(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ user: null, accessToken: null });
  });

  it('retorna user null y accessToken null cuando el token no es válido (no-JWT)', async () => {
    const req = createSessionRequest('not-a-jwt');
    const response = await GET(req);

    const body = await response.json();
    expect(body).toEqual({ user: null, accessToken: null });
  });

  it('retorna user null cuando el token no tiene sub', async () => {
    const payload = { email: 'test@test.com', exp: Math.floor(Date.now() / 1000) + 3600 };
    const req = createSessionRequest(buildJwt(payload));
    const response = await GET(req);

    const body = await response.json();
    expect(body).toEqual({ user: null, accessToken: null });
  });

  it('retorna null cuando el token está expirado', async () => {
    const payload = {
      sub: 'user-1',
      email: 'test@test.com',
      exp: Math.floor(Date.now() / 1000) - 3600,
    };
    const req = createSessionRequest(buildJwt(payload));
    const response = await GET(req);

    const body = await response.json();
    expect(body).toEqual({ user: null, accessToken: null });
  });

  it('retorna user con valores por defecto cuando faltan campos opcionales', async () => {
    const payload = { sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 };
    const req = createSessionRequest(buildJwt(payload));
    const response = await GET(req);

    const body = await response.json();
    expect(body.user).toEqual({
      id: 'user-1',
      email: '',
      name: '',
      role: '',
      status: 'active',
      tenantId: '',
    });
    expect(body.accessToken).toBeTruthy();
  });

  it('retorna user con status "active" por defecto cuando no está en payload', async () => {
    const payload = {
      sub: 'user-2',
      email: 'pending@test.com',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const req = createSessionRequest(buildJwt(payload));
    const response = await GET(req);

    const body = await response.json();
    expect(body.user.status).toBe('active');
  });
});
