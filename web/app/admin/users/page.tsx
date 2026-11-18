"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Alert, Pagination, Spinner, StatusBadge } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import type { Paged, Role, User } from "@/lib/types";

type Row = User & { listings: number };

export default function AdminUsers() {
  const { can, user: me } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Row> | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    api<Paged<Row>>(`/admin/users?${p}`).then(setData).catch((e) => setError(errorMessage(e)));
  }, [page, q, status]);
  useEffect(load, [load]);
  useEffect(() => {
    api<Role[]>("/admin/roles").then(setRoles).catch(() => {});
  }, []);

  const update = async (u: Row, body: { status?: string; role_id?: number }) => {
    setError("");
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const manage = can("users.manage");

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Users</h1>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }}>
        <input className="input max-w-xs" placeholder="Search name, email, phone" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Unverified</option>
          <option value="banned">Banned</option>
        </select>
        <button className="btn-outline">Search</button>
      </form>
      {error && <Alert>{error}</Alert>}
      {!data ? (
        <Spinner />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="p-3">User</th>
                <th className="p-3">Contact</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Ads</th>
                <th className="p-3">Joined</th>
                {manage && <th className="p-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((u) => (
                <tr key={u.id}>
                  <td className="p-3 font-medium">{u.name} <span className="text-xs text-gray-400">#{u.id}</span></td>
                  <td className="p-3 text-xs">{u.phone}<br />{u.email}</td>
                  <td className="p-3">
                    {manage && u.id !== me?.id ? (
                      <select className="input py-1" value={u.role_id} onChange={(e) => update(u, { role_id: Number(e.target.value) })}>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="capitalize">{u.role?.name}</span>
                    )}
                  </td>
                  <td className="p-3"><StatusBadge status={u.status} /></td>
                  <td className="p-3">{u.listings}</td>
                  <td className="p-3 text-xs text-gray-500">{timeAgo(u.created_at)}</td>
                  {manage && (
                    <td className="p-3">
                      {u.id !== me?.id &&
                        (u.status === "banned" ? (
                          <button className="btn-outline py-1" onClick={() => update(u, { status: "active" })}>Unban</button>
                        ) : (
                          <button className="btn-danger py-1" onClick={() => confirm(`Ban ${u.name}? Their ads will be hidden.`) && update(u, { status: "banned" })}>
                            Ban
                          </button>
                        ))}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <Pagination page={data.page} pages={data.pages} onPage={setPage} />}
    </div>
  );
}
