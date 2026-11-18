"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "./AuthProvider";

export default function FavoriteButton({ listingId, initial }: { listingId: number; initial: boolean }) {
  const { user } = useAuth();
  const router = useRouter();
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => setFav(initial), [initial]);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!user) {
      router.push("/login");
      return;
    }
    setBusy(true);
    const next = !fav;
    setFav(next);
    try {
      await api(`/listings/${listingId}/favorite`, { method: next ? "POST" : "DELETE" });
    } catch {
      setFav(!next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      aria-label={fav ? "Remove from favourites" : "Add to favourites"}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg shadow hover:scale-105"
    >
      {fav ? "❤️" : "🤍"}
    </button>
  );
}
