"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/Header";
import { RequireAuth, Spinner } from "@/components/ui";
import { api, errorMessage, uploadImage } from "@/lib/api";
import { formatPrice, PLACEHOLDER_IMG, timeAgo } from "@/lib/format";
import type { Conversation, Message } from "@/lib/types";

function Inbox() {
  const { subscribe, refreshUnread } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const activeId = Number(params.get("c")) || null;
  const [filter, setFilter] = useState<"" | "buying" | "selling">("");
  const [convs, setConvs] = useState<Conversation[] | null>(null);

  const load = useCallback(() => {
    api<Conversation[]>(`/conversations${filter ? `?role=${filter}` : ""}`).then(setConvs).catch(() => setConvs([]));
  }, [filter]);
  useEffect(load, [load]);
  useEffect(() => subscribe((ev) => ev.type === "message" && load()), [subscribe, load]);

  return (
    <div className="card grid h-[calc(100vh-11rem)] min-h-[500px] overflow-hidden md:grid-cols-[340px_1fr]">
      <aside className={`flex flex-col border-r ${activeId ? "hidden md:flex" : "flex"}`}>
        <div className="border-b p-3">
          <h1 className="mb-2 text-lg font-bold">Inbox</h1>
          <div className="flex gap-1 text-sm">
            {(["", "buying", "selling"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 capitalize ${filter === f ? "bg-brand-600 text-white" : "bg-gray-100"}`}>
                {f || "All"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {!convs ? (
            <Spinner />
          ) : convs.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500">No conversations yet.</p>
          ) : (
            convs.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/chat?c=${c.id}`)}
                className={`flex w-full gap-3 border-b p-3 text-left hover:bg-gray-50 ${c.id === activeId ? "bg-brand-50" : ""}`}
              >
                <img src={c.listing?.image || PLACEHOLDER_IMG} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{c.other_user.name}</p>
                    <span className="shrink-0 text-xs text-gray-400">{timeAgo(c.last_message_at)}</span>
                  </div>
                  <p className="truncate text-xs text-gray-500">{c.listing?.title}</p>
                  <div className="flex justify-between gap-2">
                    <p className={`truncate text-sm ${c.unread ? "font-semibold text-gray-900" : "text-gray-600"}`}>{c.last_message}</p>
                    {c.unread > 0 && <span className="rounded-full bg-brand-600 px-2 text-xs text-white">{c.unread}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
      <section className={`${activeId ? "flex" : "hidden md:flex"} min-h-0 flex-col`}>
        {activeId ? (
          <Thread key={activeId} id={activeId} onRead={() => { load(); refreshUnread(); }} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-gray-400">Select a chat to start messaging</div>
        )}
      </section>
    </div>
  );
}

function Thread({ id, onRead }: { id: number; onRead: () => void }) {
  const { user, subscribe, sendSocket } = useAuth();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const lastTypingSent = useRef(0);

  const markRead = useCallback(() => {
    api(`/conversations/${id}/read`, { method: "POST" }).then(onRead).catch(() => {});
  }, [id, onRead]);

  useEffect(() => {
    api<Conversation>(`/conversations/${id}`).then(setConv).catch((e) => setError(errorMessage(e)));
    api<{ items: Message[]; has_more: boolean }>(`/conversations/${id}/messages`).then((r) => {
      setMessages(r.items);
      setHasMore(r.has_more);
      setTimeout(() => bottom.current?.scrollIntoView(), 0);
    });
    markRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let typingTimer: ReturnType<typeof setTimeout>;
    const off = subscribe((ev) => {
      if (ev.data?.conversation_id !== id) return;
      if (ev.type === "message") {
        const m = ev.data as Message;
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        setTyping(false);
        setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 0);
        if (m.sender_id !== user?.id) markRead();
      } else if (ev.type === "read") {
        setMessages((list) => list.map((m) => (m.sender_id === user?.id && !m.read_at ? { ...m, read_at: ev.data.read_at } : m)));
      } else if (ev.type === "typing") {
        setTyping(true);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => setTyping(false), 3000);
      }
    });
    return () => {
      off();
      clearTimeout(typingTimer);
    };
  }, [id, subscribe, user, markRead]);

  const loadOlder = async () => {
    if (!messages.length) return;
    const r = await api<{ items: Message[]; has_more: boolean }>(`/conversations/${id}/messages?before_id=${messages[0].id}`);
    setMessages((list) => [...r.items, ...list]);
    setHasMore(r.has_more);
  };

  const send = async (body: string, image_url = "") => {
    setError("");
    try {
      const m = await api<Message>(`/conversations/${id}/messages`, { method: "POST", body: { body, image_url } });
      setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
      setTimeout(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), 0);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const onType = (v: string) => {
    setText(v);
    if (Date.now() - lastTypingSent.current > 2000) {
      sendSocket({ type: "typing", conversation_id: id });
      lastTypingSent.current = Date.now();
    }
  };

  if (!conv) return error ? <p className="p-6 text-red-600">{error}</p> : <Spinner />;

  return (
    <>
      <header className="flex items-center gap-3 border-b p-3">
        <Link href="/chat" className="md:hidden">‹</Link>
        <Avatar name={conv.other_user.name} url={conv.other_user.avatar_url} size={40} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{conv.other_user.name}</p>
          <p className="text-xs text-gray-500">{typing ? "typing..." : conv.other_user.online ? "Online" : `Last seen ${timeAgo(conv.other_user.last_seen_at)}`}</p>
        </div>
        {conv.listing && (
          <Link href={`/item/${conv.listing.id}`} className="hidden items-center gap-2 rounded-lg border p-1 pr-3 sm:flex">
            <img src={conv.listing.image || PLACEHOLDER_IMG} alt="" className="h-10 w-10 rounded object-cover" />
            <div className="text-xs">
              <p className="max-w-40 truncate font-medium">{conv.listing.title}</p>
              <p className="font-bold">{formatPrice(conv.listing.price)}</p>
            </div>
          </Link>
        )}
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-4">
        {hasMore && (
          <button onClick={loadOlder} className="mx-auto block text-xs text-brand-700 hover:underline">Load older messages</button>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-white shadow-sm"}`}>
                {m.image_url && <img src={m.image_url} alt="" className="mb-1 max-h-60 rounded-lg" />}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <p className={`mt-1 text-right text-[10px] ${mine ? "text-brand-100" : "text-gray-400"}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {mine && (m.read_at ? " ✓✓" : " ✓")}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {error && <p className="px-4 text-sm text-red-600">{error}</p>}
      <form
        className="flex items-center gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          send(text);
          setText("");
        }}
      >
        <label className="cursor-pointer rounded-lg p-2 hover:bg-gray-100" title="Send photo">
          📷
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                send("", await uploadImage(f, "chat"));
              } catch (err) {
                setError(errorMessage(err));
              }
            }}
          />
        </label>
        <input className="input" placeholder="Type a message" value={text} onChange={(e) => onType(e.target.value)} maxLength={2000} />
        <button className="btn-primary">Send</button>
      </form>
    </>
  );
}

export default function ChatPage() {
  return (
    <RequireAuth>
      <Suspense>
        <Inbox />
      </Suspense>
    </RequireAuth>
  );
}
