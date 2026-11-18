"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { RequireAuth } from "@/components/ui";

const NAV: { href: string; label: string; perm: string }[] = [
  { href: "/admin", label: "📊 Dashboard", perm: "admin.access" },
  { href: "/admin/listings", label: "📝 Listings", perm: "listings.moderate" },
  { href: "/admin/reports", label: "🚩 Reports", perm: "reports.manage" },
  { href: "/admin/users", label: "👥 Users", perm: "users.view" },
  { href: "/admin/categories", label: "🗂️ Categories", perm: "categories.manage" },
  { href: "/admin/roles", label: "🔐 Roles & Permissions", perm: "roles.manage" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth permission="admin.access">
      <AdminShell>{children}</AdminShell>
    </RequireAuth>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const { can, user } = useAuth();
  const path = usePathname();
  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="card h-fit p-2">
        <p className="px-3 py-2 text-xs font-semibold uppercase text-gray-400">Admin · {user?.role_name}</p>
        <nav className="flex gap-1 overflow-x-auto lg:flex-col">
          {NAV.filter((n) => can(n.perm)).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${path === n.href ? "bg-brand-50 font-semibold text-brand-700" : "hover:bg-gray-50"}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
