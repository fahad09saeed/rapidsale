"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, getValidAccessToken, tokenStore, wsUrl } from "@/lib/api";
import type { AuthResponse, Me } from "@/lib/types";

export interface SocketEvent {
  type: "message" | "read" | "typing";
  data: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}
type Listener = (ev: SocketEvent) => void;

interface AuthState {
  user: Me | null;
  loading: boolean;
  unread: number;
  setSession: (r: AuthResponse) => void;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
  refreshUnread: () => void;
  can: (perm: string) => boolean;
  subscribe: (fn: Listener) => () => void;
  sendSocket: (payload: unknown) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const listeners = useRef(new Set<Listener>());
  const socket = useRef<WebSocket | null>(null);

  const reloadUser = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      setUser(await api<Me>("/auth/me"));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUnread = useCallback(() => {
    if (!tokenStore.get()) return;
    api<{ unread: number }>("/conversations/unread-count")
      .then((r) => setUnread(r.unread))
      .catch(() => {});
  }, []);

  useEffect(() => {
    reloadUser();
    const onLogout = () => setUser(null);
    window.addEventListener("rs-logout", onLogout);
    return () => window.removeEventListener("rs-logout", onLogout);
  }, [reloadUser]);

  // Realtime socket with reconnect while logged in.
  useEffect(() => {
    if (!user) return;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;

    const connect = async () => {
      const token = await getValidAccessToken();
      if (!token || closed) return;
      const ws = new WebSocket(wsUrl(token));
      socket.current = ws;
      ws.onopen = () => (retry = 0);
      ws.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as SocketEvent;
          if (ev.type === "message") refreshUnread();
          listeners.current.forEach((fn) => fn(ev));
        } catch {}
      };
      ws.onclose = () => {
        socket.current = null;
        if (closed) return;
        retry = Math.min(retry + 1, 6);
        timer = setTimeout(connect, 1000 * 2 ** retry);
      };
    };
    connect();
    refreshUnread();
    return () => {
      closed = true;
      clearTimeout(timer);
      socket.current?.close();
    };
  }, [user, refreshUnread]);

  const setSession = useCallback((r: AuthResponse) => {
    tokenStore.set(r);
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    const t = tokenStore.get();
    if (t) await api("/auth/logout", { method: "POST", body: { refresh_token: t.refresh_token } }).catch(() => {});
    tokenStore.clear();
    setUser(null);
    setUnread(0);
  }, []);

  const can = useCallback((perm: string) => !!user?.permissions?.includes(perm), [user]);

  const subscribe = useCallback((fn: Listener) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const sendSocket = useCallback((payload: unknown) => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(payload));
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, unread, setSession, logout, reloadUser, refreshUnread, can, subscribe, sendSocket }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
