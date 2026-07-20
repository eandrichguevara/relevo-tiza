/**
 * Auth utilities — direct JWT-based authentication (no NextAuth).
 *
 * Flow:
 *   register → POST /api/auth/register → redirect to /login
 *   login    → POST /api/auth/login → GET /api/auth/me → store JWT → dashboard
 *   logout   → clear cookie + localStorage → redirect to /
 *
 * The JWT token is stored in an HttpOnly cookie (set via a Next.js API route)
 * to prevent XSS attacks. The token is also held in React state via AuthContext
 * for use in API calls. On page refresh, the token is restored from the HttpOnly
 * cookie via GET /api/auth/session.
 * User profile is cached in localStorage for fast restoration on refresh.
 */
import { apiFetch } from './api';

// ─── Types ──────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  rejectionReason?: string;
  mustChangePassword?: boolean;
  tenantId: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ─── Constants ──────────────────────────────────────────

const USER_STORAGE_KEY = 'tiza-auth-user';
const TOKEN_STORAGE_KEY = 'tiza-auth-token-jwt';

/**
 * Reads the JWT token from sessionStorage.
 * The token is stored here during login and session restoration
 * so client components can access it synchronously without a
 * network call to /api/auth/session.
 */
export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Stores the JWT token in sessionStorage for client-side access.
 * Called automatically by loginUser() and by the AuthProvider
 * when a session is restored on page refresh.
 */
export function setTokenJwt(token: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Silently fail — degraded UX but non-fatal
  }
}

// ─── Cookie helpers ─────────────────────────────────────

/**
 * Reads the auth token from the HttpOnly cookie via the session API route.
 * Used on mount to restore session on page refresh.
 */
export async function fetchTokenFromSession(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/session');
    if (!res.ok) return null;
    const data = await res.json();
    return data.accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Stores the token as an HttpOnly, Secure, SameSite=Strict cookie
 * via the Next.js API route set-token. This prevents XSS from reading
 * the token via document.cookie.
 */
export async function setTokenCookie(token: string): Promise<void> {
  await fetch('/api/auth/set-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
}

/**
 * Clears the auth cookie by posting an empty token to set-token.
 */
export async function clearTokenCookie(): Promise<void> {
  await fetch('/api/auth/set-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: '' }),
  });
}

// ─── User storage helpers ───────────────────────────────

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeUser(user: AuthUser): void {
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearStoredUser(): void {
  localStorage.removeItem(USER_STORAGE_KEY);
}

// ─── Auth API calls ─────────────────────────────────────

export async function loginUser(
  email: string,
  password: string,
  brand: 'tiza' | 'relevo' = 'tiza'
): Promise<{ user: AuthUser; token: string }> {
  // 1. Authenticate
  const loginRes = await apiFetch<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const userData = await apiFetch<{
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    rejection_reason?: string;
    must_change_password: boolean;
    tenant_id: string;
  }>('/api/auth/me', {
    token: loginRes.access_token,
  });

  const user: AuthUser = {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    role: userData.role,
    status: userData.status,
    rejectionReason: userData.rejection_reason,
    mustChangePassword: userData.must_change_password,
    tenantId: userData.tenant_id,
  };

  // 3. Persist
  await setTokenCookie(loginRes.access_token);
  storeUser(user);
  setTokenJwt(loginRes.access_token);

  return { user, token: loginRes.access_token };
}

export async function registerUser(data: {
  name: string;
  email: string;
  password: string;
  role: string;
  school?: string;
}): Promise<void> {
  await apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function clearAuth(): Promise<void> {
  try {
    await clearTokenCookie();
  } catch {
    // Cookie clear failed, but we still clean up localStorage
    console.error('[clearAuth] Failed to clear token cookie');
  } finally {
    clearStoredUser();
    setTokenJwt(null);
  }
}

export async function changePasswordUser(
  currentPass: string,
  newPass: string,
  currentToken: string
): Promise<{ user: AuthUser; token: string }> {
  const changeRes = await apiFetch<TokenResponse>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password: currentPass, new_password: newPass }),
    token: currentToken,
  });

  const userData = await apiFetch<{
    id: string;
    email: string;
    name: string;
    role: string;
    status: string;
    rejection_reason?: string;
    must_change_password: boolean;
    tenant_id: string;
  }>('/api/auth/me', {
    token: changeRes.access_token,
  });

  const user: AuthUser = {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    role: userData.role,
    status: userData.status,
    rejectionReason: userData.rejection_reason,
    mustChangePassword: userData.must_change_password,
    tenantId: userData.tenant_id,
  };

  await setTokenCookie(changeRes.access_token);
  storeUser(user);
  setTokenJwt(changeRes.access_token);

  return { user, token: changeRes.access_token };
}
