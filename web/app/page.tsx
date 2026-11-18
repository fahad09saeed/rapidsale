import Link from "next/link";
import { ListingGrid } from "@/components/ListingCard";
import { categoryIcon } from "@/lib/format";
import { serverApi } from "@/lib/server";
import type { Category, Listing, Paged } from "@/lib/types";

// Render per request (the API is not reachable during `docker build`); fetches are still cached for 30s.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, featured, latest] = await Promise.all([
    serverApi<Category[]>("/categories", 300),
    serverApi<Paged<Listing>>("/listings?featured=1&limit=8"),
    serverApi<Paged<Listing>>("/listings?sort=newest&limit=16"),
  ]);

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-2xl bg-gradient-to-r from-brand-700 to-brand-500 px-6 py-10 text-white sm:px-10">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Buy & sell anything near you</h1>
        <p className="mt-2 max-w-xl text-brand-50">
          Mobiles, cars, property, electronics, jobs and much more — chat with sellers instantly.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/post" className="btn bg-accent-400 font-bold text-gray-900 hover:bg-accent-500">
            Post your ad for free
          </Link>
          <Link href="/search" className="btn border border-white/60 text-white hover:bg-white/10">
            Browse all ads
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">All categories</h2>
        {categories ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/search?category=${c.slug}`}
                className="card flex flex-col items-center gap-2 p-3 text-center transition hover:border-brand-600 hover:shadow-sm"
              >
                <span className="text-3xl">{categoryIcon(c.icon)}</span>
                <span className="text-xs font-medium leading-tight text-gray-700">{c.name}</span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="card p-6 text-center text-gray-500">Unable to reach the API. Is the backend running?</p>
        )}
      </section>

      {featured && featured.items.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Featured ads</h2>
          <ListingGrid items={featured.items} />
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Fresh recommendations</h2>
          <Link href="/search?sort=newest" className="text-sm font-semibold text-brand-700 hover:underline">
            View all
          </Link>
        </div>
        <ListingGrid items={latest?.items ?? []} empty="No ads yet — be the first to post one!" />
      </section>
    </div>
  );
}
