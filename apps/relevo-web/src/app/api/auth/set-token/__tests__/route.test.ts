import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

function createMockRequest(body: unknown): NextRequest {
  const url = 'http://localhost:3002/api/auth/set-token';
  const request = new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return request;
}

describe('POST /api/auth/set-token (relevo-web)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('retorna success: true con token válido', async () => {
    const req = createMockRequest({ token: 'my-jwt-token' });
    const response = await POST(req);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  it('establece cookie HttpOnly con el token y maxAge de 24h', async () => {
    const req = createMockRequest({ token: 'my-jwt-token' });
    const response = await POST(req);

    const authCookie = response.cookies.get('relevo-auth-token');

    expect(authCookie).toBeDefined();
    expect(authCookie!.value).toBe('my-jwt-token');
    expect(authCookie!.httpOnly).toBe(true);
    expect(authCookie!.sameSite).toBe('strict');
    expect(authCookie!.path).toBe('/');
    expect(authCookie!.maxAge).toBe(86400); // 24h
  });

  it('establece secure=true cuando NODE_ENV es production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const req = createMockRequest({ token: 'my-jwt-token' });
    const response = await POST(req);

    const authCookie = response.cookies.get('relevo-auth-token');
    expect(authCookie!.secure).toBe(true);
  });

  it('establece secure=false cuando NODE_ENV no es production', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const req = createMockRequest({ token: 'my-jwt-token' });
    const response = await POST(req);

    const authCookie = response.cookies.get('relevo-auth-token');
    expect(authCookie!.secure).toBe(false);
  });

  describe('limpiar cookie con token vacío (logout)', () => {
    it('limpia la cookie cuando token es string vacío', async () => {
      const req = createMockRequest({ token: '' });
      const response = await POST(req);

      const authCookie = response.cookies.get('relevo-auth-token');
      expect(authCookie).toBeDefined();
      expect(authCookie!.value).toBe('');
      expect(authCookie!.maxAge).toBe(0);
    });

    it('limpia la cookie cuando token es null', async () => {
      const req = createMockRequest({ token: null });
      const response = await POST(req);

      const authCookie = response.cookies.get('relevo-auth-token');
      expect(authCookie).toBeDefined();
      expect(authCookie!.value).toBe('');
      expect(authCookie!.maxAge).toBe(0);
    });

    it('limpia la cookie cuando token es undefined', async () => {
      const req = createMockRequest({});
      const response = await POST(req);

      const authCookie = response.cookies.get('relevo-auth-token');
      expect(authCookie).toBeDefined();
      expect(authCookie!.value).toBe('');
      expect(authCookie!.maxAge).toBe(0);
    });
  });

  describe('manejo de errores', () => {
    it('retorna 400 cuando el body no es JSON válido', async () => {
      const url = 'http://localhost:3002/api/auth/set-token';
      const request = new NextRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid json}',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body).toEqual({ error: 'Invalid request body' });
    });
  });
});
