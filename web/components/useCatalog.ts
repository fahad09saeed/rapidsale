"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Category, Location } from "@/lib/types";

let catCache: Promise<Category[]> | null = null;
let locCache: Promise<Location[]> | null = null;

export function useCategories(): Category[] {
  const [cats, setCats] = useState<Category[]>([]);
  useEffect(() => {
    catCache ??= api<Category[]>("/categories").catch((e) => {
      catCache = null;
      throw e;
    });
    catCache.then(setCats).catch(() => {});
  }, []);
  return cats;
}

export function useLocations(): Location[] {
  const [locs, setLocs] = useState<Location[]>([]);
  useEffect(() => {
    locCache ??= api<Location[]>("/locations").catch((e) => {
      locCache = null;
      throw e;
    });
    locCache.then(setLocs).catch(() => {});
  }, []);
  return locs;
}

export function findCategory(tree: Category[], pred: (c: Category) => boolean): Category | undefined {
  for (const c of tree) {
    if (pred(c)) return c;
    const hit = c.children && findCategory(c.children, pred);
    if (hit) return hit;
  }
  return undefined;
}

export function findLocation(tree: Location[], pred: (l: Location) => boolean): Location | undefined {
  for (const l of tree) {
    if (pred(l)) return l;
    const hit = l.children && findLocation(l.children, pred);
    if (hit) return hit;
  }
  return undefined;
}

/** Flattens the location tree into "City" / "Area, City" options for selects. */
export function flattenLocations(tree: Location[]): { id: number; slug: string; label: string; type: string }[] {
  const out: { id: number; slug: string; label: string; type: string }[] = [];
  for (const prov of tree) {
    out.push({ id: prov.id, slug: prov.slug, label: prov.name, type: "province" });
    for (const city of prov.children ?? []) {
      out.push({ id: city.id, slug: city.slug, label: `${city.name}`, type: "city" });
      for (const area of city.children ?? []) {
        out.push({ id: area.id, slug: area.slug, label: `${area.name}, ${city.name}`, type: "area" });
      }
    }
  }
  return out;
}
