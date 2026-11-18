"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { PLACEHOLDER_IMG } from "@/lib/format";
import type { ListingImage } from "@/lib/types";

export default function Gallery({ images, title }: { images: ListingImage[]; title: string }) {
  const [i, setI] = useState(0);
  const list = images.length ? images : [{ id: 0, url: PLACEHOLDER_IMG, sort_order: 0 }];
  const prev = () => setI((x) => (x - 1 + list.length) % list.length);
  const next = () => setI((x) => (x + 1) % list.length);

  return (
    <div className="card overflow-hidden">
      <div className="relative flex aspect-[16/10] items-center justify-center bg-gray-900">
        <img src={list[i].url} alt={title} className="max-h-full max-w-full object-contain" />
        {list.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-3 rounded-full bg-white/80 px-3 py-1 text-xl" aria-label="Previous">‹</button>
            <button onClick={next} className="absolute right-3 rounded-full bg-white/80 px-3 py-1 text-xl" aria-label="Next">›</button>
            <span className="absolute bottom-3 right-3 rounded bg-black/60 px-2 text-xs text-white">
              {i + 1} / {list.length}
            </span>
          </>
        )}
      </div>
      {list.length > 1 && (
        <div className="flex gap-2 overflow-x-auto p-2">
          {list.map((img, idx) => (
            <button key={img.id || idx} onClick={() => setI(idx)} className={`h-16 w-20 shrink-0 overflow-hidden rounded border-2 ${idx === i ? "border-brand-600" : "border-transparent"}`}>
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
