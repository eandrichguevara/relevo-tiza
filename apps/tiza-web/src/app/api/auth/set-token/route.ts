import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'tiza-auth-token';
const COOKIE_MAX_AGE = 86400; // 24h — matches JWT_EXPIRATION_MINUTES

/**
 * POST /api/auth/set-token
 *
 * Receives a JWT token from the client and sets it as an HttpOnly,
 * Secure, SameSite=Strict cookie. This prevents XSS attacks from
 * reading the token via document.cookie, while still allowing the
 * middleware and server components to authenticate the user.
 *
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: COOKIE_MAX_AGE,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
