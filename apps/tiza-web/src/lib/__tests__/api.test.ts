import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch before importing apiFetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// AbortController is available in jsdom/Node 24

async function getApiFetch() {
  const mod = await import('@/lib/api');
  return mod.apiFetch;
}

describe('apiFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna datos parseados en request exitosa', async () => {
    const mockData = { id: '123', name: 'Test' };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const apiFetch = await getApiFetch();
    const result = await apiFetch('/api/test');
    expect(result).toEqual(mockData);
  });

  it('incluye X-Tenant-Brand: "tiza" en los headers de la request', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const apiFetch = await getApiFetch();
    await apiFetch('/api/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Tenant-Brand': 'tiza',
        }),
      })
    );
  });

  it('lanza ApiError con detail del servidor en error 401', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const apiFetch = await getApiFetch();
    await expect(apiFetch('/api/test')).rejects.toMatchObject({
      status: 401,
      detail: 'Invalid credentials',
    });
  });

  it('lanza ApiError con mensaje traducido en error 500', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const apiFetch = await getApiFetch();
    await expect(apiFetch('/api/test')).rejects.toMatchObject({
      status: 500,
      detail: 'Internal server error',
    });
  });

  it('lanza ApiError con translatedMessage para HTTP 404 cuando no hay detail', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Not Found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    const apiFetch = await getApiFetch();
    await expect(apiFetch('/api/test')).rejects.toMatchObject({
      status: 404,
      translatedMessage: expect.stringContaining('encontrado'),
    });
  });

  it('incluye token de autorización cuando se proporciona', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const apiFetch = await getApiFetch();
    await apiFetch('/api/protected', { token: 'my-jwt-token' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer my-jwt-token',
        }),
      })
    );
  });

  it('contiene translatedMessage en el error', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Bad request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const apiFetch = await getApiFetch();
    await expect(apiFetch('/api/test')).rejects.toMatchObject({
      status: 400,
      translatedMessage: expect.any(String),
    });
  });
});
