import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'tiza-auth-token';

/**
 * Decode a JWT payload (base64url → JSON) without verifying the signature.
 * The backend already validated the token — we just need the user info.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    // Standard base64url → base64 conversion for atob
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * GET /api/auth/session
 *
 * Reads the tiza-auth-token cookie, decodes the JWT payload,
 * and returns the user info + raw access token so the client
 * can use it in Authorization headers for backend API calls.
 *
 * Response shape:
 *   { user: { id, email, name, role, tenantId } | null, accessToken: string | null }
 */
export async function GET(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value ?? null;

  if (!token) {
    return NextResponse.json({ user: null, accessToken: null });
  }

  const payload = decodeJwtPayload(token);

  if (!payload || !payload.sub) {
    return NextResponse.json({ user: null, accessToken: null });
  }

  // Validate JWT expiration
  if (payload.exp && Date.now() >= Number(payload.exp) * 1000) {
    return NextResponse.json({ user: null, accessToken: null });
  }

  const user = {
    id: String(payload.sub),
    email: String(payload.email ?? ''),
    name: String(payload.name ?? ''),
    role: String(payload.role ?? ''),
    status: String(payload.status ?? 'active'),
    tenantId: String(payload.tenant_id ?? ''),
  };

  return NextResponse.json({ user, accessToken: token });
}
