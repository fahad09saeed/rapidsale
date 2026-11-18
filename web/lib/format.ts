export function formatPrice(n: number): string {
  if (!n) return "Free / Contact";
  if (n >= 10_000_000) return `Rs ${trim(n / 10_000_000)} Crore`;
  if (n >= 100_000) return `Rs ${trim(n / 100_000)} Lac`;
  return `Rs ${n.toLocaleString("en-PK")}`;
}

function trim(x: number): string {
  return x.toFixed(2).replace(/\.?0+$/, "");
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-PK");
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} days ago`;
  return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
}

export function memberSince(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", { month: "short", year: "numeric" });
}

const ICONS: Record<string, string> = {
  smartphone: "📱", car: "🚗", home: "🏠", key: "🔑", tv: "📺", bike: "🏍️", briefcase: "💼", wrench: "🔧",
  badge: "👔", paw: "🐾", sofa: "🛋️", shirt: "👗", book: "📚", baby: "🧸",
};

export function categoryIcon(icon?: string): string {
  return (icon && ICONS[icon]) || "🏷️";
}

export function attrValue(v: unknown, unit?: string): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return `${v.toLocaleString("en-PK")}${unit ? ` ${unit}` : ""}`;
  return String(v ?? "");
}

export const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  rejected: "bg-red-100 text-red-800",
  sold: "bg-sky-100 text-sky-800",
  expired: "bg-gray-200 text-gray-700",
  inactive: "bg-gray-200 text-gray-700",
  banned: "bg-red-100 text-red-800",
  open: "bg-amber-100 text-amber-800",
  resolved: "bg-emerald-100 text-emerald-800",
  dismissed: "bg-gray-200 text-gray-700",
};

export const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#e5e7eb"/><text x="200" y="160" font-family="sans-serif" font-size="22" fill="#9ca3af" text-anchor="middle">No image</text></svg>`,
  );
