import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch before importing apiFetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// AbortController is available in jsdom/Node 24

async function getModule() {
  return await import('@/lib/api');
}

async function getApiFetch() {
  const mod = await getModule();
  return mod.apiFetch;
}

async function getApiUpload() {
  const mod = await getModule();
  return mod.apiUpload;
}

async function getTranslatedErrorFn() {
  const mod = await getModule();
  return mod.getTranslatedError;
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

  it('cuando apiFetch recibe 422 con detail array FastAPI, ApiError.detail y translatedMessage son strings', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: [{ msg: 'too short', loc: ['body', 'password'] }],
        }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    );

    const apiFetch = await getApiFetch();
    let error: any;
    try {
      await apiFetch('/api/test');
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(422);
    expect(typeof error.detail).toBe('string');
    expect(typeof error.translatedMessage).toBe('string');
    expect(error.detail).toBe('Contraseña: too short');
  });
});

describe('getTranslatedError', () => {
  it('retorna traducción de status cuando detail es undefined', async () => {
    const fn = await getTranslatedErrorFn();
    expect(fn(404, undefined)).toBe('Recurso no encontrado.');
  });

  it('retorna traducción de status cuando detail es null', async () => {
    const fn = await getTranslatedErrorFn();
    expect(fn(500, null)).toBe('Error interno del servidor. Intenta de nuevo más tarde.');
  });

  it('retorna fallback cuando status no está mapeado y no hay detail', async () => {
    const fn = await getTranslatedErrorFn();
    expect(fn(999)).toBe('Error inesperado (999). Intenta de nuevo.');
  });

  it('retorna el msg del primer objeto en array FastAPI validation error', async () => {
    const fn = await getTranslatedErrorFn();
    const fastApiDetail = [
      {
        loc: ['body', 'password'],
        msg: 'La contraseña debe tener al menos 8 caracteres',
        type: 'value_error',
      },
      { loc: ['body', 'email'], msg: 'Formato de email inválido', type: 'value_error' },
    ];
    expect(fn(422, fastApiDetail)).toBe(
      'Contraseña: La contraseña debe tener al menos 8 caracteres'
    );
  });

  it('retorna string del primer elemento en array de strings', async () => {
    const fn = await getTranslatedErrorFn();
    expect(fn(400, ['first error', 'second error'])).toBe('first error');
  });

  it('retorna traducción de status para array con objetos sin msg', async () => {
    const fn = await getTranslatedErrorFn();
    const detail = [{ code: 'INVALID', description: 'Something wrong' }];
    expect(fn(400, detail)).toBe('Solicitud inválida. Verifica los datos ingresados.');
  });

  it('retorna traducción de status para array vacío', async () => {
    const fn = await getTranslatedErrorFn();
    expect(fn(409, [])).toBe('El registro ya existe. Intenta con otro email.');
  });

  it('retorna el string detail directamente cuando es string', async () => {
    const fn = await getTranslatedErrorFn();
    expect(fn(500, 'Custom server error')).toBe('Custom server error');
  });

  it('retorna traducción de status cuando detail es un número', async () => {
    const fn = await getTranslatedErrorFn();
    expect(fn(503, 42)).toBe('Servicio en mantenimiento. Intenta de nuevo más tarde.');
  });

  it('retorna fallback cuando detail es un objeto plano (no array)', async () => {
    const fn = await getTranslatedErrorFn();
    expect(fn(418, { foo: 'bar' })).toBe('Error inesperado (418). Intenta de nuevo.');
  });

  it('retorna string detail para status desconocido', async () => {
    const fn = await getTranslatedErrorFn();
    expect(fn(999, 'custom')).toBe('custom');
  });
});

describe('apiUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sube archivos exitosamente y retorna JSON', async () => {
    const mockData = { id: 'file-1', url: 'https://example.com/file.pdf' };
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(mockData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const apiUpload = await getApiUpload();
    const formData = new FormData();
    formData.append('file', new Blob(['test']), 'test.pdf');
    const result = await apiUpload('/api/upload', formData);

    expect(result).toEqual(mockData);
  });

  it('incluye X-Tenant-Brand: "tiza" en los headers', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const apiUpload = await getApiUpload();
    const formData = new FormData();
    await apiUpload('/api/upload', formData);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Tenant-Brand': 'tiza',
        }),
      })
    );
  });

  it('lanza ApiError con detail string del servidor en error 400', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Error message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const apiUpload = await getApiUpload();
    const formData = new FormData();
    await expect(apiUpload('/api/upload', formData)).rejects.toMatchObject({
      status: 400,
      detail: 'Error message',
    });
  });

  it('traduce error 422 con detail array FastAPI — translatedMessage es string', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: [{ msg: 'Validation error', loc: ['body', 'file'] }],
        }),
        {
          status: 422,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const apiUpload = await getApiUpload();
    const formData = new FormData();
    let error: any;
    try {
      await apiUpload('/api/upload', formData);
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(error.status).toBe(422);
    expect(typeof error.detail).toBe('string');
    expect(typeof error.translatedMessage).toBe('string');
    expect(error.detail).toBe('Validation error');
  });

  it('lanza ApiError con status 0 en timeout (AbortError)', async () => {
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const apiUpload = await getApiUpload();
    const formData = new FormData();
    await expect(apiUpload('/api/upload', formData)).rejects.toMatchObject({
      status: 0,
      detail: 'La subida tardó demasiado. Intenta de nuevo.',
    });
  });

  it('lanza ApiError con status 0 en error de red (TypeError)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const apiUpload = await getApiUpload();
    const formData = new FormData();
    await expect(apiUpload('/api/upload', formData)).rejects.toMatchObject({
      status: 0,
      detail: 'Failed to fetch',
    });
  });

  it('incluye Authorization header en apiUpload cuando se proporciona token', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const apiUpload = await getApiUpload();
    const formData = new FormData();
    await apiUpload('/api/upload', formData, 'upload-jwt-token');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer upload-jwt-token',
        }),
      })
    );
  });
});

describe('apiFetch — edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('retorna blob para respuesta PDF', async () => {
    const pdfBlob = new Blob(['%PDF-1.4 fake content'], { type: 'application/pdf' });
    mockFetch.mockResolvedValueOnce(
      new Response(pdfBlob, {
        status: 200,
        headers: { 'Content-Type': 'application/pdf' },
      })
    );

    const apiFetch = await getApiFetch();
    const result = await apiFetch('/api/report');

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('application/pdf');
  });

  it('retorna undefined para respuesta 204 No Content', async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const apiFetch = await getApiFetch();
    const result = await apiFetch('/api/delete');

    expect(result).toBeUndefined();
  });

  it('retorna undefined para respuesta 201 con body vacío', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('', { status: 201, headers: { 'Content-Type': 'application/json' } })
    );

    const apiFetch = await getApiFetch();
    const result = await apiFetch('/api/create');

    expect(result).toBeUndefined();
  });

  it('lanza ApiError con status 0 en timeout (AbortError)', async () => {
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    mockFetch.mockRejectedValueOnce(abortError);

    const apiFetch = await getApiFetch();
    await expect(apiFetch('/api/test')).rejects.toMatchObject({
      status: 0,
      detail: 'La solicitud tardó demasiado. Intenta de nuevo.',
    });
  });

  it('lanza ApiError con status 0 en error de red (TypeError)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const apiFetch = await getApiFetch();
    await expect(apiFetch('/api/test')).rejects.toMatchObject({
      status: 0,
      detail: 'Failed to fetch',
    });
  });

  it('maneja error response con body no-JSON (parseo falla)', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    const apiFetch = await getApiFetch();
    await expect(apiFetch('/api/test')).rejects.toMatchObject({
      status: 500,
      detail: expect.stringContaining('servidor'),
    });
  });

  it('usa translatedMessage del error cuando detail está en DETAIL_TRANSLATIONS', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Invalid authentication credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const apiFetch = await getApiFetch();
    await expect(apiFetch('/api/test')).rejects.toMatchObject({
      status: 401,
      translatedMessage: expect.stringContaining('Credenciales incorrectas'),
    });
  });
});
