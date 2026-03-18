const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000/api';
const ACCESS_TOKEN_KEY = 'resumeai-access-token';
const REFRESH_TOKEN_KEY = 'resumeai-refresh-token';

const buildUrl = (path: string) => `${API_BASE_URL}${path}`;

export const getAccessToken = () => window.localStorage.getItem(ACCESS_TOKEN_KEY);

export const getAuthHeaders = () => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const clearAuthTokens = () => {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
};

let refreshInFlight: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;

  const response = await fetch(buildUrl('/auth/refresh/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  });

  if (!response.ok) {
    clearAuthTokens();
    return null;
  }

  const data = (await response.json()) as { access?: string };
  if (!data.access) {
    clearAuthTokens();
    return null;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
  return data.access;
};

const getOrRefreshAccessToken = async () => {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = refreshAccessToken().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
};

export const fetchWithAuth = async (path: string, init: RequestInit = {}) => {
  const firstHeaders = new Headers(init.headers ?? {});
  const token = getAccessToken();
  if (token) {
    firstHeaders.set('Authorization', `Bearer ${token}`);
  }

  const firstResponse = await fetch(buildUrl(path), {
    ...init,
    headers: firstHeaders,
  });

  if (firstResponse.status !== 401) return firstResponse;

  const newAccessToken = await getOrRefreshAccessToken();
  if (!newAccessToken) return firstResponse;

  const retryHeaders = new Headers(init.headers ?? {});
  retryHeaders.set('Authorization', `Bearer ${newAccessToken}`);

  return fetch(buildUrl(path), {
    ...init,
    headers: retryHeaders,
  });
};

export const getErrorMessage = (data: unknown, fallback = 'Request failed') => {
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (!data || typeof data !== 'object') return fallback;
  const maybeObj = data as Record<string, unknown>;

  if (typeof maybeObj.detail === 'string') return maybeObj.detail;
  if (typeof maybeObj.error === 'string') return maybeObj.error;

  for (const value of Object.values(maybeObj)) {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
      return value[0];
    }
    if (typeof value === 'string') {
      return value;
    }
  }

  return fallback;
};

export const parseResponseBody = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

export { buildUrl };

/** Poll task status until SUCCESS or FAILURE. Resolves with result or rejects with error. */
export async function pollTaskUntilComplete<T = unknown>(
  taskId: string,
  options?: { intervalMs?: number; maxAttempts?: number }
): Promise<T> {
  const intervalMs = options?.intervalMs ?? 2000;
  const maxAttempts = options?.maxAttempts ?? 180; // 6 min at 2s

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetchWithAuth(`/tasks/${taskId}/`);
    const data = (await parseResponseBody(res)) as { status: string; result?: T; error?: string };
    if (!res.ok) {
      throw new Error(getErrorMessage(data, 'Failed to fetch task status'));
    }
    if (data.status === 'SUCCESS' && data.result !== undefined) {
      return data.result as T;
    }
    if (data.status === 'FAILURE') {
      throw new Error(data.error ?? 'Task failed');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Task timed out');
}
