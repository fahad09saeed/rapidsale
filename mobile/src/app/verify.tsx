import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { Button, ErrorText, Input, styles } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";
import type { AuthResponse, OtpResponse } from "../lib/types";

export default function Verify() {
  const router = useRouter();
  const { setSession } = useAuth();
  const { target = "", dev } = useLocalSearchParams<{ target?: string; dev?: string }>();
  const [devCode, setDevCode] = useState(dev || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const verify = async () => {
    setError("");
    try {
      await setSession(await api<AuthResponse>("/auth/verify", { method: "POST", body: { target, code } }));
      router.dismissAll();
      router.replace("/");
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const resend = async () => {
    setError("");
    try {
      const r = await api<OtpResponse>("/auth/resend-otp", { method: "POST", body: { target, purpose: "register" } });
      setDevCode(r.dev_code ?? "");
      setInfo("A new code has been sent.");
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }}>
      <Text style={styles.h1}>Verify your account</Text>
      <Text style={{ marginBottom: 16 }}>Enter the 6-digit code sent to {target}</Text>
      <Input keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} style={{ fontSize: 24, letterSpacing: 8, textAlign: "center" }} />
      {!!devCode && <Text style={{ color: "#b45309", marginBottom: 8 }}>Dev code: {devCode}</Text>}
      {!!info && <Text style={{ color: "#047857", marginBottom: 8 }}>{info}</Text>}
      <ErrorText>{error}</ErrorText>
      <Button title="Verify" disabled={code.length !== 6} onPress={verify} />
      <Button title="Resend code" variant="outline" onPress={resend} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}
