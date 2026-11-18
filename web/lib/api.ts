"use client";

import type { AuthResponse } from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api").replace(/\/$/, "");

const STORAGE_KEY = "rs_session";

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
  get code(): string | undefined {
    return this.data.code as string | undefined;
  }
}

interface Tokens {
  access_token: string;
  refresh_token: string;
}

export const tokenStore = {
  get(): Tokens | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Tokens) : null;
    } catch {
      return null;
    }
  },
  set(t: Tokens) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ access_token: t.access_token, refresh_token: t.refresh_token }));
    } catch {}
  },
  clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    window.dispatchEvent(new Event("rs-logout"));
  },
};

function tokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return (payload.exp as number) * 1000;
  } catch {
    return 0;
  }
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const t = tokenStore.get();
  if (!t?.refresh_token) return false;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: t.refresh_token }),
        });
        if (!res.ok) {
          tokenStore.clear();
          return false;
        }
        const data = (await res.json()) as AuthResponse;
        tokenStore.set(data);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
  }
  return refreshing;
}

/** Returns an access token valid for at least 30 seconds, refreshing if needed. */
export async function getValidAccessToken(): Promise<string | null> {
  const t = tokenStore.get();
  if (!t) return null;
  if (tokenExpiry(t.access_token) - Date.now() > 30_000) return t.access_token;
  if (await refreshTokens()) return tokenStore.get()?.access_token ?? null;
  return null;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const send = async () => {
    const headers: Record<string, string> = {};
    const token = await getValidAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    return fetch(`${API_URL}${path}`, { method: opts.method || "GET", headers, body, signal: opts.signal });
  };

  let res = await send();
  if (res.status === 401 && tokenStore.get()) {
    if (await refreshTokens()) res = await send();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string }).error || `Request failed (${res.status})`, res.status, data);
  }
  return data as T;
}

export async function uploadImage(file: File, folder = "listings"): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await api<{ url: string }>(`/uploads?folder=${folder}`, { method: "POST", form });
  return res.url;
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

export function wsUrl(token: string): string {
  let base = API_URL;
  if (base.startsWith("/")) base = `${window.location.origin}${base}`;
  return `${base.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`;
}
