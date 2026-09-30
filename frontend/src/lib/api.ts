// Thin fetch wrapper for the REST API. Adds the JWT, parses the consistent
// error shape `{ error: { code, message, details } }` into ApiError.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"
const TOKEN_KEY = "wms_token"

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message)
  }
}

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

type Query = Record<string, string | number | boolean | null | undefined>

export function toQueryString(query?: Query) {
  if (!query) return ""
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") params.set(k, String(v))
  }
  const s = params.toString()
  return s ? `?${s}` : ""
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(`${API_URL}${path}${toQueryString(query)}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && token) {
      tokenStore.clear()
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = "/login"
      }
    }
    const err = data?.error
    throw new ApiError(res.status, err?.message ?? `Request failed (${res.status})`, err?.code, err?.details)
  }
  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong"
}
