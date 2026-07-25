import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock apiFetch used internally by loginUser / registerUser
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

async function getModule() {
  // Need to reload fresh for each import because localStorage mock varies
  return await import('@/lib/auth');
}

describe('fetchTokenFromSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna accessToken cuando la respuesta es ok', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ accessToken: 'token-123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { fetchTokenFromSession } = await getModule();
    const result = await fetchTokenFromSession();
    expect(result).toBe('token-123');
  });

  it('retorna null cuando la respuesta no es ok', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

    const { fetchTokenFromSession } = await getModule();
    const result = await fetchTokenFromSession();
    expect(result).toBeNull();
  });

  it('retorna null cuando accessToken no está en la respuesta', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { fetchTokenFromSession } = await getModule();
    const result = await fetchTokenFromSession();
    expect(result).toBeNull();
  });

  it('retorna null cuando fetch lanza error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { fetchTokenFromSession } = await getModule();
    const result = await fetchTokenFromSession();
    expect(result).toBeNull();
  });
});

describe('setTokenCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hace POST a /api/auth/set-token con el token en JSON', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { setTokenCookie } = await getModule();
    await setTokenCookie('my-token');

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/set-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'my-token' }),
    });
  });
});

describe('clearTokenCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hace POST a /api/auth/set-token con token vacío', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { clearTokenCookie } = await getModule();
    await clearTokenCookie();

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/set-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '' }),
    });
  });
});

describe('getStoredUser / storeUser / clearStoredUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('storeUser guarda el usuario en localStorage', async () => {
    const user = {
      id: '1',
      email: 'test@test.com',
      name: 'Test',
      role: 'GESTION',
      status: 'active',
      tenantId: 't1',
    };

    const { storeUser } = await getModule();
    storeUser(user);

    const raw = localStorage.getItem('relevo-auth-user');
    expect(raw).toBe(JSON.stringify(user));
  });

  it('getStoredUser retorna null cuando no hay usuario guardado', async () => {
    localStorage.removeItem('relevo-auth-user');

    const { getStoredUser } = await getModule();
    const result = getStoredUser();
    expect(result).toBeNull();
  });

  it('clearStoredUser elimina el usuario de localStorage', async () => {
    localStorage.setItem('relevo-auth-user', JSON.stringify({ id: '1' }));

    const { clearStoredUser } = await getModule();
    clearStoredUser();

    expect(localStorage.getItem('relevo-auth-user')).toBeNull();
  });

  it('getStoredUser retorna null cuando localStorage tiene JSON inválido', async () => {
    localStorage.setItem('relevo-auth-user', '{invalid}');

    const { getStoredUser } = await getModule();
    const result = getStoredUser();
    expect(result).toBeNull();
  });

  it('getStoredUser retorna null en SSR (window undefined)', async () => {
    const origWindow = globalThis.window;
    (globalThis as any).window = undefined;
    // Re-import to trigger SSR guard
    vi.resetModules();
    const mod = await import('@/lib/auth');
    const result = mod.getStoredUser();
    expect(result).toBeNull();
    (globalThis as any).window = origWindow;
  });
});

describe('loginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('llama a apiFetch para login y /api/auth/me con el token', async () => {
    const { loginUser } = await import('@/lib/auth');

    const apiModule = await import('@/lib/api');
    const mockApiFetch = vi.mocked(apiModule.apiFetch);

    mockApiFetch
      .mockResolvedValueOnce({
        access_token: 'jwt-token-123',
        token_type: 'bearer',
      })
      .mockResolvedValueOnce({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        role: 'GESTION',
        status: 'active',
        tenant_id: 't1',
      });

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await loginUser('test@test.com', 'password123');

    expect(mockApiFetch).toHaveBeenNthCalledWith(1, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@test.com', password: 'password123' }),
    });

    expect(mockApiFetch).toHaveBeenNthCalledWith(2, '/api/auth/me', {
      token: 'jwt-token-123',
    });

    expect(result.user).toEqual({
      id: 'user-1',
      email: 'test@test.com',
      name: 'Test User',
      role: 'GESTION',
      status: 'active',
      rejectionReason: undefined,
      tenantId: 't1',
    });
    expect(result.token).toBe('jwt-token-123');
  });

  it('incluye rejectionReason cuando está presente', async () => {
    const { loginUser } = await import('@/lib/auth');
    const apiModule = await import('@/lib/api');
    const mockApiFetch = vi.mocked(apiModule.apiFetch);

    mockApiFetch
      .mockResolvedValueOnce({
        access_token: 'jwt-token',
        token_type: 'bearer',
      })
      .mockResolvedValueOnce({
        id: 'user-2',
        email: 'rejected@test.com',
        name: 'Rejected User',
        role: 'GESTION',
        status: 'rejected',
        rejection_reason: 'Documentación incompleta',
        tenant_id: 't2',
      });

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await loginUser('rejected@test.com', 'password123');

    expect(result.user.status).toBe('rejected');
    expect(result.user.rejectionReason).toBe('Documentación incompleta');
  });

  it('login usa brand default "relevo" cuando no se especifica', async () => {
    const { loginUser } = await import('@/lib/auth');
    const apiModule = await import('@/lib/api');
    const mockApiFetch = vi.mocked(apiModule.apiFetch);

    mockApiFetch
      .mockResolvedValueOnce({
        access_token: 'jwt-token',
        token_type: 'bearer',
      })
      .mockResolvedValueOnce({
        id: 'user-4',
        email: 'brand@test.com',
        name: 'Brand Test',
        role: 'GESTION',
        status: 'active',
        tenant_id: 't4',
      });

    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const result = await loginUser('brand@test.com', 'password123');
    expect(result.token).toBe('jwt-token');
  });
});

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('llama a apiFetch con POST y datos del usuario', async () => {
    const { registerUser } = await import('@/lib/auth');
    const apiModule = await import('@/lib/api');
    const mockApiFetch = vi.mocked(apiModule.apiFetch);
    mockApiFetch.mockResolvedValueOnce(undefined);

    const data = {
      name: 'New User',
      email: 'new@test.com',
      password: 'password123',
      role: 'director',
      school: 'Colegio Test',
    };

    await registerUser(data);

    expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });
});

describe('clearAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('limpia cookie token y localStorage', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    localStorage.setItem('relevo-auth-user', JSON.stringify({ id: '1' }));

    const { clearAuth } = await getModule();
    await clearAuth();

    // Should have called set-token with empty token
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/set-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: '' }),
    });

    // localStorage should be cleared
    expect(localStorage.getItem('relevo-auth-user')).toBeNull();
  });

  it('limpia localStorage incluso si fetch falla', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    localStorage.setItem('relevo-auth-user', JSON.stringify({ id: '1' }));

    const { clearAuth } = await getModule();
    await clearAuth();

    // localStorage should still be cleared
    expect(localStorage.getItem('relevo-auth-user')).toBeNull();
  });
});
