import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, Text } from "react-native";
import { Button, ErrorText, Input, styles } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import type { OtpResponse } from "../lib/types";

export default function Register() {
  const router = useRouter();
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    if (!f.phone && !f.email) return setError("Enter a phone number or an email");
    setBusy(true);
    try {
      const r = await api<OtpResponse>("/auth/register", {
        method: "POST",
        body: { name: f.name, phone: f.phone || undefined, email: f.email || undefined, password: f.password },
      });
      router.push({ pathname: "/verify", params: { target: r.target, dev: r.dev_code ?? "" } });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <Text style={styles.h1}>Create your account</Text>
      <Input label="Full name" value={f.name} onChangeText={(name) => setF({ ...f, name })} />
      <Input label="Mobile number" placeholder="03XXXXXXXXX" keyboardType="phone-pad" value={f.phone} onChangeText={(phone) => setF({ ...f, phone })} />
      <Input label="Email (optional)" autoCapitalize="none" keyboardType="email-address" value={f.email} onChangeText={(email) => setF({ ...f, email })} />
      <Input label="Password (min 8 characters)" secureTextEntry value={f.password} onChangeText={(password) => setF({ ...f, password })} />
      <ErrorText>{error}</ErrorText>
      <Button title={busy ? "Creating..." : "Create account"} disabled={busy} onPress={submit} />
    </ScrollView>
  );
}
