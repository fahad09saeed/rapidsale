"use client";

import ListingForm from "@/components/ListingForm";
import { RequireAuth } from "@/components/ui";

export default function PostPage() {
  return (
    <RequireAuth>
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-4 text-2xl font-bold">Post your ad</h1>
        <ListingForm />
      </div>
    </RequireAuth>
  );
}
