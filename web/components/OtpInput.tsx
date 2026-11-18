"use client";

import { useEffect, useState } from "react";

/** Six-digit code input with a resend countdown. */
export default function OtpInput({
  value,
  onChange,
  onResend,
  devCode,
}: {
  value: string;
  onChange: (v: string) => void;
  onResend: () => Promise<void>;
  devCode?: string;
}) {
  const [wait, setWait] = useState(60);
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  return (
    <div className="space-y-2">
      <label className="label" htmlFor="otp">Verification code</label>
      <input
        id="otp"
        className="input text-center text-2xl tracking-[0.6em]"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="••••••"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        autoFocus
      />
      {devCode && (
        <p className="text-xs text-amber-700">
          Development mode: your code is <b>{devCode}</b>
        </p>
      )}
      <div className="text-right text-sm">
        {wait > 0 ? (
          <span className="text-gray-500">Resend code in {wait}s</span>
        ) : (
          <button
            type="button"
            className="font-semibold text-brand-700 hover:underline"
            onClick={async () => {
              await onResend();
              setWait(60);
            }}
          >
            Resend code
          </button>
        )}
      </div>
    </div>
  );
}
