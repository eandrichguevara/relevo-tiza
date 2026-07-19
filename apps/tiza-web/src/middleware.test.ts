import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

/**
 * Helper to create a mock NextRequest for middleware testing.
 *
 * @param pathname  — e.g. '/dashboard/cursos'
 * @param token     — optional cookie value for tiza-auth-token
 */
function createMiddlewareRequest(pathname: string, token?: string): NextRequest {
  const url = new URL(`http://localhost:3001${pathname}`);
  const headers = new Headers();

  const cookieStr = token ? `tiza-auth-token=${token}` : '';
  headers.set('cookie', cookieStr);

  return new NextRequest(url, { headers });
}

/**
 * Build a valid-looking JWT with a given payload.
 * JWT format: base64url(header).base64url(payload).signature
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

describe('middleware (tiza-web)', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  // ─── Public routes ────────────────────────────────────────────

  describe('public routes', () => {
    it.each(['/', '/login', '/register', '/pending'])(
      'permite acceso a %s sin token',
      async (pathname) => {
        const req = createMiddlewareRequest(pathname);
        const response = await middleware(req);

        expect(response.status).toBe(200);
        expect(response.headers.get('X-Tenant-Brand')).toBe('tiza');
      }
    );

    it('NO redirige a /login en rutas públicas incluso sin token', async () => {
      const req = createMiddlewareRequest('/login');
      const response = await middleware(req);

      // Should be a normal response, not a redirect
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    });
  });

  // ─── No token ─────────────────────────────────────────────────

  describe('sin token', () => {
    it('redirige a /login con callbackUrl cuando no hay cookie', async () => {
      const req = createMiddlewareRequest('/dashboard/cursos');
      const response = await middleware(req);

      expect(response.status).toBe(307); // redirect
      const location = response.headers.get('location');
      expect(location).toContain('/login');
      expect(location).toContain('callbackUrl=%2Fdashboard%2Fcursos');
    });

    it('redirige a /login con callbackUrl para /dashboard raíz', async () => {
      const req = createMiddlewareRequest('/dashboard');
      const response = await middleware(req);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
      expect(location).toContain('callbackUrl=%2Fdashboard');
    });
  });

  // ─── Invalid token ────────────────────────────────────────────

  describe('token inválido', () => {
    it('redirige a /login cuando la cookie tiene un valor no-JWT', async () => {
      const req = createMiddlewareRequest('/dashboard/cursos', 'not-a-jwt');
      const response = await middleware(req);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
    });

    it('elimina la cookie al redirigir por token inválido', async () => {
      const req = createMiddlewareRequest('/dashboard/cursos', 'not-a-jwt');
      const response = await middleware(req);

      // The response should set a Set-Cookie header that clears tiza-auth-token
      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('tiza-auth-token=');
      // Next.js cookies.delete() usa Expires en lugar de Max-Age
      expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
    });

    it('redirige a /login cuando JWT no tiene payload (solo 1 segmento)', async () => {
      const req = createMiddlewareRequest('/dashboard/cursos', 'only-header');
      const response = await middleware(req);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
    });

    it('redirige a /login cuando JWT tiene payload no-JSON', async () => {
      // Segmento que no es JSON válido
      const badPayload = 'eyJhbGciOiJIUzI1NiJ9.invalid-json-but-base64.fake-sig';
      const req = createMiddlewareRequest('/dashboard/cursos', badPayload);
      const response = await middleware(req);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
    });

    it('redirige a /login cuando payload no tiene sub', async () => {
      // JWT sin sub
      const noSubPayload = { exp: 9999999999, status: 'active' };
      const req = createMiddlewareRequest('/dashboard/cursos', buildJwt(noSubPayload));
      const response = await middleware(req);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
    });
  });

  // ─── Expired token ────────────────────────────────────────────

  describe('token expirado', () => {
    it('redirige a /login cuando JWT está expirado (exp en el pasado)', async () => {
      const expiredPayload = {
        sub: 'user-1',
        exp: Math.floor(Date.now() / 1000) - 3600, // 1h en el pasado
        status: 'active',
      };
      const req = createMiddlewareRequest('/dashboard/cursos', buildJwt(expiredPayload));
      const response = await middleware(req);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
    });

    it('elimina la cookie expirada al redirigir', async () => {
      const expiredPayload = {
        sub: 'user-1',
        exp: Math.floor(Date.now() / 1000) - 60,
        status: 'active',
      };
      const req = createMiddlewareRequest('/dashboard/cursos', buildJwt(expiredPayload));
      const response = await middleware(req);

      const setCookie = response.headers.get('set-cookie');
      expect(setCookie).toContain('tiza-auth-token=');
      // Next.js cookies.delete() usa Expires en lugar de Max-Age
      expect(setCookie).toContain('Expires=Thu, 01 Jan 1970');
    });

    it('NO redirige por expiración si el token NO tiene exp en el payload', async () => {
      const noExpPayload = { sub: 'user-1', status: 'active' };
      const req = createMiddlewareRequest('/dashboard/cursos', buildJwt(noExpPayload));
      const response = await middleware(req);

      // Sin exp, asume que el token es válido → debe pasar (X-Tenant-Brand)
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Tenant-Brand')).toBe('tiza');
    });

    it('NO redirige por expiración si exp es null', async () => {
      const nullExpPayload = { sub: 'user-1', exp: null, status: 'active' };
      const req = createMiddlewareRequest('/dashboard/cursos', buildJwt(nullExpPayload));
      const response = await middleware(req);

      // null exp → condición `payload.exp && Date.now() >= ...` es false
      expect(response.status).toBe(200);
      expect(response.headers.get('X-Tenant-Brand')).toBe('tiza');
    });

    it('redirige a /login cuando exp es justo el momento actual (borde exacto)', async () => {
      const exactExpPayload = {
        sub: 'user-1',
        exp: Math.floor(Date.now() / 1000),
        status: 'active',
      };
      const req = createMiddlewareRequest('/dashboard/cursos', buildJwt(exactExpPayload));
      const response = await middleware(req);

      // Date.now() >= Number(payload.exp) * 1000 => true en este instante
      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/login');
    });
  });

  // ─── User status ──────────────────────────────────────────────

  describe('user status', () => {
    it('permite acceso cuando status es "active"', async () => {
      const activePayload = {
        sub: 'user-1',
        exp: Math.floor(Date.now() / 1000) + 3600,
        status: 'active',
      };
      const req = createMiddlewareRequest('/dashboard/cursos', buildJwt(activePayload));
      const response = await middleware(req);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Tenant-Brand')).toBe('tiza');
    });

    it('redirige a /pending cuando status es "pending"', async () => {
      const pendingPayload = {
        sub: 'user-2',
        exp: Math.floor(Date.now() / 1000) + 3600,
        status: 'pending',
      };
      const req = createMiddlewareRequest('/dashboard/cursos', buildJwt(pendingPayload));
      const response = await middleware(req);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/pending');
    });

    it('redirige a /pending cuando status es "rejected"', async () => {
      const rejectedPayload = {
        sub: 'user-3',
        exp: Math.floor(Date.now() / 1000) + 3600,
        status: 'rejected',
      };
      const req = createMiddlewareRequest('/dashboard/cursos', buildJwt(rejectedPayload));
      const response = await middleware(req);

      expect(response.status).toBe(307);
      const location = response.headers.get('location');
      expect(location).toContain('/pending');
    });

    it('permite acceso cuando status no está en el payload (asume active)', async () => {
      const noStatusPayload = {
        sub: 'user-4',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const req = createMiddlewareRequest('/dashboard/cursos', buildJwt(noStatusPayload));
      const response = await middleware(req);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Tenant-Brand')).toBe('tiza');
    });

    it('permite acceso cuando status es undefined (asume active)', async () => {
      const undefinedStatusPayload = {
        sub: 'user-5',
        exp: Math.floor(Date.now() / 1000) + 3600,
        status: undefined,
      };
      const req = createMiddlewareRequest('/dashboard/cursos', buildJwt(undefinedStatusPayload));
      const response = await middleware(req);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Tenant-Brand')).toBe('tiza');
    });
  });

  // ─── X-Tenant-Brand header ─────────────────────────────────────

  describe('X-Tenant-Brand header', () => {
    it('establece X-Tenant-Brand: tiza en rutas públicas', async () => {
      const req = createMiddlewareRequest('/');
      const response = await middleware(req);
      expect(response.headers.get('X-Tenant-Brand')).toBe('tiza');
    });

    it('establece X-Tenant-Brand: tiza en rutas protegidas con token válido', async () => {
      const validPayload = {
        sub: 'user-1',
        exp: Math.floor(Date.now() / 1000) + 3600,
        status: 'active',
      };
      const req = createMiddlewareRequest('/dashboard', buildJwt(validPayload));
      const response = await middleware(req);

      expect(response.status).toBe(200);
      expect(response.headers.get('X-Tenant-Brand')).toBe('tiza');
    });
  });
});
