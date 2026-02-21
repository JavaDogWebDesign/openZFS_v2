import type { ApiResult } from '@zfs-manager/shared';

const API_BASE = '/api';

/**
 * Read the CSRF token from the cookie set by the server.
 */
function getCsrfToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)csrf-token=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Build standard headers for API requests.
 */
function buildHeaders(hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (hasBody) {
    headers['Content-Type'] = 'application/json';
  }

  const csrf = getCsrfToken();
  if (csrf) {
    headers['X-CSRF-Token'] = csrf;
  } else if (hasBody) {
    console.warn('[api] No CSRF token found in cookies - mutating request may be rejected');
  }

  return headers;
}

/**
 * Centralized fetch wrapper that handles auth redirects and JSON parsing.
 */
async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const url = `${API_BASE}${path}`;
  const hasBody = body !== undefined;
  const start = performance.now();

  console.log(`[api] ${method} ${path}`, hasBody ? body : '');

  try {
    const response = await fetch(url, {
      method,
      headers: buildHeaders(hasBody),
      credentials: 'same-origin',
      body: hasBody ? JSON.stringify(body) : undefined,
    });

    const duration = Math.round(performance.now() - start);

    // Handle 401 by redirecting to login
    if (response.status === 401) {
      console.warn(`[api] ${method} ${path} -> 401 UNAUTHORIZED (${duration}ms) - redirecting to /login`);
      const currentPath = window.location.pathname;
      if (currentPath !== '/login') {
        window.location.href = '/login';
      }
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      };
    }

    const data = await response.json();
    const result = data as ApiResult<T>;

    if (result.success) {
      console.log(`[api] ${method} ${path} -> ${response.status} OK (${duration}ms)`);
    } else {
      console.error(`[api] ${method} ${path} -> ${response.status} FAILED (${duration}ms)`, result.error);
    }

    return result;
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    console.error(`[api] ${method} ${path} -> NETWORK ERROR (${duration}ms)`, err);
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: err instanceof Error ? err.message : 'Network request failed',
      },
    };
  }
}

/**
 * API client with typed HTTP methods.
 */
export const apiClient = {
  get<T>(path: string): Promise<ApiResult<T>> {
    return request<T>('GET', path);
  },

  post<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return request<T>('POST', path, body);
  },

  put<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return request<T>('PUT', path, body);
  },

  patch<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return request<T>('PATCH', path, body);
  },

  delete<T>(path: string, body?: unknown): Promise<ApiResult<T>> {
    return request<T>('DELETE', path, body);
  },
};
