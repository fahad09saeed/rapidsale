import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, Pressable, RefreshControl, Text, View } from "react-native";
import LoginPrompt from "../../components/LoginPrompt";
import { Loading, styles } from "../../components/ui";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { COLORS, timeAgo } from "../../lib/format";
import type { Conversation } from "../../lib/types";

export default function Chats() {
  const { user, subscribe } = useAuth();
  const router = useRouter();
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => api<Conversation[]>("/conversations").then(setConvs).catch(() => setConvs([])), []);
  useFocusEffect(
    useCallback(() => {
      if (user) load();
    }, [user, load]),
  );
  useEffect(() => subscribe((ev) => ev.type === "message" && load()), [subscribe, load]);

  if (!user) return <LoginPrompt message="Log in to chat with buyers and sellers." />;
  if (!convs) return <Loading />;

  return (
    <FlatList
      style={styles.screen}
      data={convs}
      keyExtractor={(c) => String(c.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      ListEmptyComponent={<Text style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>No conversations yet.</Text>}
      renderItem={({ item: c }) => (
        <Pressable onPress={() => router.push(`/chat/${c.id}`)} style={{ flexDirection: "row", padding: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: COLORS.border, gap: 12 }}>
          {c.listing?.image ? (
            <Image source={{ uri: c.listing.image }} style={{ width: 54, height: 54, borderRadius: 8 }} />
          ) : (
            <View style={{ width: 54, height: 54, borderRadius: 8, backgroundColor: "#e5e7eb" }} />
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontWeight: "700" }}>{c.other_user.name}{c.other_user.online ? " 🟢" : ""}</Text>
              <Text style={styles.meta}>{timeAgo(c.last_message_at)}</Text>
            </View>
            <Text numberOfLines={1} style={styles.meta}>{c.listing?.title}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text numberOfLines={1} style={{ flex: 1, fontWeight: c.unread ? "700" : "400" }}>{c.last_message}</Text>
              {c.unread > 0 && (
                <Text style={{ backgroundColor: COLORS.brand, color: "#fff", borderRadius: 10, paddingHorizontal: 7, fontSize: 12, overflow: "hidden" }}>{c.unread}</Text>
              )}
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}
