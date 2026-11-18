"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Alert, Pagination, RequireAuth, Spinner, StatusBadge } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { formatPrice, PLACEHOLDER_IMG, timeAgo } from "@/lib/format";
import type { Listing, Paged } from "@/lib/types";

type Row = Listing & { chats: number; likes: number };
const TABS = ["", "active", "pending", "sold", "inactive", "expired", "rejected"];

function MyAds() {
  const params = useSearchParams();
  const [tab, setTab] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Row> | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setData(null);
    api<Paged<Row>>(`/me/listings?page=${page}${tab ? `&status=${tab}` : ""}`)
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, [page, tab]);
  useEffect(load, [load]);

  const act = async (l: Row, action: "sold" | "inactive" | "active" | "delete") => {
    if (action === "delete" && !confirm("Delete this ad permanently?")) return;
    setError("");
    try {
      if (action === "delete") await api(`/listings/${l.id}`, { method: "DELETE" });
      else await api(`/listings/${l.id}/status`, { method: "PATCH", body: { status: action } });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Ads</h1>
      {params.get("posted") === "pending" && <Alert kind="info">Your ad was submitted and is waiting for review.</Alert>}
      {error && <Alert>{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setPage(1); }} className={`${tab === t ? "btn-primary" : "btn-outline"} capitalize`}>
            {t || "All"}
          </button>
        ))}
      </div>
      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-gray-500">No ads here yet.</p>
          <Link href="/post" className="btn-primary mt-4">Post an ad</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((l) => (
            <div key={l.id} className="card flex flex-col gap-4 p-4 sm:flex-row">
              <Link href={`/item/${l.id}`} className="h-28 w-full shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:w-40">
                <img src={l.images[0]?.url || PLACEHOLDER_IMG} alt="" className="h-full w-full object-cover" />
              </Link>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={l.status} />
                  {l.is_featured && <span className="badge bg-accent-400 text-gray-900">Featured</span>}
                </div>
                <Link href={`/item/${l.id}`} className="block font-semibold hover:underline">{l.title}</Link>
                <p className="font-bold">{formatPrice(l.price)}</p>
                <p className="text-xs text-gray-500">
                  Posted {timeAgo(l.created_at)} · 👁 {l.views} views · ❤️ {l.likes} · 💬 {l.chats} chats
                </p>
                {l.status === "rejected" && l.reject_reason && <p className="text-sm text-red-600">Rejected: {l.reject_reason}</p>}
              </div>
              <div className="flex flex-wrap items-start gap-2 sm:w-44 sm:flex-col">
                <Link href={`/item/${l.id}/edit`} className="btn-outline w-full">Edit</Link>
                {l.status === "active" && (
                  <>
                    <button className="btn-outline w-full" onClick={() => act(l, "sold")}>Mark as sold</button>
                    <button className="btn-outline w-full" onClick={() => act(l, "inactive")}>Deactivate</button>
                  </>
                )}
                {["inactive", "expired", "sold"].includes(l.status) && (
                  <button className="btn-outline w-full" onClick={() => act(l, "active")}>Republish</button>
                )}
                <button className="btn w-full text-red-600 hover:bg-red-50" onClick={() => act(l, "delete")}>Delete</button>
              </div>
            </div>
          ))}
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </div>
      )}
    </div>
  );
}

export default function MyAdsPage() {
  return (
    <RequireAuth>
      <Suspense>
        <MyAds />
      </Suspense>
    </RequireAuth>
  );
}
