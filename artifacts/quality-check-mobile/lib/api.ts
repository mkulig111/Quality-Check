let _authToken: string | null = null;

export function setApiToken(token: string | null) {
  _authToken = token;
}

export function getApiToken(): string | null {
  return _authToken;
}

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) ?? {}),
  };
  if (_authToken) {
    headers["Authorization"] = `Bearer ${_authToken}`;
  }

  const url = `${getBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => apiFetch<T>(url),
  post: <T>(url: string, body: unknown) =>
    apiFetch<T>(url, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(url: string, body: unknown) =>
    apiFetch<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    apiFetch<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(url: string) => apiFetch<T>(url, { method: "DELETE" }),
};
