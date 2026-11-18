import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Button, ErrorText, Input, styles } from "../components/ui";
import { api, ApiError, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import { COLORS } from "../lib/format";
import type { AuthResponse, OtpResponse } from "../lib/types";

export default function Login() {
  const router = useRouter();
  const { setSession } = useAuth();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState<OtpResponse | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const finish = async (r: AuthResponse) => {
    await setSession(r);
    if (next) router.replace(next as never);
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.code === "unverified") {
        const target = String(e.data.target);
        await api("/auth/resend-otp", { method: "POST", body: { target, purpose: "register" } }).catch(() => {});
        router.push({ pathname: "/verify", params: { target } });
        return;
      }
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.h1}>Welcome back</Text>
        <View style={{ flexDirection: "row", marginBottom: 16 }}>
          {(["password", "otp"] as const).map((m) => (
            <Pressable key={m} onPress={() => { setMode(m); setSent(null); setError(""); }} style={[styles.chip, mode === m && styles.chipActive]}>
              <Text style={{ color: mode === m ? "#fff" : COLORS.text }}>{m === "password" ? "Password" : "One-time code"}</Text>
            </Pressable>
          ))}
        </View>
        <Input label="Phone or email" placeholder="03XXXXXXXXX" autoCapitalize="none" value={identifier} onChangeText={setIdentifier} editable={!sent} />
        {mode === "password" ? (
          <>
            <Input label="Password" secureTextEntry value={password} onChangeText={setPassword} />
            <ErrorText>{error}</ErrorText>
            <Button title={busy ? "Logging in..." : "Log in"} disabled={busy} onPress={() => run(async () => finish(await api<AuthResponse>("/auth/login", { method: "POST", body: { identifier, password } })))} />
            <Link href="/forgot-password" style={{ color: COLORS.brand, marginTop: 14, textAlign: "right" }}>Forgot password?</Link>
          </>
        ) : !sent ? (
          <>
            <ErrorText>{error}</ErrorText>
            <Button title="Send code" disabled={busy} onPress={() => run(async () => setSent(await api<OtpResponse>("/auth/otp-login/request", { method: "POST", body: { target: identifier } })))} />
          </>
        ) : (
          <>
            <Input label={`Code sent to ${sent.target}`} keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
            {sent.dev_code && <Text style={{ color: "#b45309", marginBottom: 8 }}>Dev code: {sent.dev_code}</Text>}
            <ErrorText>{error}</ErrorText>
            <Button title="Verify & log in" disabled={busy || code.length !== 6} onPress={() => run(async () => finish(await api<AuthResponse>("/auth/otp-login/verify", { method: "POST", body: { target: sent.target, code } })))} />
          </>
        )}
        <Text style={{ textAlign: "center", marginTop: 24, color: COLORS.muted }}>
          New here? <Link href="/register" style={{ color: COLORS.brand, fontWeight: "700" }}>Create an account</Link>
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
