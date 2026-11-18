import { useRouter } from "expo-router";
import { Text, View } from "react-native";
import { COLORS } from "../lib/format";
import { Button } from "./ui";

export default function LoginPrompt({ message }: { message: string }) {
  const router = useRouter();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 30, backgroundColor: COLORS.bg }}>
      <Text style={{ fontSize: 48 }}>🔐</Text>
      <Text style={{ fontSize: 16, textAlign: "center", marginVertical: 16, color: COLORS.text }}>{message}</Text>
      <Button title="Log in" onPress={() => router.push("/login")} style={{ alignSelf: "stretch" }} />
      <Button title="Create account" variant="outline" onPress={() => router.push("/register")} style={{ alignSelf: "stretch", marginTop: 10 }} />
    </View>
  );
}
