"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AuthCard from "@/components/AuthCard";
import { Alert } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { OtpResponse } from "@/lib/types";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) return setError("Passwords do not match");
    if (!form.phone && !form.email) return setError("Enter a phone number or an email");
    setBusy(true);
    try {
      const r = await api<OtpResponse>("/auth/register", {
        method: "POST",
        body: { name: form.name, phone: form.phone || undefined, email: form.email || undefined, password: form.password },
      });
      const q = new URLSearchParams({ target: r.target });
      if (r.dev_code) q.set("dev", r.dev_code);
      router.push(`/verify?${q}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Create your account" subtitle="We'll send a verification code to your phone (or email)">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.name} onChange={set("name")} required minLength={2} maxLength={120} />
        </div>
        <div>
          <label className="label">Mobile number</label>
          <input className="input" placeholder="03XXXXXXXXX" inputMode="tel" value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="label">Email <span className="text-gray-400">(optional if phone given)</span></label>
          <input className="input" type="email" value={form.email} onChange={set("email")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password} onChange={set("password")} required minLength={8} />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input className="input" type="password" value={form.confirm} onChange={set("confirm")} required minLength={8} />
          </div>
        </div>
        {error && <Alert>{error}</Alert>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Creating account..." : "Create account"}</button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account? <Link href="/login" className="font-semibold text-brand-700 hover:underline">Log in</Link>
      </p>
    </AuthCard>
  );
}
