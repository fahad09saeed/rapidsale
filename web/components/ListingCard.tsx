/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { formatPrice, PLACEHOLDER_IMG, timeAgo } from "@/lib/format";
import type { Listing } from "@/lib/types";
import FavoriteButton from "./FavoriteButton";

export default function ListingCard({ listing }: { listing: Listing }) {
  const img = listing.images?.[0]?.url || PLACEHOLDER_IMG;
  return (
    <div className="card group relative overflow-hidden transition hover:shadow-md">
      <Link href={`/item/${listing.id}`} className="block">
        <div className="relative aspect-[4/3] bg-gray-100">
          <img src={img} alt={listing.title} className="h-full w-full object-cover" loading="lazy" />
          {listing.is_featured && (
            <span className="absolute left-2 top-2 rounded bg-accent-400 px-2 py-0.5 text-xs font-bold text-gray-900">
              FEATURED
            </span>
          )}
          {listing.status === "sold" && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xl font-bold text-white">SOLD</span>
          )}
        </div>
        <div className="space-y-1 p-3">
          <p className="text-lg font-bold text-gray-900">{formatPrice(listing.price)}</p>
          <p className="line-clamp-2 min-h-[2.5rem] text-sm text-gray-700">{listing.title}</p>
          <div className="flex justify-between pt-1 text-xs text-gray-500">
            <span className="truncate">{listing.location?.name}</span>
            <span className="shrink-0">{timeAgo(listing.created_at)}</span>
          </div>
        </div>
      </Link>
      <div className="absolute right-2 top-2">
        <FavoriteButton listingId={listing.id} initial={listing.is_favorite} />
      </div>
    </div>
  );
}

export function ListingGrid({ items, empty = "No ads found." }: { items: Listing[]; empty?: string }) {
  if (!items.length) return <p className="card p-10 text-center text-gray-500">{empty}</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((l) => (
        <ListingCard key={l.id} listing={l} />
      ))}
    </div>
  );
}
