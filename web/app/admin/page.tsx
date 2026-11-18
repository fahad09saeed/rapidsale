"use client";

import { useEffect, useState } from "react";
import { Alert, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";

interface Stats {
  users: { total: number; active: number; banned: number; pending: number; new_7days: number };
  listings: {
    total: number;
    new_7days: number;
    by_status: { status: string; count: number }[];
    per_day: { day: string; count: number }[];
  };
  reports_open: number;
  conversations: number;
  messages: number;
  top_categories: { category_id: number; name: string; count: number }[];
}

export default function AdminDashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Stats>("/admin/stats").then(setS).catch((e) => setError(errorMessage(e)));
  }, []);
  if (error) return <Alert>{error}</Alert>;
  if (!s) return <Spinner />;

  const maxDay = Math.max(1, ...s.listings.per_day.map((d) => d.count));
  const topCats = [...(s.top_categories ?? [])].sort((a, b) => b.count - a.count);
  const maxCat = Math.max(1, ...topCats.map((c) => c.count));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Users" value={s.users.total} sub={`+${s.users.new_7days} this week`} />
        <Tile label="Listings" value={s.listings.total} sub={`+${s.listings.new_7days} this week`} />
        <Tile label="Open reports" value={s.reports_open} sub="needs review" warn={s.reports_open > 0} />
        <Tile label="Messages" value={s.messages} sub={`${s.conversations} conversations`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-bold">New listings — last 14 days</h2>
          {s.listings.per_day.length === 0 ? (
            <p className="text-sm text-gray-500">No data yet.</p>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {s.listings.per_day.map((d) => (
                <div key={d.day} className="group relative flex flex-1 flex-col items-center justify-end">
                  <span className="absolute -top-5 hidden text-xs group-hover:block">{d.count}</span>
                  <div className="w-full rounded-t bg-brand-500" style={{ height: `${(d.count / maxDay) * 100}%` }} title={`${d.day}: ${d.count}`} />
                  <span className="mt-1 text-[10px] text-gray-400">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-bold">Active listings by category</h2>
          <div className="space-y-2">
            {topCats.length === 0 && <p className="text-sm text-gray-500">No data yet.</p>}
            {topCats.map((c) => (
              <div key={c.category_id} className="grid grid-cols-[150px_1fr_40px] items-center gap-2 text-sm">
                <span className="truncate">{c.name}</span>
                <div className="h-3 rounded bg-gray-100">
                  <div className="h-3 rounded bg-brand-500" style={{ width: `${(c.count / maxCat) * 100}%` }} />
                </div>
                <span className="text-right tabular-nums">{c.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-bold">Listings by status</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            {s.listings.by_status.map((b) => (
              <li key={b.status} className="flex justify-between rounded bg-gray-50 px-3 py-2 capitalize">
                {b.status} <b className="tabular-nums">{b.count}</b>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-bold">Users by status</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm">
            <li className="flex justify-between rounded bg-gray-50 px-3 py-2">Active <b>{s.users.active}</b></li>
            <li className="flex justify-between rounded bg-gray-50 px-3 py-2">Unverified <b>{s.users.pending}</b></li>
            <li className="flex justify-between rounded bg-gray-50 px-3 py-2">Banned <b>{s.users.banned}</b></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, warn }: { label: string; value: number; sub: string; warn?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-extrabold tabular-nums ${warn ? "text-amber-600" : ""}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
}
