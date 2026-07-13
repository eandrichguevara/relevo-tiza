import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware — protects /dashboard/* routes.
 * Checks for the tiza-auth-token cookie set by the login flow.
 * If missing, redirects to /login.
 */
export function middleware(req: NextRequest) {
  const token = req.cookies.get('tiza-auth-token')?.value;

  if (!token) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set('X-Tenant-Brand', 'tiza');
  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/dashboard'],
};
