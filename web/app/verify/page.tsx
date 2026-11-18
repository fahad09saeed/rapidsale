"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AuthCard from "@/components/AuthCard";
import { useAuth } from "@/components/AuthProvider";
import OtpInput from "@/components/OtpInput";
import { Alert } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { AuthResponse, OtpResponse } from "@/lib/types";

function VerifyForm() {
  const params = useSearchParams();
  const router = useRouter();
  const { setSession } = useAuth();
  const target = params.get("target") ?? "";
  const [devCode, setDevCode] = useState(params.get("dev") ?? undefined);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      setSession(await api<AuthResponse>("/auth/verify", { method: "POST", body: { target, code } }));
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError("");
    try {
      const r = await api<OtpResponse>("/auth/resend-otp", { method: "POST", body: { target, purpose: "register" } });
      setDevCode(r.dev_code);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthCard title="Verify your account" subtitle={`Enter the 6-digit code sent to ${target}`}>
      <form onSubmit={submit} className="space-y-4">
        <OtpInput value={code} onChange={setCode} onResend={resend} devCode={devCode} />
        {error && <Alert>{error}</Alert>}
        <button className="btn-primary w-full" disabled={busy || code.length !== 6}>Verify</button>
      </form>
    </AuthCard>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
