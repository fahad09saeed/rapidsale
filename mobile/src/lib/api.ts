import * as SecureStore from "expo-secure-store";
import type { AuthResponse } from "./types";

// Android emulator reaches the host machine at 10.0.2.2; use your LAN IP for a real device,
// and https://your-domain/api in production builds.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:8080/api").replace(/\/$/, "");

const KEY = "rs_session";

export class ApiError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown>) {
    super(message);
  }
  get code() {
    return this.data.code as string | undefined;
  }
}

type Tokens = { access_token: string; refresh_token: string };
let cached: Tokens | null | undefined;
let onLogout: (() => void) | null = null;

export const tokenStore = {
  async get(): Promise<Tokens | null> {
    if (cached !== undefined) return cached;
    const raw = await SecureStore.getItemAsync(KEY);
    cached = raw ? (JSON.parse(raw) as Tokens) : null;
    return cached;
  },
  async set(t: Tokens) {
    cached = { access_token: t.access_token, refresh_token: t.refresh_token };
    await SecureStore.setItemAsync(KEY, JSON.stringify(cached));
  },
  async clear() {
    cached = null;
    await SecureStore.deleteItemAsync(KEY);
    onLogout?.();
  },
  onLogout(fn: () => void) {
    onLogout = fn;
  },
};

function expiry(token: string): number {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(globalThis.atob(b64)).exp * 1000;
  } catch {
    return 0;
  }
}

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const t = await tokenStore.get();
  if (!t) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: t.refresh_token }),
      });
      if (!res.ok) {
        await tokenStore.clear();
        return false;
      }
      await tokenStore.set((await res.json()) as AuthResponse);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function getValidAccessToken(): Promise<string | null> {
  const t = await tokenStore.get();
  if (!t) return null;
  if (expiry(t.access_token) - Date.now() > 30_000) return t.access_token;
  return (await refresh()) ? (await tokenStore.get())?.access_token ?? null : null;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const send = async () => {
    const headers: Record<string, string> = { Accept: "application/json" };
    const token = await getValidAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    return fetch(`${API_URL}${path}`, { method: opts.method ?? "GET", headers, body });
  };
  let res = await send();
  if (res.status === 401 && (await tokenStore.get())) {
    if (await refresh()) res = await send();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data);
  return data as T;
}

export async function uploadImage(uri: string, mimeType = "image/jpeg", folder = "listings"): Promise<string> {
  const form = new FormData();
  const name = uri.split("/").pop() || "photo.jpg";
  // React Native's FormData accepts { uri, name, type } file descriptors.
  form.append("file", { uri, name, type: mimeType } as unknown as Blob);
  const r = await api<{ url: string }>(`/uploads?folder=${folder}`, { method: "POST", form });
  return r.url;
}

export function errorMessage(e: unknown) {
  return e instanceof Error ? e.message : "Something went wrong";
}

export function wsUrl(token: string) {
  return `${API_URL.replace(/^http/, "ws")}/ws?token=${encodeURIComponent(token)}`;
}
