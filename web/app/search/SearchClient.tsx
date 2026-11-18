"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ListingGrid } from "@/components/ListingCard";
import LocationPicker from "@/components/LocationPicker";
import { Pagination, Spinner } from "@/components/ui";
import { findCategory, useCategories, useLocations } from "@/components/useCatalog";
import { api, errorMessage } from "@/lib/api";
import type { Category, CategoryAttribute, Listing, Paged } from "@/lib/types";

export default function SearchClient() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const categories = useCategories();
  const locations = useLocations();
  const [data, setData] = useState<Paged<Listing> | null>(null);
  const [error, setError] = useState("");
  const [attrs, setAttrs] = useState<CategoryAttribute[]>([]);
  const [minPrice, setMinPrice] = useState(params.get("min_price") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("max_price") ?? "");

  const categorySlug = params.get("category") ?? "";
  const current = useMemo(
    () => (categorySlug ? findCategory(categories, (c) => c.slug === categorySlug) : undefined),
    [categories, categorySlug],
  );
  const parent = useMemo(
    () => (current?.parent_id ? findCategory(categories, (c) => c.id === current.parent_id) : undefined),
    [categories, current],
  );

  const setParam = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (!("page" in updates)) next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  useEffect(() => {
    setData(null);
    setError("");
    const ctrl = new AbortController();
    api<Paged<Listing>>(`/listings?${params.toString()}`, { signal: ctrl.signal })
      .then(setData)
      .catch((e) => !ctrl.signal.aborted && setError(errorMessage(e)));
    return () => ctrl.abort();
  }, [params]);

  useEffect(() => {
    if (!categorySlug) return setAttrs([]);
    api<{ category: Category }>(`/categories/${categorySlug}`)
      .then((r) => setAttrs((r.category.attributes ?? []).filter((a) => a.filterable && a.type === "select")))
      .catch(() => setAttrs([]));
  }, [categorySlug]);

  const subcats = current?.children?.length ? current.children : parent?.children ?? categories;

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-5">
        <div className="card p-4">
          <p className="mb-2 font-bold">Categories</p>
          {current && (
            <button className="mb-2 text-sm text-brand-700 hover:underline" onClick={() => setParam({ category: parent?.slug ?? null })}>
              ‹ {parent ? parent.name : "All categories"}
            </button>
          )}
          <ul className="max-h-80 space-y-1 overflow-y-auto text-sm">
            {subcats.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setParam({ category: c.slug })}
                  className={`w-full rounded px-2 py-1 text-left hover:bg-gray-100 ${c.slug === categorySlug ? "bg-brand-50 font-semibold text-brand-700" : ""}`}
                >
                  {c.name}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="card space-y-2 p-4">
          <p className="font-bold">Location</p>
          <div className="[&>div]:grid-cols-1">
            <LocationPicker tree={locations} value={params.get("location") ?? ""} onChange={(v) => setParam({ location: v || null })} allowAny byId={false} />
          </div>
        </div>

        <div className="card space-y-2 p-4">
          <p className="font-bold">Price (Rs)</p>
          <div className="flex gap-2">
            <input className="input" inputMode="numeric" placeholder="Min" value={minPrice} onChange={(e) => setMinPrice(e.target.value.replace(/\D/g, ""))} />
            <input className="input" inputMode="numeric" placeholder="Max" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))} />
          </div>
          <button className="btn-outline w-full" onClick={() => setParam({ min_price: minPrice || null, max_price: maxPrice || null })}>
            Apply
          </button>
        </div>

        <div className="card space-y-2 p-4">
          <p className="font-bold">Condition</p>
          <select className="input" value={params.get("condition") ?? ""} onChange={(e) => setParam({ condition: e.target.value || null })}>
            <option value="">Any</option>
            <option value="new">New</option>
            <option value="used">Used</option>
            <option value="refurbished">Refurbished</option>
          </select>
        </div>

        {attrs.map((a) => (
          <div key={a.key} className="card space-y-2 p-4">
            <p className="font-bold">{a.label}</p>
            <select className="input" value={params.get(`attr.${a.key}`) ?? ""} onChange={(e) => setParam({ [`attr.${a.key}`]: e.target.value || null })}>
              <option value="">Any</option>
              {a.options?.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        ))}

        <Link href="/search" className="block text-center text-sm text-gray-500 hover:underline">
          Clear all filters
        </Link>
      </aside>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">
              {params.get("q") ? `Results for "${params.get("q")}"` : current?.name ?? "All ads"}
            </h1>
            {data && <p className="text-sm text-gray-500">{data.total.toLocaleString()} ads found</p>}
          </div>
          <select className="input w-auto" value={params.get("sort") ?? ""} onChange={(e) => setParam({ sort: e.target.value || null })}>
            <option value="">Featured first</option>
            <option value="newest">Newest first</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </div>
        {error ? (
          <p className="card p-6 text-red-600">{error}</p>
        ) : !data ? (
          <Spinner />
        ) : (
          <>
            <ListingGrid items={data.items} empty="No ads match your filters." />
            <Pagination page={data.page} pages={data.pages} onPage={(p) => setParam({ page: String(p) })} />
          </>
        )}
      </section>
    </div>
  );
}
