import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Image, Pressable, RefreshControl, Text, View } from "react-native";
import LoginPrompt from "../../components/LoginPrompt";
import { Loading, styles } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { COLORS, formatPrice, timeAgo } from "../../lib/format";
import type { Listing, Paged } from "../../lib/types";

type Row = Listing & { chats: number; likes: number };

const STATUS_COLOR: Record<string, string> = {
  active: "#047857", pending: "#b45309", rejected: "#dc2626", sold: "#0369a1", expired: "#6b7280", inactive: "#6b7280",
};

export default function MyAds() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Row[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api<Paged<Row>>("/me/listings?limit=50").then((r) => setItems(r.items)).catch(() => setItems([])), []);
  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [user, load]),
  );

  if (!user) return <LoginPrompt message="Log in to manage your ads." />;
  if (!items) return <Loading />;

  const actions = (l: Row) => {
    const act = (body: { status: string } | null) => async () => {
      try {
        if (body) await api(`/listings/${l.id}/status`, { method: "PATCH", body });
        else await api(`/listings/${l.id}`, { method: "DELETE" });
        load();
      } catch (e) {
        Alert.alert("Error", errorMessage(e));
      }
    };
    const buttons: { text: string; onPress?: () => void; style?: "cancel" | "destructive" }[] = [];
    if (l.status === "active") {
      buttons.push({ text: "Mark as sold", onPress: act({ status: "sold" }) });
      buttons.push({ text: "Deactivate", onPress: act({ status: "inactive" }) });
    }
    if (["inactive", "expired", "sold"].includes(l.status)) buttons.push({ text: "Republish", onPress: act({ status: "active" }) });
    buttons.push({ text: "Delete", style: "destructive", onPress: act(null) });
    buttons.push({ text: "Cancel", style: "cancel" });
    Alert.alert(l.title, undefined, buttons);
  };

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(l) => String(l.id)}
      contentContainerStyle={{ padding: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListEmptyComponent={<Text style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>You haven't posted any ads yet.</Text>}
      renderItem={({ item: l }) => (
        <Pressable onPress={() => router.push(`/listing/${l.id}`)} onLongPress={() => actions(l)} style={[styles.section, { flexDirection: "row", gap: 10, padding: 10 }]}>
          {l.images[0] ? <Image source={{ uri: l.images[0].url }} style={{ width: 80, height: 80, borderRadius: 8 }} /> : <View style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: "#e5e7eb" }} />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: STATUS_COLOR[l.status], fontWeight: "700", textTransform: "uppercase", fontSize: 11 }}>{l.status}</Text>
            <Text numberOfLines={1} style={{ fontWeight: "600" }}>{l.title}</Text>
            <Text style={{ fontWeight: "800" }}>{formatPrice(l.price)}</Text>
            <Text style={styles.meta}>{timeAgo(l.created_at)} · 👁 {l.views} · ❤️ {l.likes} · 💬 {l.chats}</Text>
            {l.status === "rejected" && !!l.reject_reason && <Text style={{ color: COLORS.danger, fontSize: 12 }}>{l.reject_reason}</Text>}
          </View>
          <Pressable onPress={() => actions(l)} hitSlop={10}><Text style={{ fontSize: 20 }}>⋮</Text></Pressable>
        </Pressable>
      )}
    />
  );
}
