// frontend/src/lib/api.ts
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let refreshAccessToken: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setAuthHandlers(handlers: {
  refreshAccessToken: () => Promise<string | null>;
  onUnauthorized: () => void;
}): void {
  refreshAccessToken = handlers.refreshAccessToken;
  onUnauthorized = handlers.onUnauthorized;
}

async function request<T>(
  path: string,
  init: RequestInit,
  isRetry = false,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (response.status === 401 && !isRetry && refreshAccessToken) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      setAccessToken(newToken);
      return request<T>(path, init, true);
    }
    onUnauthorized?.();
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      (body as { message?: string } | null)?.message ??
      `${init.method ?? 'GET'} ${path} failed with status ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
