import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { api, getValidAccessToken, tokenStore, wsUrl } from "./api";
import type { AuthResponse, Me } from "./types";

export type SocketEvent = { type: "message" | "read" | "typing"; data: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
type Listener = (ev: SocketEvent) => void;

interface AuthState {
  user: Me | null;
  loading: boolean;
  unread: number;
  setSession: (r: AuthResponse) => Promise<void>;
  logout: () => Promise<void>;
  reloadUser: () => Promise<void>;
  refreshUnread: () => void;
  subscribe: (fn: Listener) => () => void;
  sendSocket: (payload: unknown) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);
  const listeners = useRef(new Set<Listener>());
  const socket = useRef<WebSocket | null>(null);

  const reloadUser = useCallback(async () => {
    try {
      setUser((await tokenStore.get()) ? await api<Me>("/auth/me") : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUnread = useCallback(() => {
    api<{ unread: number }>("/conversations/unread-count")
      .then((r) => setUnread(r.unread))
      .catch(() => {});
  }, []);

  useEffect(() => {
    tokenStore.onLogout(() => setUser(null));
    reloadUser();
  }, [reloadUser]);

  // Realtime socket; reconnects with backoff and when the app returns to the foreground.
  useEffect(() => {
    if (!user) return;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout>;
    const connect = async () => {
      if (closed || socket.current) return;
      const token = await getValidAccessToken();
      if (!token || closed) return;
      const ws = new WebSocket(wsUrl(token));
      socket.current = ws;
      ws.onopen = () => (retry = 0);
      ws.onmessage = (e) => {
        try {
          const ev = JSON.parse(String(e.data)) as SocketEvent;
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
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") {
        connect();
        refreshUnread();
      }
    });
    return () => {
      closed = true;
      clearTimeout(timer);
      sub.remove();
      socket.current?.close();
      socket.current = null;
    };
  }, [user, refreshUnread]);

  const setSession = useCallback(async (r: AuthResponse) => {
    await tokenStore.set(r);
    setUser(r.user);
  }, []);

  const logout = useCallback(async () => {
    const t = await tokenStore.get();
    if (t) await api("/auth/logout", { method: "POST", body: { refresh_token: t.refresh_token } }).catch(() => {});
    await tokenStore.clear();
    setUser(null);
    setUnread(0);
  }, []);

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
    <Ctx.Provider value={{ user, loading, unread, setSession, logout, reloadUser, refreshUnread, subscribe, sendSocket }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
