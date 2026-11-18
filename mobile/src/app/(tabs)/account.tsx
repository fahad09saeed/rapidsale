import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View } from "react-native";
import LoginPrompt from "../../components/LoginPrompt";
import { Button, ErrorText, Input, styles } from "../../components/ui";
import { api, errorMessage, uploadImage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { COLORS } from "../../lib/format";

export default function Account() {
  const { user, logout, reloadUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [avatar, setAvatar] = useState("");
  const [pw, setPw] = useState({ current_password: "", new_password: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name);
      setAbout(user.about);
      setAvatar(user.avatar_url);
    }
  }, [user]);

  if (!user) return <LoginPrompt message="Log in to manage your profile." />;

  const run = async (fn: () => Promise<void>, ok: string) => {
    setError("");
    try {
      await fn();
      Alert.alert("Saved", ok);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const pickAvatar = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (r.canceled || !r.assets[0]) return;
    try {
      setAvatar(await uploadImage(r.assets[0].uri, r.assets[0].mimeType ?? "image/jpeg", "avatars"));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.section, { alignItems: "center" }]}>
        <Pressable onPress={pickAvatar}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={{ width: 88, height: 88, borderRadius: 44 }} />
          ) : (
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: COLORS.brand, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 36, fontWeight: "800" }}>{user.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "800", marginTop: 8 }}>{user.name}</Text>
        <Text style={styles.meta}>{user.phone ?? user.email} · {user.role_name}</Text>
      </View>

      <ErrorText>{error}</ErrorText>

      <View style={styles.section}>
        <Text style={styles.h2}>Profile</Text>
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="About" value={about} onChangeText={setAbout} multiline />
        <Button
          title="Save profile"
          onPress={() => run(async () => {
            await api("/me", { method: "PUT", body: { name, about, avatar_url: avatar, location_id: user.location_id } });
            await reloadUser();
          }, "Profile updated")}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.h2}>Change password</Text>
        <Input label="Current password" secureTextEntry value={pw.current_password} onChangeText={(v) => setPw({ ...pw, current_password: v })} />
        <Input label="New password" secureTextEntry value={pw.new_password} onChangeText={(v) => setPw({ ...pw, new_password: v })} />
        <Button
          title="Update password"
          variant="outline"
          onPress={() => run(async () => {
            await api("/me/password", { method: "PUT", body: pw });
            setPw({ current_password: "", new_password: "" });
          }, "Password changed")}
        />
      </View>

      <Button
        title="Log out"
        variant="danger"
        onPress={async () => {
          await logout();
          router.replace("/");
        }}
        style={{ marginBottom: 30 }}
      />
    </ScrollView>
  );
}
