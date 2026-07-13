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
  tenantId: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
}

// ─── Constants ──────────────────────────────────────────

const USER_STORAGE_KEY = 'relevo-auth-user';

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
  brand: 'tiza' | 'relevo' = 'relevo'
): Promise<{ user: AuthUser; token: string }> {
  // 1. Authenticate
  const loginRes = await apiFetch<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  // 2. Get user profile with the fresh token
  const userData = await apiFetch<{
    id: string;
    email: string;
    name: string;
    role: string;
    tenant_id: string;
  }>('/api/auth/me', {
    token: loginRes.access_token,
  });

  const user: AuthUser = {
    id: userData.id,
    email: userData.email,
    name: userData.name,
    role: userData.role,
    tenantId: userData.tenant_id,
  };

  // 3. Persist
  await setTokenCookie(loginRes.access_token);
  storeUser(user);

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
  await clearTokenCookie();
  clearStoredUser();
}
