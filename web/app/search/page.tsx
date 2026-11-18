import { Suspense } from "react";
import SearchClient from "./SearchClient";
import { Spinner } from "@/components/ui";

export const metadata = { title: "Search ads" };

export default function SearchPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SearchClient />
    </Suspense>
  );
}
