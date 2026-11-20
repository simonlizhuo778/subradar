const TOKEN_KEY = 'subradar_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
}

/** 统一 fetch 封装:自动带 JWT、统一错误结构 { code, message, details } */
export async function api<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = (await res.json().catch(() => null)) as
    | { code?: number; message?: string; details?: string[] }
    | null;

  if (!res.ok) {
    throw new ApiError(data?.message ?? `请求失败(HTTP ${res.status})`, res.status, data?.code);
  }
  return data as T;
}
