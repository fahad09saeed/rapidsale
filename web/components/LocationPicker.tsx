"use client";

import type { Location } from "@/lib/types";

/** Cascading Province → City → Area selector. `value` is the selected location id. */
export default function LocationPicker({
  tree,
  value,
  onChange,
  allowAny = false,
  byId = true,
}: {
  tree: Location[];
  value: string;
  onChange: (v: string) => void;
  allowAny?: boolean;
  byId?: boolean; // emit ids (forms) or slugs (filters)
}) {
  const key = (l: Location) => (byId ? String(l.id) : l.slug);

  // Resolve the chain for the current value.
  let prov: Location | undefined, city: Location | undefined, area: Location | undefined;
  for (const p of tree) {
    if (key(p) === value) prov = p;
    for (const c of p.children ?? []) {
      if (key(c) === value) [prov, city] = [p, c];
      for (const a of c.children ?? []) if (key(a) === value) [prov, city, area] = [p, c, a];
    }
  }

  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <select className="input" value={prov ? key(prov) : ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">{allowAny ? "All Pakistan" : "Select province"}</option>
        {tree.map((p) => (
          <option key={p.id} value={key(p)}>{p.name}</option>
        ))}
      </select>
      <select
        className="input"
        value={city ? key(city) : ""}
        disabled={!prov?.children?.length}
        onChange={(e) => onChange(e.target.value || (prov ? key(prov) : ""))}
      >
        <option value="">{allowAny ? "All cities" : "Select city"}</option>
        {prov?.children?.map((c) => (
          <option key={c.id} value={key(c)}>{c.name}</option>
        ))}
      </select>
      <select
        className="input"
        value={area ? key(area) : ""}
        disabled={!city?.children?.length}
        onChange={(e) => onChange(e.target.value || (city ? key(city) : ""))}
      >
        <option value="">{city?.children?.length ? "All areas" : "—"}</option>
        {city?.children?.map((a) => (
          <option key={a.id} value={key(a)}>{a.name}</option>
        ))}
      </select>
    </div>
  );
}
