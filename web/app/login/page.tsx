"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AuthCard from "@/components/AuthCard";
import { useAuth } from "@/components/AuthProvider";
import OtpInput from "@/components/OtpInput";
import { Alert } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { AuthResponse, OtpResponse } from "@/lib/types";

function LoginForm() {
  const { setSession } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState<OtpResponse | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const done = (r: AuthResponse) => {
    setSession(r);
    router.replace(next.startsWith("/") ? next : "/");
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      done(await api<AuthResponse>("/auth/login", { method: "POST", body: { identifier, password } }));
    } catch (err) {
      if (err instanceof ApiError && err.code === "unverified") {
        const target = String(err.data.target);
        await api("/auth/resend-otp", { method: "POST", body: { target, purpose: "register" } }).catch(() => {});
        router.push(`/verify?target=${encodeURIComponent(target)}`);
        return;
      }
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const requestOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      setOtpSent(await api<OtpResponse>("/auth/otp-login/request", { method: "POST", body: { target: identifier } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      done(await api<AuthResponse>("/auth/otp-login/verify", { method: "POST", body: { target: otpSent!.target, code } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard title="Welcome back" subtitle="Log in with your phone number or email">
      <div className="mb-5 grid grid-cols-2 rounded-lg bg-gray-100 p-1 text-sm font-semibold">
        {(["password", "otp"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError("");
              setOtpSent(null);
            }}
            className={`rounded-md py-2 ${mode === m ? "bg-white shadow" : "text-gray-500"}`}
          >
            {m === "password" ? "Password" : "One-time code"}
          </button>
        ))}
      </div>

      {mode === "password" ? (
        <form onSubmit={submitPassword} className="space-y-4">
          <div>
            <label className="label">Phone or email</label>
            <input className="input" placeholder="03XXXXXXXXX or you@example.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <Alert>{error}</Alert>}
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Logging in..." : "Log in"}</button>
          <p className="text-right text-sm">
            <Link href="/forgot-password" className="text-brand-700 hover:underline">Forgot password?</Link>
          </p>
        </form>
      ) : !otpSent ? (
        <form onSubmit={requestOtp} className="space-y-4">
          <div>
            <label className="label">Phone or email</label>
            <input className="input" placeholder="03XXXXXXXXX or you@example.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
          </div>
          {error && <Alert>{error}</Alert>}
          <button className="btn-primary w-full" disabled={busy}>Send code</button>
        </form>
      ) : (
        <form onSubmit={verifyOtp} className="space-y-4">
          <p className="text-sm text-gray-600">We sent a code to <b>{otpSent.target}</b>.</p>
          <OtpInput value={code} onChange={setCode} devCode={otpSent.dev_code} onResend={() => requestOtp()} />
          {error && <Alert>{error}</Alert>}
          <button className="btn-primary w-full" disabled={busy || code.length !== 6}>Verify & log in</button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-gray-600">
        New here? <Link href="/register" className="font-semibold text-brand-700 hover:underline">Create an account</Link>
      </p>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
