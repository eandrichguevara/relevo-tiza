const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const DEFAULT_TIMEOUT = 15_000; // 15 seconds

// ─── Error codes translated to Spanish ─────────────────
const ERROR_TRANSLATIONS: Record<number, string> = {
  400: 'Solicitud inválida. Verifica los datos ingresados.',
  401: 'No autorizado. Credenciales incorrectas o sesión expirada.',
  403: 'Acceso denegado. No tienes permisos para esta acción.',
  404: 'Recurso no encontrado.',
  409: 'El registro ya existe. Intenta con otro email.',
  422: 'Datos inválidos. Verifica los campos obligatorios.',
  429: 'Demasiadas solicitudes. Intenta de nuevo en unos segundos.',
  500: 'Error interno del servidor. Intenta de nuevo más tarde.',
  502: 'Servicio temporalmente no disponible.',
  503: 'Servicio en mantenimiento. Intenta de nuevo más tarde.',
};

/**
 * Translate specific backend error detail strings to Spanish.
 * These are checked before falling back to the raw detail string.
 */
const DETAIL_TRANSLATIONS: Record<string, string> = {
  'Invalid authentication credentials': 'Credenciales incorrectas o sesión expirada.',
};

export interface ApiError {
  status: number;
  detail: string;
  translatedMessage: string;
}

/**
 * Translate common Pydantic/FastAPI validation error messages to Spanish.
 */
const VALIDATION_TRANSLATIONS: Record<string, string> = {
  'Field required': 'Este campo es obligatorio.',
  'value is not a valid email address': 'El formato del email no es válido.',
  'value is not a valid integer': 'El valor debe ser un número entero.',
  'ensure this value has at least {min_length} characters':
    'Debe tener al menos {min_length} caracteres.',
  'ensure this value has at most {max_length} characters':
    'Debe tener como máximo {max_length} caracteres.',
  'string does not match regex': 'El formato no es válido.',
  'value is not a valid uuid': 'El identificador no es válido.',
  'Invalid date format': 'El formato de fecha no es válido.',
};

const FIELD_LABELS: Record<string, string> = {
  email: 'Email',
  name: 'Nombre',
  password: 'Contraseña',
  role: 'Rol',
  tenant_id: 'Colegio',
  tenantId: 'Colegio',
  join_code: 'Código de colegio',
};

/**
 * Returns a human-readable error message from an API error detail.
 * Handles FastAPI validation errors where `detail` is an array of { msg, loc, ... } objects.
 */
export function getTranslatedError(status: number, detail?: unknown): string {
  if (!detail)
    return ERROR_TRANSLATIONS[status] || `Error inesperado (${status}). Intenta de nuevo.`;

  // FastAPI validation errors: detail is an array of { msg, loc, type, ... }
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    if (first && typeof first === 'object' && 'msg' in first) {
      const msg = String(first.msg || '');
      const translated = VALIDATION_TRANSLATIONS[msg] || msg;

      // Add field context if available
      const loc = (first as any).loc as string[] | undefined;
      if (loc && loc.length > 0) {
        const field = loc[loc.length - 1];
        const label = FIELD_LABELS[field];
        if (label) {
          return `${label}: ${translated}`;
        }
      }
      return translated;
    }
    return typeof first === 'string'
      ? first
      : ERROR_TRANSLATIONS[status] || `Error inesperado (${status}). Intenta de nuevo.`;
  }

  // Plain string detail — check against DETAIL_TRANSLATIONS first
  if (typeof detail === 'string') return DETAIL_TRANSLATIONS[detail] || detail;

  // Fallback
  return ERROR_TRANSLATIONS[status] || `Error inesperado (${status}). Intenta de nuevo.`;
}

interface FetchOptions extends RequestInit {
  token?: string | null;
  timeout?: number; // milliseconds
}

export async function apiFetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;

  // AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Brand': 'relevo',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let detail: string | undefined;
      try {
        const errorBody = await res.json();
        detail = errorBody.detail || errorBody.message;
      } catch {
        // ignore parse errors
      }

      const translated = getTranslatedError(res.status, detail);
      const apiError: ApiError = {
        status: res.status,
        detail: translated,
        translatedMessage: translated,
      };
      throw apiError;
    }

    // Handle binary responses
    const contentType = res.headers.get('content-type');
    if (contentType?.includes('application/pdf')) {
      return res.blob() as any;
    }

    // Handle 204 No Content — empty response
    if (res.status === 204) {
      return undefined as T;
    }

    // Handle any response with empty body (201 Created, etc.)
    const text = await res.text();
    if (!text) return undefined as T;

    return JSON.parse(text);
  } catch (err: any) {
    clearTimeout(timeoutId);

    // Already an ApiError — re-throw
    if (err?.status && err?.translatedMessage) {
      throw err;
    }

    // Timeout
    if (err?.name === 'AbortError') {
      const apiError: ApiError = {
        status: 0,
        detail: 'La solicitud tardó demasiado. Intenta de nuevo.',
        translatedMessage: 'La solicitud tardó demasiado. Intenta de nuevo.',
      };
      throw apiError;
    }

    // Network error
    console.error('[apiFetch] Network error:', err);
    const apiError: ApiError = {
      status: 0,
      detail: err?.message || 'Error de conexión. Verifica tu internet.',
      translatedMessage: 'Error de conexión. Verifica tu internet.',
    };
    throw apiError;
  }
}

export async function apiUpload<T = any>(
  endpoint: string,
  formData: FormData,
  token?: string | null,
  timeout: number = DEFAULT_TIMEOUT
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const headers: Record<string, string> = {
    'X-Tenant-Brand': 'relevo',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      let detail: string | undefined;
      try {
        const errorBody = await res.json();
        detail = errorBody.detail || errorBody.message;
      } catch {
        // ignore
      }

      const translated = getTranslatedError(res.status, detail);
      const apiError: ApiError = {
        status: res.status,
        detail: translated,
        translatedMessage: translated,
      };
      throw apiError;
    }

    return res.json();
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err?.status && err?.translatedMessage) throw err;

    if (err?.name === 'AbortError') {
      throw {
        status: 0,
        detail: 'La subida tardó demasiado. Intenta de nuevo.',
        translatedMessage: 'La subida tardó demasiado. Intenta de nuevo.',
      } as ApiError;
    }

    console.error('[apiUpload] Network error:', err);
    throw {
      status: 0,
      detail: err?.message || 'Error de conexión.',
      translatedMessage: 'Error de conexión.',
    } as ApiError;
  }
}
