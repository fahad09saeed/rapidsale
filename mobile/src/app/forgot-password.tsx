import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { Button, ErrorText, Input, styles } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import type { OtpResponse } from "../lib/types";

export default function ForgotPassword() {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [sent, setSent] = useState<OtpResponse | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>Reset password</Text>
      {done ? (
        <>
          <Text style={{ marginBottom: 16 }}>Your password has been updated.</Text>
          <Button title="Log in" onPress={() => router.replace("/login")} />
        </>
      ) : !sent ? (
        <>
          <Input label="Phone or email" autoCapitalize="none" value={target} onChangeText={setTarget} />
          <ErrorText>{error}</ErrorText>
          <Button title="Send reset code" onPress={() => run(async () => setSent(await api<OtpResponse>("/auth/forgot-password", { method: "POST", body: { target } })))} />
        </>
      ) : (
        <>
          <Input label="Verification code" keyboardType="number-pad" maxLength={6} value={code} onChangeText={setCode} />
          {sent.dev_code && <Text style={{ color: "#b45309", marginBottom: 8 }}>Dev code: {sent.dev_code}</Text>}
          <Input label="New password" secureTextEntry value={password} onChangeText={setPassword} />
          <ErrorText>{error}</ErrorText>
          <Button
            title="Update password"
            disabled={code.length !== 6 || password.length < 8}
            onPress={() => run(async () => {
              await api("/auth/reset-password", { method: "POST", body: { target: sent.target, code, password } });
              setDone(true);
            })}
          />
        </>
      )}
    </ScrollView>
  );
}
