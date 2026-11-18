"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pagination, Spinner, StatusBadge } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Paged, Report } from "@/lib/types";

export default function AdminReports() {
  const [status, setStatus] = useState("open");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Report> | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Paged<Report>>(`/admin/reports?status=${status}&page=${page}`).then(setData).catch((e) => setError(errorMessage(e)));
  }, [status, page]);
  useEffect(load, [load]);

  const resolve = async (r: Report, newStatus: string) => {
    const note = newStatus === "open" ? "" : prompt("Admin note (optional):") ?? "";
    try {
      await api(`/admin/reports/${r.id}`, { method: "PATCH", body: { status: newStatus, admin_note: note } });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      <div className="flex gap-2">
        {["open", "resolved", "dismissed", "all"].map((s) => (
          <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={`${status === s ? "btn-primary" : "btn-outline"} capitalize`}>
            {s}
          </button>
        ))}
      </div>
      {error && <Alert>{error}</Alert>}
      {!data ? (
        <Spinner />
      ) : data.items.length === 0 ? (
        <p className="card p-8 text-center text-gray-500">No reports.</p>
      ) : (
        <div className="space-y-3">
          {data.items.map((r) => (
            <div key={r.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={r.status} />
                <span className="badge bg-red-50 text-red-700">{r.reason.replace("_", " ")}</span>
                <span className="text-xs text-gray-400">#{r.id} · {timeAgo(r.created_at)} · by {r.reporter?.name}</span>
              </div>
              {r.listing && (
                <p className="text-sm">
                  Listing: <Link href={`/item/${r.listing.id}`} target="_blank" className="font-semibold hover:underline">{r.listing.title}</Link>
                </p>
              )}
              {r.reported_user && <p className="text-sm">Reported user: <b>{r.reported_user.name}</b> (#{r.reported_user.id})</p>}
              {r.details && <p className="rounded bg-gray-50 p-2 text-sm text-gray-700">{r.details}</p>}
              {r.admin_note && <p className="text-xs text-gray-500">Note: {r.admin_note}</p>}
              <div className="flex flex-wrap gap-2">
                {r.status === "open" ? (
                  <>
                    <button className="btn-primary" onClick={() => resolve(r, "resolved")}>Mark resolved</button>
                    <button className="btn-outline" onClick={() => resolve(r, "dismissed")}>Dismiss</button>
                  </>
                ) : (
                  <button className="btn-outline" onClick={() => resolve(r, "open")}>Re-open</button>
                )}
                <Link href="/admin/listings" className="btn-outline">Go to moderation</Link>
              </div>
            </div>
          ))}
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
