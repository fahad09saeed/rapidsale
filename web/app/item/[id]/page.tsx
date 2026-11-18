/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingGrid } from "@/components/ListingCard";
import { attrValue, formatPrice, memberSince, timeAgo } from "@/lib/format";
import { serverApi } from "@/lib/server";
import type { ListingDetail } from "@/lib/types";
import Gallery from "./Gallery";
import ItemActions from "./ItemActions";
import { Avatar } from "@/components/Header";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!/^\d+$/.test(id)) return null;
  return serverApi<ListingDetail>(`/listings/${id}?nv=1`, 15);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await load((await params).id);
  if (!d) return { title: "Ad not found" };
  return {
    title: d.listing.title,
    description: d.listing.description.slice(0, 160),
    openGraph: { title: d.listing.title, images: d.listing.images.slice(0, 1).map((i) => i.url) },
  };
}

export default async function ItemPage({ params }: Props) {
  const { id } = await params;
  const d = await load(id);
  if (!d) notFound();
  const { listing: l, seller } = d;

  return (
    <div className="space-y-8">
      <nav className="flex flex-wrap gap-1 text-sm text-gray-500">
        <Link href="/" className="hover:underline">Home</Link>
        {d.category_path.map((c) => (
          <span key={c.id}>
            {" / "}
            <Link href={`/search?category=${c.slug}`} className="hover:underline">{c.name}</Link>
          </span>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Gallery images={l.images} title={l.title} />

          <div className="card p-5">
            <h2 className="mb-3 text-lg font-bold">Details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {l.condition && (
                <>
                  <dt className="text-gray-500">Condition</dt>
                  <dd className="font-medium capitalize">{l.condition}</dd>
                </>
              )}
              {d.attribute_defs
                .filter((a) => l.attributes?.[a.key] !== undefined)
                .map((a) => (
                  <div key={a.key} className="contents">
                    <dt className="text-gray-500">{a.label}</dt>
                    <dd className="font-medium">{attrValue(l.attributes[a.key], a.unit)}</dd>
                  </div>
                ))}
            </dl>
          </div>

          <div className="card p-5">
            <h2 className="mb-3 text-lg font-bold">Description</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">{l.description}</p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card space-y-2 p-5">
            <p className="text-3xl font-extrabold">{formatPrice(l.price)}</p>
            {l.negotiable && <span className="badge bg-brand-50 text-brand-700">Negotiable</span>}
            <h1 className="text-lg font-medium text-gray-800">{l.title}</h1>
            <div className="flex justify-between text-sm text-gray-500">
              <span>📍 {d.location_path.map((x) => x.name).reverse().join(", ")}</span>
              <span>{timeAgo(l.created_at)}</span>
            </div>
            {l.status !== "active" && (
              <p className="rounded bg-amber-50 p-2 text-sm text-amber-800">
                This ad is <b>{l.status}</b>{l.reject_reason ? `: ${l.reject_reason}` : ""}.
              </p>
            )}
          </div>

          <div className="card space-y-4 p-5">
            <Link href={`/user/${seller.id}`} className="flex items-center gap-3">
              <Avatar name={seller.name} url={seller.avatar_url} size={52} />
              <div>
                <p className="font-bold">
                  {seller.name} {seller.verified && <span title="Verified">✅</span>}
                </p>
                <p className="text-xs text-gray-500">
                  Member since {memberSince(seller.created_at)} · {d.seller_listings} active ads
                </p>
              </div>
            </Link>
            <ItemActions listing={l} sellerId={seller.id} />
          </div>

          <div className="card p-5 text-sm text-gray-600">
            <p className="mb-2 font-bold text-gray-900">Safety tips</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Meet the seller in a safe public place.</li>
              <li>Check the item before you buy.</li>
              <li>Pay only after collecting the item.</li>
              <li>Never share OTP codes or bank details.</li>
            </ul>
          </div>
          <p className="text-center text-xs text-gray-400">Ad ID {l.id} · {l.views} views</p>
        </aside>
      </div>

      {d.related.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold">Related ads</h2>
          <ListingGrid items={d.related} />
        </section>
      )}
    </div>
  );
}
