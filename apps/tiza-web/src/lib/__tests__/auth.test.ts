import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mocks must be set up BEFORE importing the module
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((_index: number) => ''),
  };
})();
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock });

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((_index: number) => ''),
  };
})();
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock window to be defined
vi.stubGlobal('window', {});
vi.stubGlobal('document', {});

async function getModule() {
  // Clear all storage before each import
  sessionStorageMock.clear();
  localStorageMock.clear();
  vi.clearAllMocks();

  // Re-stub globals after clear
  Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock });
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

  return await import('@/lib/auth');
}

describe('getToken / setTokenJwt', () => {
  beforeEach(() => {
    sessionStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    sessionStorageMock.clear();
  });

  it('getToken retorna null cuando no hay token', async () => {
    const { getToken } = await getModule();
    expect(getToken()).toBeNull();
  });

  it('setTokenJwt almacena token en sessionStorage', async () => {
    const { setTokenJwt, getToken } = await getModule();
    setTokenJwt('my-jwt-token');
    expect(getToken()).toBe('my-jwt-token');
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('tiza-auth-token-jwt', 'my-jwt-token');
  });

  it('setTokenJwt(null) remueve token de sessionStorage', async () => {
    const { setTokenJwt, getToken } = await getModule();
    setTokenJwt('my-jwt-token');
    expect(getToken()).toBe('my-jwt-token');
    setTokenJwt(null);
    expect(getToken()).toBeNull();
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('tiza-auth-token-jwt');
  });

  it('getToken retorna null en SSR (window undefined)', async () => {
    // Temporarily remove window to simulate SSR
    const origWindow = globalThis.window;
    (globalThis as any).window = undefined;
    const { getToken } = await getModule();
    expect(getToken()).toBeNull();
    (globalThis as any).window = origWindow;
  });
});

describe('fetchTokenFromSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna accessToken cuando la session responde OK', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ accessToken: 'session-token' }), { status: 200 })
    );
    const { fetchTokenFromSession } = await getModule();
    const result = await fetchTokenFromSession();
    expect(result).toBe('session-token');
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/session');
  });

  it('retorna null cuando la session falla (status no OK)', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
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

  it('retorna null cuando response no tiene accessToken', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    const { fetchTokenFromSession } = await getModule();
    const result = await fetchTokenFromSession();
    expect(result).toBeNull();
  });
});

describe('setTokenCookie / clearTokenCookie', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('setTokenCookie hace POST a /api/auth/set-token con el token', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
    const { setTokenCookie } = await getModule();
    await setTokenCookie('my-jwt-token');
    expect(mockFetch).toHaveBeenCalledWith('/api/auth/set-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'my-jwt-token' }),
    });
  });

  it('clearTokenCookie hace POST a /api/auth/set-token con token vacío', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
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
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test User',
    role: 'teacher',
    status: 'active',
    tenantId: 'tenant-1',
  };

  it('getStoredUser retorna null cuando no hay usuario', async () => {
    const { getStoredUser } = await getModule();
    expect(getStoredUser()).toBeNull();
  });

  it('storeUser guarda usuario en localStorage', async () => {
    const { storeUser, getStoredUser } = await getModule();
    storeUser(mockUser);
    expect(getStoredUser()).toEqual(mockUser);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'tiza-auth-user',
      JSON.stringify(mockUser)
    );
  });

  it('clearStoredUser remueve usuario de localStorage', async () => {
    const { storeUser, clearStoredUser, getStoredUser } = await getModule();
    storeUser(mockUser);
    expect(getStoredUser()).toEqual(mockUser);
    clearStoredUser();
    expect(getStoredUser()).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('tiza-auth-user');
  });

  it('getStoredUser retorna null cuando JSON es inválido', async () => {
    localStorageMock.getItem = vi.fn(() => 'not-valid-json');
    const { getStoredUser } = await getModule();
    expect(getStoredUser()).toBeNull();
  });

  it('getStoredUser retorna null en SSR', async () => {
    const origWindow = globalThis.window;
    (globalThis as any).window = undefined;
    const { getStoredUser } = await getModule();
    expect(getStoredUser()).toBeNull();
    (globalThis as any).window = origWindow;
  });
});

describe('loginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  it('loguea exitosamente y retorna user + token', async () => {
    // POST /api/auth/login response
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'jwt-token', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    // GET /api/auth/me response
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'user-1',
          email: 'teacher@test.com',
          name: 'Profesor Test',
          role: 'teacher',
          status: 'active',
          tenant_id: 'tenant-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    // POST /api/auth/set-token response
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { loginUser } = await getModule();
    const result = await loginUser('teacher@test.com', 'password123', 'tiza');

    expect(result.user).toEqual({
      id: 'user-1',
      email: 'teacher@test.com',
      name: 'Profesor Test',
      role: 'teacher',
      status: 'active',
      rejectionReason: undefined,
      tenantId: 'tenant-1',
    });
    expect(result.token).toBe('jwt-token');

    // Verify token was stored
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('tiza-auth-token-jwt', 'jwt-token');
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('login usa brand default "tiza" cuando no se especifica', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'jwt-token', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'user-1',
          email: 'teacher@test.com',
          name: 'Test',
          role: 'teacher',
          status: 'active',
          tenant_id: 'tenant-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { loginUser } = await getModule();
    const result = await loginUser('teacher@test.com', 'password123');

    expect(result.token).toBe('jwt-token');
    expect(result.user.email).toBe('teacher@test.com');
  });

  it('incluye rejectionReason cuando está presente', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'jwt-token', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'user-2',
          email: 'rejected@test.com',
          name: 'Rejected User',
          role: 'teacher',
          status: 'rejected',
          rejection_reason: 'Documentación incompleta',
          tenant_id: 'tenant-2',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { loginUser } = await getModule();
    const result = await loginUser('rejected@test.com', 'password123', 'tiza');

    expect(result.user.status).toBe('rejected');
    expect(result.user.rejectionReason).toBe('Documentación incompleta');
  });
});

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra usuario exitosamente', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'new-user' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { registerUser } = await getModule();
    await registerUser({
      name: 'New Teacher',
      email: 'new@test.com',
      password: 'password123',
      role: 'teacher',
      school: 'school-1',
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:8000/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          name: 'New Teacher',
          email: 'new@test.com',
          password: 'password123',
          role: 'teacher',
          school: 'school-1',
        }),
      })
    );
  });
});

describe('clearAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  it('limpia token cookie, localStorage y sessionStorage', async () => {
    // Pre-populate storage
    localStorageMock.setItem('tiza-auth-user', JSON.stringify({ id: 'u1' }));
    sessionStorageMock.setItem('tiza-auth-token-jwt', 'some-token');

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { clearAuth } = await getModule();
    await clearAuth();

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/set-token', expect.any(Object));
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('tiza-auth-user');
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('tiza-auth-token-jwt');
  });

  it('limpia storage incluso si clearTokenCookie falla', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { clearAuth } = await getModule();
    await clearAuth();

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('tiza-auth-user');
    expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('tiza-auth-token-jwt');
  });
});

describe('changePasswordUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  it('cambia password exitosamente y retorna user + token', async () => {
    // POST /api/auth/change-password response
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'new-jwt-token', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    // GET /api/auth/me response
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'user-1',
          email: 'teacher@test.com',
          name: 'Profesor Test',
          role: 'teacher',
          status: 'active',
          must_change_password: false,
          tenant_id: 'tenant-1',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    // POST /api/auth/set-token response
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { changePasswordUser } = await getModule();
    const result = await changePasswordUser('old-pass', 'new-pass', 'current-token');

    expect(result.user).toEqual({
      id: 'user-1',
      email: 'teacher@test.com',
      name: 'Profesor Test',
      role: 'teacher',
      status: 'active',
      rejectionReason: undefined,
      mustChangePassword: false,
      tenantId: 'tenant-1',
    });
    expect(result.token).toBe('new-jwt-token');

    // Verify the change-password request was correct (via apiFetch)
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:8000/api/auth/change-password',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ current_password: 'old-pass', new_password: 'new-pass' }),
        headers: expect.objectContaining({
          Authorization: 'Bearer current-token',
          'Content-Type': 'application/json',
          'X-Tenant-Brand': 'tiza',
        }),
      })
    );

    // Verify token was stored
    expect(sessionStorageMock.setItem).toHaveBeenCalledWith('tiza-auth-token-jwt', 'new-jwt-token');
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('incluye mustChangePassword true cuando el backend lo indica', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ access_token: 'new-jwt-token', token_type: 'bearer' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'user-2',
          email: 'mustchange@test.com',
          name: 'Must Change',
          role: 'teacher',
          status: 'active',
          must_change_password: true,
          tenant_id: 'tenant-2',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    );
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    const { changePasswordUser } = await getModule();
    const result = await changePasswordUser('old-pass', 'new-pass', 'current-token');

    expect(result.user.mustChangePassword).toBe(true);
    expect(result.user.id).toBe('user-2');
  });

  it('lanza error cuando la API de change-password falla', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Contraseña actual incorrecta' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { changePasswordUser } = await getModule();

    // apiFetch wraps the error in an ApiError object (not an Error instance)
    await expect(changePasswordUser('wrong-pass', 'new-pass', 'token')).rejects.toMatchObject({
      status: 400,
      detail: 'Contraseña actual incorrecta',
    });

    // /api/auth/me should NOT have been called
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('lanza error cuando hay un problema de red', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { changePasswordUser } = await getModule();

    // apiFetch wraps network errors in an ApiError object
    await expect(changePasswordUser('old-pass', 'new-pass', 'token')).rejects.toMatchObject({
      status: 0,
      detail: 'Network error',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
