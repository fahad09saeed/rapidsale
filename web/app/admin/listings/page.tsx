"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Pagination, Spinner, StatusBadge } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatPrice, PLACEHOLDER_IMG, timeAgo } from "@/lib/format";
import type { Listing, Paged } from "@/lib/types";

export default function AdminListings() {
  const { can } = useAuth();
  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Listing> | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (status) p.set("status", status);
    if (q) p.set("q", q);
    api<Paged<Listing>>(`/admin/listings?${p}`).then(setData).catch((e) => setError(errorMessage(e)));
  }, [page, status, q]);
  useEffect(load, [load]);

  const moderate = async (l: Listing, body: Record<string, unknown>) => {
    setError("");
    try {
      await api(`/admin/listings/${l.id}`, { method: "PATCH", body });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const remove = async (l: Listing) => {
    if (!confirm("Delete this listing?")) return;
    try {
      await api(`/admin/listings/${l.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Listings moderation</h1>
      <div className="flex flex-wrap gap-2">
        {["pending", "active", "rejected", "inactive", "sold", "expired", ""].map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`${status === s ? "btn-primary" : "btn-outline"} capitalize`}>
            {s || "All"}
          </button>
        ))}
        <form className="ml-auto flex gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
          <input className="input" placeholder="Search title" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </div>
      {error && <Alert>{error}</Alert>}
      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <p className="card p-8 text-center text-gray-500">Nothing here.</p>
      ) : (
        <div className="space-y-3">
          {data.items.map((l) => (
            <div key={l.id} className="card flex flex-col gap-4 p-4 md:flex-row">
              <img src={l.images[0]?.url || PLACEHOLDER_IMG} alt="" className="h-24 w-32 shrink-0 rounded object-cover" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={l.status} />
                  {l.is_featured && <span className="badge bg-accent-400">Featured</span>}
                  <span className="text-xs text-gray-400">#{l.id} · {timeAgo(l.created_at)}</span>
                </div>
                <Link href={`/item/${l.id}`} target="_blank" className="block font-semibold hover:underline">{l.title}</Link>
                <p className="text-sm">{formatPrice(l.price)} · {l.category?.name} · {l.location?.name}</p>
                <p className="text-xs text-gray-500">By {l.user?.name} ({l.user?.phone ?? l.user?.email})</p>
                <p className="line-clamp-2 text-sm text-gray-600">{l.description}</p>
              </div>
              <div className="flex flex-wrap gap-2 md:w-40 md:flex-col">
                {l.status !== "active" && <button className="btn-primary" onClick={() => moderate(l, { status: "active" })}>Approve</button>}
                {l.status !== "rejected" && (
                  <button
                    className="btn-outline"
                    onClick={() => {
                      const reason = prompt("Reason for rejection (shown to the seller):");
                      if (reason) moderate(l, { status: "rejected", reject_reason: reason });
                    }}
                  >
                    Reject
                  </button>
                )}
                <button className="btn-outline" onClick={() => moderate(l, { is_featured: !l.is_featured })}>
                  {l.is_featured ? "Unfeature" : "Feature"}
                </button>
                {can("listings.manage") && <button className="btn w-full text-red-600 hover:bg-red-50" onClick={() => remove(l)}>Delete</button>}
              </div>
            </div>
          ))}
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
