import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode, ComponentType } from 'react';

// ─── Mocks must be set up BEFORE importing the module ────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

const mockLoginUser = vi.fn();
const mockRegisterUser = vi.fn();
const mockClearAuth = vi.fn();
const mockFetchTokenFromSession = vi.fn();
const mockGetStoredUser = vi.fn();
const mockStoreUser = vi.fn();
const mockSetTokenJwt = vi.fn();

vi.mock('@/lib/auth', () => ({
  loginUser: mockLoginUser,
  registerUser: mockRegisterUser,
  clearAuth: mockClearAuth,
  fetchTokenFromSession: mockFetchTokenFromSession,
  getStoredUser: mockGetStoredUser,
  storeUser: mockStoreUser,
  setTokenJwt: mockSetTokenJwt,
}));

// ─── Dynamic imports (mocks are hoisted, so these use mocked deps) ───

let AuthProvider: ComponentType<{ children: ReactNode }>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useAuth: () => any;

beforeAll(async () => {
  const mod = await import('../useAuth');
  AuthProvider = mod.AuthProvider;
  useAuth = mod.useAuth;
});

// ─── Test helpers ─────────────────────────────────────────

const mockUserActive = {
  id: 'u1',
  email: 'teacher@test.com',
  name: 'Profesor Test',
  role: 'teacher',
  status: 'active',
  tenantId: 'tenant-1',
};

const mockUserPending = {
  ...mockUserActive,
  status: 'pending',
};

const mockUserRejected = {
  ...mockUserActive,
  status: 'rejected',
  rejectionReason: 'Documentación incompleta',
};

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  // By default, no session exists on mount
  mockFetchTokenFromSession.mockResolvedValue(null);
  mockGetStoredUser.mockReturnValue(null);
});

// ─── Session restoration ─────────────────────────────────

describe('useAuth — Session restoration', () => {
  it('restores session when token and stored user exist', async () => {
    mockFetchTokenFromSession.mockResolvedValue('restored-token');
    mockGetStoredUser.mockReturnValue(mockUserActive);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.token).toBe('restored-token');
    expect(result.current.accessToken).toBe('restored-token');
    expect(result.current.user).toEqual(mockUserActive);
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockSetTokenJwt).toHaveBeenCalledWith('restored-token');
  });

  it('reconstructs user from /api/auth/me when token exists but user is missing', async () => {
    mockFetchTokenFromSession.mockResolvedValue('session-token');
    mockGetStoredUser.mockReturnValue(null);

    // Mock the /api/auth/me fetch
    const meResponse = {
      id: 'u-me',
      email: 'me@test.com',
      name: 'Reconstructed User',
      role: 'teacher',
      status: 'active',
      tenant_id: 'tenant-1',
    };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(meResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.token).toBe('session-token');
    expect(result.current.user).toEqual({
      id: 'u-me',
      email: 'me@test.com',
      name: 'Reconstructed User',
      role: 'teacher',
      status: 'active',
      rejectionReason: undefined,
      tenantId: 'tenant-1',
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockStoreUser).toHaveBeenCalled();
    expect(mockSetTokenJwt).toHaveBeenCalledWith('session-token');
  });

  it('clears auth when /api/auth/me fails with non-OK status', async () => {
    mockFetchTokenFromSession.mockResolvedValue('session-token');
    mockGetStoredUser.mockReturnValue(null);

    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockClearAuth).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('handles fetch error when restoring session', async () => {
    mockFetchTokenFromSession.mockRejectedValue(new Error('Network error'));
    mockGetStoredUser.mockReturnValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('logs error when /api/auth/me fetch throws (network error after session found)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchTokenFromSession.mockResolvedValue('session-token');
    mockGetStoredUser.mockReturnValue(null);
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Should have logged the error and left user/token null
    expect(consoleSpy).toHaveBeenCalledWith(
      '[useAuth] Failed to restore user session:',
      expect.any(Error)
    );
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    consoleSpy.mockRestore();
  });

  it('starts with isLoading=true and transitions to false', async () => {
    // Keep the promise pending to check initial loading state
    mockFetchTokenFromSession.mockReturnValue(new Promise(() => {}));
    mockGetStoredUser.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    // Should be loading while session check is in progress
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ─── Login ────────────────────────────────────────────────

describe('useAuth — Login', () => {
  it('sets user and token on successful login', async () => {
    mockLoginUser.mockResolvedValue({
      token: 'login-token',
      user: mockUserActive,
    });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    // Wait for initial session check to complete
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('teacher@test.com', 'password123');
    });

    expect(mockLoginUser).toHaveBeenCalledWith('teacher@test.com', 'password123', 'tiza');
    expect(result.current.token).toBe('login-token');
    expect(result.current.accessToken).toBe('login-token');
    expect(result.current.user).toEqual(mockUserActive);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('throws error when login fails', async () => {
    const loginError = new Error('Credenciales inválidas');
    mockLoginUser.mockRejectedValue(loginError);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.login('wrong@test.com', 'badpassword');
      })
    ).rejects.toThrow('Credenciales inválidas');

    // State should remain null
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('sets isAuthenticated=false when user status is pending', async () => {
    const pendingUser = { token: 'pending-token', user: mockUserPending };
    mockLoginUser.mockResolvedValue(pendingUser);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('pending@test.com', 'password123');
    });

    expect(result.current.user?.status).toBe('pending');
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ─── Register ─────────────────────────────────────────────

describe('useAuth — Register', () => {
  it('calls registerUser with form data on successful registration', async () => {
    mockRegisterUser.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const registerData = {
      name: 'New Teacher',
      email: 'new@test.com',
      password: 'secure123',
      role: 'teacher',
      school: 'school-1',
    };

    await act(async () => {
      await result.current.register(registerData);
    });

    expect(mockRegisterUser).toHaveBeenCalledWith(registerData);

    // register does NOT set user/token
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('throws when registration fails (email already exists)', async () => {
    const registerError = new Error('Email already registered');
    mockRegisterUser.mockRejectedValue(registerError);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(
      act(async () => {
        await result.current.register({
          name: 'Duplicate',
          email: 'exists@test.com',
          password: 'secure123',
          role: 'teacher',
        });
      })
    ).rejects.toThrow('Email already registered');

    expect(mockRegisterUser).toHaveBeenCalled();
  });

  it('allows registration without school field', async () => {
    mockRegisterUser.mockResolvedValue(undefined);

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.register({
        name: 'Minimal',
        email: 'min@test.com',
        password: 'secure123',
        role: 'teacher',
      });
    });

    expect(mockRegisterUser).toHaveBeenCalledWith({
      name: 'Minimal',
      email: 'min@test.com',
      password: 'secure123',
      role: 'teacher',
    });
  });
});

// ─── Logout ───────────────────────────────────────────────

describe('useAuth — Logout', () => {
  it('clears auth state and redirects to home', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(mockClearAuth).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('clears auth even if already logged in', async () => {
    // First login
    mockLoginUser.mockResolvedValue({ token: 'some-token', user: mockUserActive });

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login('teacher@test.com', 'password');
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Then logout
    await act(async () => {
      await result.current.logout();
    });

    expect(mockClearAuth).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});

// ─── isAuthenticated logic ────────────────────────────────

describe('useAuth — isAuthenticated', () => {
  it('returns true when user status is "active" and token exists', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Login with active user
    mockLoginUser.mockResolvedValue({ token: 't', user: mockUserActive });
    await act(async () => {
      await result.current.login('a@b.com', 'pwd');
    });

    expect(result.current.isAuthenticated).toBe(true);
  });

  it('returns false when user status is "pending"', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockLoginUser.mockResolvedValue({ token: 't', user: mockUserPending });
    await act(async () => {
      await result.current.login('pending@test.com', 'pwd');
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('returns false when user is null (not logged in)', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });
});

// ─── userStatus ───────────────────────────────────────────

describe('useAuth — userStatus', () => {
  it('exposes user.status as userStatus', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.userStatus).toBeNull();

    mockLoginUser.mockResolvedValue({ token: 't', user: mockUserRejected });
    await act(async () => {
      await result.current.login('rejected@test.com', 'pwd');
    });

    expect(result.current.userStatus).toBe('rejected');
  });
});

// ─── useAuth outside provider ─────────────────────────────

describe('useAuth — outside AuthProvider', () => {
  it('throws an error when used outside AuthProvider', () => {
    // Render without the AuthProvider wrapper => should throw
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
  });
});
