"use client";
/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api, errorMessage, uploadImage } from "@/lib/api";
import { categoryIcon } from "@/lib/format";
import type { Category, CategoryAttribute, Listing } from "@/lib/types";
import { useAuth } from "./AuthProvider";
import LocationPicker from "./LocationPicker";
import { Alert } from "./ui";
import { findCategory, useCategories, useLocations } from "./useCatalog";

type AttrValues = Record<string, string | boolean>;

export default function ListingForm({ existing }: { existing?: Listing }) {
  const router = useRouter();
  const { user } = useAuth();
  const categories = useCategories();
  const locations = useLocations();

  const [root, setRoot] = useState<Category | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [attrDefs, setAttrDefs] = useState<CategoryAttribute[]>([]);
  const [attrs, setAttrs] = useState<AttrValues>({});
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [price, setPrice] = useState(existing ? String(existing.price) : "");
  const [negotiable, setNegotiable] = useState(existing?.negotiable ?? false);
  const [condition, setCondition] = useState(existing?.condition ?? "used");
  const [locationId, setLocationId] = useState(existing ? String(existing.location_id) : "");
  const [images, setImages] = useState<string[]>(existing?.images.map((i) => i.url) ?? []);
  const [contactName, setContactName] = useState(existing?.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(existing?.contact_phone ?? "");
  const [showPhone, setShowPhone] = useState(existing?.show_phone ?? true);
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Pre-select category when editing.
  useEffect(() => {
    if (!existing || !categories.length || category) return;
    const cat = findCategory(categories, (c) => c.id === existing.category_id);
    if (cat) {
      setCategory(cat);
      setRoot(findCategory(categories, (c) => c.id === cat.parent_id) ?? cat);
    }
  }, [existing, categories, category]);

  useEffect(() => {
    if (!user) return;
    setContactName((v) => v || user.name);
    setContactPhone((v) => v || user.phone || "");
  }, [user]);

  // Load attribute definitions for the chosen category.
  useEffect(() => {
    if (!category) return;
    api<{ category: Category }>(`/categories/${category.slug}`).then((r) => {
      const defs = r.category.attributes ?? [];
      setAttrDefs(defs);
      const init: AttrValues = {};
      for (const d of defs) {
        const v = existing?.category_id === category.id ? existing.attributes?.[d.key] : undefined;
        init[d.key] = d.type === "boolean" ? Boolean(v) : v !== undefined ? String(v) : "";
      }
      setAttrs(init);
    });
  }, [category, existing]);

  const noCondition = useMemo(() => {
    const slugs = ["jobs", "services", "property-for-rent", "property-for-sale", "animals"];
    return !!root && slugs.includes(root.slug);
  }, [root]);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    setError("");
    const list = Array.from(files).slice(0, 12 - images.length);
    setUploading((n) => n + list.length);
    for (const f of list) {
      try {
        const url = await uploadImage(f);
        setImages((imgs) => [...imgs, url]);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[i], next[j]] = [next[j], next[i]];
    setImages(next);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;
    setError("");
    if (!locationId) return setError("Please choose a location");
    setBusy(true);
    const attributes: Record<string, unknown> = {};
    for (const d of attrDefs) {
      const v = attrs[d.key];
      if (v === "" || v === undefined) continue;
      attributes[d.key] = d.type === "number" ? Number(v) : v;
    }
    const body = {
      category_id: category.id,
      location_id: Number(locationId),
      title,
      description,
      price: Number(price || 0),
      negotiable,
      condition: noCondition ? "" : condition,
      attributes,
      images,
      contact_name: contactName,
      contact_phone: contactPhone,
      show_phone: showPhone,
    };
    try {
      const l = existing
        ? await api<Listing>(`/listings/${existing.id}`, { method: "PUT", body })
        : await api<Listing>("/listings", { method: "POST", body });
      router.push(l.status === "pending" ? "/my-ads?posted=pending" : `/item/${l.id}`);
    } catch (err) {
      setError(errorMessage(err));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setBusy(false);
    }
  };

  // ---- Step 1: category ----
  if (!category) {
    return (
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-bold">Choose a category</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <ul className="divide-y rounded-lg border">
            {categories.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => (c.children?.length ? setRoot(c) : setCategory(c))}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${root?.id === c.id ? "bg-brand-50 font-semibold" : ""}`}
                >
                  <span className="text-2xl">{categoryIcon(c.icon)}</span>
                  <span className="flex-1">{c.name}</span>
                  <span className="text-gray-400">›</span>
                </button>
              </li>
            ))}
          </ul>
          {root && (
            <ul className="h-fit divide-y rounded-lg border">
              {root.children?.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setCategory(c)} className="w-full px-4 py-3 text-left hover:bg-gray-50">
                    {c.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  // ---- Step 2: details ----
  return (
    <form onSubmit={submit} className="space-y-6">
      {error && <Alert>{error}</Alert>}
      <div className="card flex items-center justify-between p-4">
        <p className="text-sm">
          <span className="text-gray-500">Category: </span>
          <b>{root && root.id !== category.id ? `${root.name} › ` : ""}{category.name}</b>
        </p>
        <button type="button" className="text-sm font-semibold text-brand-700 hover:underline" onClick={() => setCategory(null)}>
          Change
        </button>
      </div>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Ad details</h2>
        {!noCondition && (
          <div>
            <label className="label">Condition *</label>
            <div className="flex gap-2">
              {["new", "used", "refurbished"].map((c) => (
                <button type="button" key={c} onClick={() => setCondition(c)} className={`${condition === c ? "btn-primary" : "btn-outline"} capitalize`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {attrDefs.map((d) => (
            <div key={d.key}>
              <label className="label">
                {d.label} {d.required && "*"} {d.unit && <span className="text-gray-400">({d.unit})</span>}
              </label>
              {d.type === "select" ? (
                <select className="input" value={String(attrs[d.key] ?? "")} required={d.required} onChange={(e) => setAttrs({ ...attrs, [d.key]: e.target.value })}>
                  <option value="">Select</option>
                  {d.options?.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : d.type === "boolean" ? (
                <label className="flex items-center gap-2 pt-2 text-sm">
                  <input type="checkbox" checked={Boolean(attrs[d.key])} onChange={(e) => setAttrs({ ...attrs, [d.key]: e.target.checked })} />
                  Yes
                </label>
              ) : (
                <input
                  className="input"
                  type={d.type === "number" ? "number" : "text"}
                  min={0}
                  value={String(attrs[d.key] ?? "")}
                  required={d.required}
                  onChange={(e) => setAttrs({ ...attrs, [d.key]: e.target.value })}
                />
              )}
            </div>
          ))}
        </div>
        <div>
          <label className="label">Ad title *</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} maxLength={150} />
          <p className="mt-1 text-xs text-gray-400">Mention the key features (e.g. brand, model, age, type). {title.length}/150</p>
        </div>
        <div>
          <label className="label">Description *</label>
          <textarea className="input min-h-36" value={description} onChange={(e) => setDescription(e.target.value)} required minLength={20} maxLength={5000} />
          <p className="mt-1 text-xs text-gray-400">Include condition, features and reason for selling. {description.length}/5000</p>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Price</h2>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-64">
            <span className="absolute left-3 top-2 text-sm text-gray-500">Rs</span>
            <input className="input pl-9" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="0" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} /> Negotiable
          </label>
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Photos <span className="text-sm font-normal text-gray-400">(up to 12, first is the cover)</span></h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {images.map((url, i) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border">
              <img src={url} alt="" className="h-full w-full object-cover" />
              {i === 0 && <span className="absolute left-1 top-1 rounded bg-brand-600 px-1 text-[10px] text-white">COVER</span>}
              <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 px-1 text-white opacity-0 transition group-hover:opacity-100">
                <button type="button" onClick={() => move(i, -1)}>‹</button>
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))}>✕</button>
                <button type="button" onClick={() => move(i, 1)}>›</button>
              </div>
            </div>
          ))}
          {images.length < 12 && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-gray-400 hover:border-brand-600 hover:text-brand-700">
              <span className="text-2xl">+</span>
              <span className="text-xs">{uploading ? `Uploading ${uploading}...` : "Add photos"}</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            </label>
          )}
        </div>
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Location *</h2>
        <LocationPicker tree={locations} value={locationId} onChange={setLocationId} />
      </section>

      <section className="card space-y-4 p-6">
        <h2 className="text-lg font-bold">Contact details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input className="input" value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={120} />
          </div>
          <div>
            <label className="label">Phone number</label>
            <input className="input" placeholder="03XXXXXXXXX" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} /> Show my phone number in ads
        </label>
      </section>

      <button className="btn-primary w-full py-3 text-base" disabled={busy || uploading > 0}>
        {busy ? "Saving..." : existing ? "Save changes" : "Post now"}
      </button>
    </form>
  );
}
