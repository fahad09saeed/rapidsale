"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { categoryIcon } from "@/lib/format";
import type { Category, CategoryAttribute } from "@/lib/types";

type CatForm = { id?: number; parent_id: number | null; name: string; slug: string; icon: string; sort_order: number; is_active: boolean };
type AttrForm = Omit<CategoryAttribute, "id" | "category_id" | "options"> & { id?: number; category_id: number; options: string };

const emptyAttr = (category_id: number): AttrForm => ({
  category_id, key: "", label: "", type: "text", options: "", required: false, filterable: false, unit: "", sort_order: 0,
});

export default function AdminCategories() {
  const [tree, setTree] = useState<Category[] | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [catForm, setCatForm] = useState<CatForm | null>(null);
  const [attrForm, setAttrForm] = useState<AttrForm | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api<Category[]>("/admin/categories").then(setTree).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    setError("");
    try {
      await fn();
      setCatForm(null);
      setAttrForm(null);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const saveCat = () =>
    run(() =>
      catForm!.id
        ? api(`/admin/categories/${catForm!.id}`, { method: "PUT", body: catForm })
        : api("/admin/categories", { method: "POST", body: catForm }),
    );

  const saveAttr = () => {
    const body = { ...attrForm!, options: attrForm!.options.split(",").map((s) => s.trim()).filter(Boolean) };
    return run(() =>
      attrForm!.id
        ? api(`/admin/attributes/${attrForm!.id}`, { method: "PUT", body })
        : api(`/admin/categories/${attrForm!.category_id}/attributes`, { method: "POST", body }),
    );
  };

  const editCat = (c: Category) =>
    setCatForm({ id: c.id, parent_id: c.parent_id, name: c.name, slug: c.slug, icon: c.icon, sort_order: c.sort_order, is_active: c.is_active });

  const AttrList = ({ c }: { c: Category }) => (
    <div className="mt-2 space-y-1 rounded-lg bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-gray-500">Attributes (inherited by sub-categories)</p>
        <button className="text-xs font-semibold text-brand-700" onClick={() => setAttrForm(emptyAttr(c.id))}>+ Add attribute</button>
      </div>
      {(c.attributes ?? []).length === 0 && <p className="text-xs text-gray-400">None</p>}
      {c.attributes?.map((a) => (
        <div key={a.id} className="flex items-center justify-between rounded bg-white px-2 py-1 text-sm">
          <span>
            <b>{a.label}</b> <code className="text-xs text-gray-500">{a.key}</code> · {a.type}
            {a.required && " · required"}
            {a.options?.length ? ` · ${a.options.length} options` : ""}
          </span>
          <span className="flex gap-2 text-xs">
            <button className="text-brand-700" onClick={() => setAttrForm({ ...a, unit: a.unit ?? "", options: (a.options ?? []).join(", ") })}>Edit</button>
            <button className="text-red-600" onClick={() => confirm("Delete attribute?") && run(() => api(`/admin/attributes/${a.id}`, { method: "DELETE" }))}>Delete</button>
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button className="btn-primary" onClick={() => setCatForm({ parent_id: null, name: "", slug: "", icon: "", sort_order: 0, is_active: true })}>
          + New category
        </button>
      </div>
      {error && <Alert>{error}</Alert>}
      {!tree ? (
        <Spinner />
      ) : (
        <div className="space-y-2">
          {tree.map((root) => (
            <div key={root.id} className="card p-4">
              <div className="flex items-center justify-between">
                <button className="flex items-center gap-2 text-left font-semibold" onClick={() => setOpen(open === root.id ? null : root.id)}>
                  <span className="text-xl">{categoryIcon(root.icon)}</span> {root.name}
                  <span className="text-xs font-normal text-gray-400">{root.children?.length ?? 0} sub-categories</span>
                  {!root.is_active && <span className="badge bg-gray-200">inactive</span>}
                </button>
                <span className="flex gap-3 text-sm">
                  <button className="text-brand-700" onClick={() => setCatForm({ parent_id: root.id, name: "", slug: "", icon: "", sort_order: 0, is_active: true })}>+ Sub</button>
                  <button className="text-brand-700" onClick={() => editCat(root)}>Edit</button>
                </span>
              </div>
              {open === root.id && (
                <div className="mt-3 space-y-3">
                  <AttrList c={root} />
                  {root.children?.map((c) => (
                    <div key={c.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {c.name} <code className="text-xs text-gray-400">{c.slug}</code>
                          {!c.is_active && <span className="badge ml-2 bg-gray-200">inactive</span>}
                        </span>
                        <span className="flex gap-3">
                          <button className="text-brand-700" onClick={() => editCat(c)}>Edit</button>
                          <button className="text-red-600" onClick={() => confirm(`Delete ${c.name}?`) && run(() => api(`/admin/categories/${c.id}`, { method: "DELETE" }))}>Delete</button>
                        </span>
                      </div>
                      <AttrList c={c} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={!!catForm} onClose={() => setCatForm(null)} title={catForm?.id ? "Edit category" : "New category"}>
        {catForm && (
          <div className="space-y-3">
            <div>
              <label className="label">Parent</label>
              <select className="input" value={catForm.parent_id ?? ""} onChange={(e) => setCatForm({ ...catForm, parent_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— Top level —</option>
                {tree?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <input className="input" placeholder="Name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
            <input className="input" placeholder="Slug (auto if empty)" value={catForm.slug} onChange={(e) => setCatForm({ ...catForm, slug: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Icon key (e.g. car)" value={catForm.icon} onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })} />
              <input className="input" type="number" placeholder="Sort order" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: Number(e.target.value) })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={catForm.is_active} onChange={(e) => setCatForm({ ...catForm, is_active: e.target.checked })} /> Active
            </label>
            {error && <Alert>{error}</Alert>}
            <button className="btn-primary w-full" onClick={saveCat}>Save</button>
          </div>
        )}
      </Modal>

      <Modal open={!!attrForm} onClose={() => setAttrForm(null)} title={attrForm?.id ? "Edit attribute" : "New attribute"}>
        {attrForm && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Key (e.g. brand)" value={attrForm.key} onChange={(e) => setAttrForm({ ...attrForm, key: e.target.value })} />
              <input className="input" placeholder="Label" value={attrForm.label} onChange={(e) => setAttrForm({ ...attrForm, label: e.target.value })} />
            </div>
            <select className="input" value={attrForm.type} onChange={(e) => setAttrForm({ ...attrForm, type: e.target.value as AttrForm["type"] })}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="select">Select (dropdown)</option>
              <option value="boolean">Yes / No</option>
            </select>
            {attrForm.type === "select" && (
              <textarea className="input" placeholder="Options, comma separated" value={attrForm.options} onChange={(e) => setAttrForm({ ...attrForm, options: e.target.value })} />
            )}
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Unit (optional)" value={attrForm.unit} onChange={(e) => setAttrForm({ ...attrForm, unit: e.target.value })} />
              <input className="input" type="number" placeholder="Sort order" value={attrForm.sort_order} onChange={(e) => setAttrForm({ ...attrForm, sort_order: Number(e.target.value) })} />
            </div>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={attrForm.required} onChange={(e) => setAttrForm({ ...attrForm, required: e.target.checked })} /> Required</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={attrForm.filterable} onChange={(e) => setAttrForm({ ...attrForm, filterable: e.target.checked })} /> Filterable</label>
            </div>
            {error && <Alert>{error}</Alert>}
            <button className="btn-primary w-full" onClick={saveAttr}>Save</button>
          </div>
        )}
      </Modal>
    </div>
  );
}
