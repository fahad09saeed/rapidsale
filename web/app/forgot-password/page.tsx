"use client";

import Link from "next/link";
import { useState } from "react";
import AuthCard from "@/components/AuthCard";
import OtpInput from "@/components/OtpInput";
import { Alert } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { OtpResponse } from "@/lib/types";

export default function ForgotPasswordPage() {
  const [target, setTarget] = useState("");
  const [sent, setSent] = useState<OtpResponse | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const request = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      setSent(await api<OtpResponse>("/auth/forgot-password", { method: "POST", body: { target } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/reset-password", { method: "POST", body: { target: sent!.target, code, password } });
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Reset your password">
      {done ? (
        <div className="space-y-4">
          <Alert kind="success">Your password has been updated.</Alert>
          <Link href="/login" className="btn-primary w-full">Log in</Link>
        </div>
      ) : !sent ? (
        <form onSubmit={request} className="space-y-4">
          <div>
            <label className="label">Phone or email</label>
            <input className="input" value={target} onChange={(e) => setTarget(e.target.value)} required />
          </div>
          {error && <Alert>{error}</Alert>}
          <button className="btn-primary w-full" disabled={busy}>Send reset code</button>
        </form>
      ) : (
        <form onSubmit={reset} className="space-y-4">
          <p className="text-sm text-gray-600">{sent.message}</p>
          <OtpInput value={code} onChange={setCode} devCode={sent.dev_code} onResend={() => request()} />
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <Alert>{error}</Alert>}
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>Update password</button>
        </form>
      )}
    </AuthCard>
  );
}
