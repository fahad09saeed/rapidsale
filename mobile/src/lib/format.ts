export const COLORS = {
  brand: "#0b8a5b",
  brandDark: "#0a6e4a",
  brandLight: "#eefbf6",
  accent: "#ffc53d",
  text: "#1f2933",
  muted: "#6b7280",
  border: "#e5e7eb",
  bg: "#f5f6f7",
  danger: "#dc2626",
};

export function formatPrice(n: number): string {
  if (!n) return "Free / Contact";
  const trim = (x: number) => x.toFixed(2).replace(/\.?0+$/, "");
  if (n >= 10_000_000) return `Rs ${trim(n / 10_000_000)} Crore`;
  if (n >= 100_000) return `Rs ${trim(n / 100_000)} Lac`;
  return `Rs ${n.toLocaleString("en-PK")}`;
}

export function timeAgo(iso?: string | null): string {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

const ICONS: Record<string, string> = {
  smartphone: "📱", car: "🚗", home: "🏠", key: "🔑", tv: "📺", bike: "🏍️", briefcase: "💼", wrench: "🔧",
  badge: "👔", paw: "🐾", sofa: "🛋️", shirt: "👗", book: "📚", baby: "🧸",
};
export const categoryIcon = (i?: string) => (i && ICONS[i]) || "🏷️";

export function attrValue(v: unknown, unit?: string): string {
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return `${v.toLocaleString()}${unit ? ` ${unit}` : ""}`;
  return String(v ?? "");
}
