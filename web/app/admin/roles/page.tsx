"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, RequireAuth, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { Permission, Role } from "@/lib/types";

type RoleRow = Role & { users: number };
type Form = { id?: number; name: string; description: string; permission_ids: number[]; is_system?: boolean };

function Roles() {
  const [roles, setRoles] = useState<RoleRow[] | null>(null);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<RoleRow[]>("/admin/roles").then(setRoles).catch((e) => setError(errorMessage(e)));
    api<Permission[]>("/admin/permissions").then(setPerms).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const save = async () => {
    setError("");
    try {
      if (form!.id) await api(`/admin/roles/${form!.id}`, { method: "PUT", body: form });
      else await api("/admin/roles", { method: "POST", body: form });
      setForm(null);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const remove = async (r: RoleRow) => {
    if (!confirm(`Delete role ${r.name}?`)) return;
    try {
      await api(`/admin/roles/${r.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const toggle = (id: number) =>
    setForm((f) => f && { ...f, permission_ids: f.permission_ids.includes(id) ? f.permission_ids.filter((x) => x !== id) : [...f.permission_ids, id] });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Roles & permissions</h1>
        <button className="btn-primary" onClick={() => setForm({ name: "", description: "", permission_ids: [] })}>+ New role</button>
      </div>
      {error && !form && <Alert>{error}</Alert>}
      {!roles ? (
        <Spinner />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {roles.map((r) => (
            <div key={r.id} className="card space-y-2 p-4">
              <div className="flex items-center justify-between">
                <p className="text-lg font-bold capitalize">
                  {r.name} {r.is_system && <span className="badge bg-gray-100 text-gray-600">system</span>}
                </p>
                <span className="text-sm text-gray-500">{r.users} users</span>
              </div>
              <p className="text-sm text-gray-600">{r.description}</p>
              <div className="flex flex-wrap gap-1">
                {r.name === "superadmin" ? (
                  <span className="badge bg-brand-50 text-brand-700">all permissions</span>
                ) : r.permissions?.length ? (
                  r.permissions.map((p) => <code key={p.id} className="rounded bg-gray-100 px-1.5 text-xs">{p.name}</code>)
                ) : (
                  <span className="text-xs text-gray-400">no admin permissions</span>
                )}
              </div>
              {r.name !== "superadmin" && (
                <div className="flex gap-3 pt-1 text-sm">
                  <button
                    className="text-brand-700"
                    onClick={() => setForm({ id: r.id, name: r.name, description: r.description, is_system: r.is_system, permission_ids: (r.permissions ?? []).map((p) => p.id) })}
                  >
                    Edit
                  </button>
                  {!r.is_system && <button className="text-red-600" onClick={() => remove(r)}>Delete</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Edit role" : "New role"}>
        {form && (
          <div className="space-y-3">
            <input className="input" placeholder="Role name" value={form.name} disabled={form.is_system} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border p-2">
              {perms.map((p) => (
                <label key={p.id} className="flex items-start gap-2 rounded p-1 text-sm hover:bg-gray-50">
                  <input type="checkbox" className="mt-1" checked={form.permission_ids.includes(p.id)} onChange={() => toggle(p.id)} />
                  <span>
                    <code className="text-xs">{p.name}</code>
                    <span className="block text-xs text-gray-500">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
            {error && <Alert>{error}</Alert>}
            <button className="btn-primary w-full" onClick={save}>Save role</button>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function RolesPage() {
  return (
    <RequireAuth permission="roles.manage">
      <Roles />
    </RequireAuth>
  );
}
