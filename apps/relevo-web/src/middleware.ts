import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const COOKIE_NAME = 'relevo-auth-token';

/**
 * Decode a JWT payload (base64url → JSON) without verifying the signature.
 * The backend already validated the token — we just need the user info.
 * Works in Edge runtime (uses Buffer which is available in Edge).
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Middleware — protects /dashboard/* routes.
 * Checks for the relevo-auth-token cookie and validates user status.
 *
 * Public routes (no auth required):
 *   /, /login, /register, /pending
 *
 * Protected routes (require active status):
 *   /dashboard/*, /dashboard
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes — always allow
  const publicRoutes = ['/', '/login', '/register', '/pending'];
  if (publicRoutes.includes(pathname)) {
    const response = NextResponse.next();
    response.headers.set('X-Tenant-Brand', 'relevo');
    return response;
  }

  // All other routes require a valid token
  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Decode JWT to check status
  const payload = decodeJwtPayload(token);

  if (!payload || !payload.sub) {
    // Invalid token — redirect to login
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  // Check token expiration — consistent with session route
  if (payload.exp && Date.now() >= Number(payload.exp) * 1000) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(COOKIE_NAME);
    return response;
  }

  const userStatus = String(payload.status ?? 'active');

  // If user is not active, redirect to /pending
  if (userStatus !== 'active') {
    const pendingUrl = new URL('/pending', req.url);
    return NextResponse.redirect(pendingUrl);
  }

  const mustChangePassword = Boolean(payload.must_change_password ?? false);

  if (mustChangePassword) {
    if (pathname !== '/change-password') {
      const changePasswordUrl = new URL('/change-password', req.url);
      return NextResponse.redirect(changePasswordUrl);
    }
  } else {
    if (pathname === '/change-password') {
      const dashboardUrl = new URL('/dashboard', req.url);
      return NextResponse.redirect(dashboardUrl);
    }
  }

  // User is active — allow access
  const response = NextResponse.next();
  response.headers.set('X-Tenant-Brand', 'relevo');
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/dashboard', '/pending', '/login', '/register', '/change-password'],
};
