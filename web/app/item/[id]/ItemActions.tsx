"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import FavoriteButton from "@/components/FavoriteButton";
import { Alert, Modal } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { Conversation, Listing, ListingDetail } from "@/lib/types";

const REASONS: [string, string][] = [
  ["fraud", "Fraud / scam"],
  ["spam", "Spam"],
  ["offensive", "Offensive content"],
  ["duplicate", "Duplicate ad"],
  ["wrong_category", "Wrong category"],
  ["sold", "Item already sold"],
  ["prohibited", "Prohibited item"],
  ["other", "Other"],
];

export default function ItemActions({ listing, sellerId }: { listing: Listing; sellerId: number }) {
  const { user } = useAuth();
  const router = useRouter();
  const [fresh, setFresh] = useState<Listing>(listing);
  const [showPhone, setShowPhone] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [msg, setMsg] = useState("Hi, is this still available?");
  const [reason, setReason] = useState("fraud");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Re-fetch with the user's session: counts the view and reveals favourite state / phone.
  useEffect(() => {
    api<ListingDetail>(`/listings/${listing.id}`)
      .then((d) => setFresh(d.listing))
      .catch(() => {});
  }, [listing.id, user]);

  const isOwner = user?.id === sellerId;
  const requireLogin = () => {
    if (!user) {
      router.push(`/login?next=/item/${listing.id}`);
      return false;
    }
    return true;
  };

  const startChat = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await api<{ conversation: Conversation }>("/conversations", {
        method: "POST",
        body: { listing_id: listing.id, body: msg },
      });
      router.push(`/chat?c=${r.conversation.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const report = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/reports", { method: "POST", body: { listing_id: listing.id, reason, details } });
      setReportOpen(false);
      setNotice("Thanks — our team will review this ad.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (isOwner) {
    return (
      <div className="space-y-2">
        <Link href={`/item/${listing.id}/edit`} className="btn-primary w-full">Edit ad</Link>
        <Link href="/my-ads" className="btn-outline w-full">Manage my ads</Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notice && <Alert kind="success">{notice}</Alert>}
      <button className="btn-primary w-full" onClick={() => requireLogin() && setChatOpen(true)} disabled={fresh.status !== "active"}>
        💬 Chat with seller
      </button>
      {fresh.has_phone && (
        <button className="btn-outline w-full" onClick={() => requireLogin() && setShowPhone(true)}>
          📞 {showPhone && fresh.contact_phone ? <a href={`tel:${fresh.contact_phone}`}>{fresh.contact_phone}</a> : "Show phone number"}
        </button>
      )}
      <div className="flex items-center justify-between pt-1">
        <FavoriteButton listingId={listing.id} initial={fresh.is_favorite} />
        <button className="text-sm text-gray-500 hover:text-red-600" onClick={() => requireLogin() && setReportOpen(true)}>
          🚩 Report this ad
        </button>
      </div>

      <Modal open={chatOpen} onClose={() => setChatOpen(false)} title="Send a message">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {["Hi, is this still available?", "What is your final price?", "Can I see it today?"].map((s) => (
              <button key={s} className="rounded-full border px-3 py-1 text-xs hover:border-brand-600" onClick={() => setMsg(s)}>
                {s}
              </button>
            ))}
          </div>
          <textarea className="input min-h-24" value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} />
          {error && <Alert>{error}</Alert>}
          <button className="btn-primary w-full" disabled={busy || !msg.trim()} onClick={startChat}>
            Send
          </button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report this ad">
        <div className="space-y-3">
          <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
            {REASONS.map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <textarea className="input min-h-24" placeholder="Tell us more (optional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={2000} />
          {error && <Alert>{error}</Alert>}
          <button className="btn-danger w-full" disabled={busy} onClick={report}>
            Submit report
          </button>
        </div>
      </Modal>
    </div>
  );
}
