"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { STATUS_STYLES } from "@/lib/format";
import { useAuth } from "./AuthProvider";

export function Spinner({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-10 text-gray-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
      {label}
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  }[kind];
  return <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_STYLES[status] || "bg-gray-100 text-gray-700"}`}>{status}</span>;
}

export function Pagination({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const nums: number[] = [];
  for (let p = Math.max(1, page - 2); p <= Math.min(pages, page + 2); p++) nums.push(p);
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-1">
      <button className="btn-outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ‹ Prev
      </button>
      {nums.map((p) => (
        <button key={p} onClick={() => onPage(p)} className={p === page ? "btn-primary" : "btn-outline"}>
          {p}
        </button>
      ))}
      <button className="btn-outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next ›
      </button>
    </div>
  );
}

/** Renders children only for logged-in users (optionally with a permission); redirects otherwise. */
export function RequireAuth({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { user, loading, can } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }, [loading, user, router]);
  if (loading || !user) return <Spinner />;
  if (permission && !can(permission)) {
    return (
      <div className="card p-10 text-center">
        <p className="text-lg font-semibold">Access denied</p>
        <p className="mt-1 text-gray-500">You do not have permission to view this page.</p>
        <Link href="/" className="btn-primary mt-4">
          Go home
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-700" aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
