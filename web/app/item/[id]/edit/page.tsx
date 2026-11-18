"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ListingForm from "@/components/ListingForm";
import { Alert, RequireAuth, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { Listing, ListingDetail } from "@/lib/types";

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<ListingDetail>(`/listings/${id}?nv=1`)
      .then((d) => setListing(d.listing))
      .catch((e) => setError(errorMessage(e)));
  }, [id]);

  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold">Edit ad</h1>
        {error ? <Alert>{error}</Alert> : listing ? <ListingForm existing={listing} /> : <Spinner />}
      </div>
    </RequireAuth>
  );
}
