"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";

const SITE = process.env.NEXT_PUBLIC_SITE_NAME || "RapidSale";

export default function Header() {
  const { user, unread, logout, can } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`/search${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" className="shrink-0 text-2xl font-extrabold tracking-tight text-brand-700">
          {SITE}
        </Link>

        <form onSubmit={search} className="mx-2 hidden flex-1 md:flex">
          <input
            className="input rounded-r-none"
            placeholder="Find cars, mobile phones, houses and more..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="rounded-r-lg bg-brand-600 px-4 text-white hover:bg-brand-700" aria-label="Search">
            🔍
          </button>
        </form>

        <nav className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <Link href="/chat" className="relative rounded-lg p-2 hover:bg-gray-100" title="Chats">
                💬
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <Link href="/favorites" className="hidden rounded-lg p-2 hover:bg-gray-100 sm:block" title="Favourites">
                ❤️
              </Link>
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenu((m) => !m)}
                  className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-gray-100"
                >
                  <Avatar name={user.name} url={user.avatar_url} />
                  <span className="hidden text-sm font-medium sm:inline">{user.name.split(" ")[0]}</span>
                </button>
                {menu && (
                  <div className="absolute right-0 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                    <MenuLink href="/my-ads" onClick={() => setMenu(false)}>My Ads</MenuLink>
                    <MenuLink href="/favorites" onClick={() => setMenu(false)}>Favourites</MenuLink>
                    <MenuLink href="/chat" onClick={() => setMenu(false)}>Chats</MenuLink>
                    <MenuLink href="/profile" onClick={() => setMenu(false)}>Profile & Settings</MenuLink>
                    {can("admin.access") && (
                      <MenuLink href="/admin" onClick={() => setMenu(false)}>Admin Panel</MenuLink>
                    )}
                    <button
                      className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-50"
                      onClick={async () => {
                        setMenu(false);
                        await logout();
                        router.push("/");
                      }}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/login" className="px-2 text-sm font-semibold underline-offset-4 hover:underline">
              Login
            </Link>
          )}
          <Link
            href="/post"
            className="btn rounded-full border-4 border-accent-400 bg-white px-5 font-bold text-gray-900 hover:bg-accent-400"
          >
            + SELL
          </Link>
        </nav>
      </div>
      <form onSubmit={search} className="flex px-4 pb-3 md:hidden">
        <input className="input rounded-r-none" placeholder="Search..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="rounded-r-lg bg-brand-600 px-4 text-white">🔍</button>
      </form>
    </header>
  );
}

function MenuLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="block px-4 py-2 text-sm hover:bg-gray-50">
      {children}
    </Link>
  );
}

export function Avatar({ name, url, size = 32 }: { name: string; url?: string; size?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} width={size} height={size} className="rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-brand-600 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
