import { useRouter } from "expo-router";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { COLORS, formatPrice, timeAgo } from "../lib/format";
import type { Listing } from "../lib/types";

export function Button({
  title, onPress, variant = "primary", disabled, style,
}: { title: string; onPress: () => void; variant?: "primary" | "outline" | "danger"; disabled?: boolean; style?: ViewStyle }) {
  const bg = variant === "primary" ? COLORS.brand : variant === "danger" ? COLORS.danger : "#fff";
  const fg = variant === "outline" ? COLORS.text : "#fff";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        variant === "outline" && { borderWidth: 1, borderColor: COLORS.border },
        style,
      ]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

export function Input({ label, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput placeholderTextColor="#9ca3af" {...props} style={[styles.input, props.multiline && { minHeight: 100, textAlignVertical: "top" }, props.style]} />
    </View>
  );
}

export function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Loading() {
  return (
    <View style={{ padding: 32, alignItems: "center" }}>
      <ActivityIndicator color={COLORS.brand} />
    </View>
  );
}

export function ListingCard({ item }: { item: Listing }) {
  const router = useRouter();
  return (
    <Pressable style={styles.card} onPress={() => router.push(`/listing/${item.id}`)}>
      <View>
        {item.images[0] ? (
          <Image source={{ uri: item.images[0].url }} style={styles.cardImg} />
        ) : (
          <View style={[styles.cardImg, { alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ color: COLORS.muted }}>No image</Text>
          </View>
        )}
        {item.is_featured && <Text style={styles.featured}>FEATURED</Text>}
      </View>
      <View style={{ padding: 8 }}>
        <Text style={styles.price}>{formatPrice(item.price)}</Text>
        <Text numberOfLines={2} style={{ color: COLORS.text, minHeight: 34 }}>{item.title}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text numberOfLines={1} style={styles.meta}>{item.location?.name}</Text>
          <Text style={styles.meta}>{timeAgo(item.created_at)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.bg },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnText: { fontWeight: "700", fontSize: 15 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 4 },
  input: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: COLORS.text },
  error: { color: COLORS.danger, backgroundColor: "#fef2f2", padding: 10, borderRadius: 8, marginBottom: 12 },
  card: { flex: 1, margin: 5, backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: COLORS.border },
  cardImg: { width: "100%", aspectRatio: 4 / 3, backgroundColor: "#e5e7eb" },
  featured: { position: "absolute", top: 6, left: 6, backgroundColor: COLORS.accent, paddingHorizontal: 6, borderRadius: 4, fontSize: 10, fontWeight: "800", overflow: "hidden" },
  price: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  meta: { fontSize: 11, color: COLORS.muted, flexShrink: 1 },
  section: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  h1: { fontSize: 22, fontWeight: "800", color: COLORS.text, marginBottom: 12 },
  h2: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#fff", marginRight: 6, marginBottom: 6 },
  chipActive: { backgroundColor: COLORS.brand, borderColor: COLORS.brand },
});
