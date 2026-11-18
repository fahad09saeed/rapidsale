"use client";

import { useEffect, useState } from "react";
import { ListingGrid } from "@/components/ListingCard";
import { Pagination, RequireAuth, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import type { Listing, Paged } from "@/lib/types";

function Favorites() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<Listing> | null>(null);
  useEffect(() => {
    api<Paged<Listing>>(`/me/favorites?page=${page}`).then(setData).catch(() => setData(null));
  }, [page]);
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Favourites</h1>
      {!data ? (
        <Spinner />
      ) : (
        <>
          <ListingGrid items={data.items} empty="You haven't saved any ads yet. Tap ♡ on an ad to save it." />
          <Pagination page={data.page} pages={data.pages} onPage={setPage} />
        </>
      )}
    </div>
  );
}

export default function FavoritesPage() {
  return (
    <RequireAuth>
      <Favorites />
    </RequireAuth>
  );
}
