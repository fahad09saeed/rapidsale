import { notFound } from "next/navigation";
import { Avatar } from "@/components/Header";
import { ListingGrid } from "@/components/ListingCard";
import { memberSince } from "@/lib/format";
import { serverApi } from "@/lib/server";
import type { Listing, Paged, PublicUser } from "@/lib/types";

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [profile, listings] = await Promise.all([
    serverApi<{ user: PublicUser; active_listings: number }>(`/users/${id}`),
    serverApi<Paged<Listing>>(`/listings?user_id=${id}&limit=48&sort=newest`),
  ]);
  if (!profile) notFound();
  const u = profile.user;

  return (
    <div className="space-y-6">
      <div className="card flex items-center gap-5 p-6">
        <Avatar name={u.name} url={u.avatar_url} size={88} />
        <div>
          <h1 className="text-2xl font-bold">
            {u.name} {u.verified && <span title="Verified">✅</span>}
          </h1>
          <p className="text-sm text-gray-500">
            Member since {memberSince(u.created_at)} · {profile.active_listings} active ads
          </p>
          {u.about && <p className="mt-2 max-w-2xl text-sm text-gray-700">{u.about}</p>}
        </div>
      </div>
      <ListingGrid items={listings?.items ?? []} empty="This seller has no active ads." />
    </div>
  );
}
