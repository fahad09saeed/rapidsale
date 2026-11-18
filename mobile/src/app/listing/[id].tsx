import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Dimensions, FlatList, Image, Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Button, ErrorText, Loading, styles } from "../../components/ui";
import { api, errorMessage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { attrValue, COLORS, formatPrice, timeAgo } from "../../lib/format";
import type { Conversation, ListingDetail } from "../../lib/types";

const W = Dimensions.get("window").width;

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [d, setD] = useState<ListingDetail | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("Hi, is this still available?");
  const [fav, setFav] = useState(false);

  useEffect(() => {
    api<ListingDetail>(`/listings/${id}`)
      .then((r) => {
        setD(r);
        setFav(r.listing.is_favorite);
      })
      .catch((e) => setError(errorMessage(e)));
  }, [id, user]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!d) return <Loading />;
  const l = d.listing;
  const isOwner = user?.id === l.user_id;

  const needLogin = () => {
    if (user) return false;
    router.push({ pathname: "/login", params: { next: `/listing/${id}` } });
    return true;
  };

  const chat = async () => {
    if (needLogin()) return;
    try {
      const r = await api<{ conversation: Conversation }>("/conversations", { method: "POST", body: { listing_id: l.id, body: msg } });
      router.push(`/chat/${r.conversation.id}`);
    } catch (e) {
      Alert.alert("Could not send", errorMessage(e));
    }
  };

  const toggleFav = async () => {
    if (needLogin()) return;
    const next = !fav;
    setFav(next);
    await api(`/listings/${l.id}/favorite`, { method: next ? "POST" : "DELETE" }).catch(() => setFav(!next));
  };

  const report = () => {
    if (needLogin()) return;
    const send = (reason: string) =>
      api("/reports", { method: "POST", body: { listing_id: l.id, reason } })
        .then(() => Alert.alert("Thanks", "Our team will review this ad."))
        .catch((e) => Alert.alert("Error", errorMessage(e)));
    Alert.alert("Report this ad", "Why are you reporting it?", [
      { text: "Fraud / scam", onPress: () => send("fraud") },
      { text: "Spam or duplicate", onPress: () => send("spam") },
      { text: "Offensive / prohibited", onPress: () => send("prohibited") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <ScrollView style={styles.screen}>
      <FlatList
        horizontal
        pagingEnabled
        data={l.images.length ? l.images : [{ id: 0, url: "", sort_order: 0 }]}
        keyExtractor={(i) => String(i.id)}
        renderItem={({ item }) =>
          item.url ? (
            <Image source={{ uri: item.url }} style={{ width: W, height: W * 0.75, backgroundColor: "#111" }} resizeMode="contain" />
          ) : (
            <View style={{ width: W, height: W * 0.5, backgroundColor: "#e5e7eb", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: COLORS.muted }}>No image</Text>
            </View>
          )
        }
      />
      <View style={{ padding: 12 }}>
        <View style={styles.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 24, fontWeight: "800" }}>{formatPrice(l.price)}</Text>
            <Pressable onPress={toggleFav}><Text style={{ fontSize: 24 }}>{fav ? "❤️" : "🤍"}</Text></Pressable>
          </View>
          {l.negotiable && <Text style={{ color: COLORS.brand, fontWeight: "600" }}>Negotiable</Text>}
          <Text style={{ fontSize: 17, marginVertical: 6 }}>{l.title}</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={styles.meta}>📍 {d.location_path.map((x) => x.name).reverse().join(", ")}</Text>
            <Text style={styles.meta}>{timeAgo(l.created_at)}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Details</Text>
          {l.condition ? <Row k="Condition" v={l.condition} /> : null}
          {d.attribute_defs.filter((a) => l.attributes?.[a.key] !== undefined).map((a) => (
            <Row key={a.key} k={a.label} v={attrValue(l.attributes[a.key], a.unit)} />
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Description</Text>
          <Text style={{ lineHeight: 21 }}>{l.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.h2}>Seller</Text>
          <Text style={{ fontWeight: "700" }}>{d.seller.name} {d.seller.verified ? "✅" : ""}</Text>
          <Text style={styles.meta}>{d.seller.online ? "Online now" : `Member since ${new Date(d.seller.created_at).getFullYear()}`} · {d.seller_listings} ads</Text>
        </View>

        {!isOwner && l.status === "active" && (
          <View style={styles.section}>
            <TextInput style={[styles.input, { marginBottom: 10 }]} value={msg} onChangeText={setMsg} multiline />
            <Button title="💬 Chat with seller" onPress={chat} disabled={!msg.trim()} />
            {l.has_phone && (
              <Button
                title={l.contact_phone ? `📞 Call ${l.contact_phone}` : "📞 Log in to see phone"}
                variant="outline"
                style={{ marginTop: 8 }}
                onPress={() => (l.contact_phone ? Linking.openURL(`tel:${l.contact_phone}`) : needLogin())}
              />
            )}
          </View>
        )}
        {!isOwner && (
          <Pressable onPress={report} style={{ padding: 12 }}>
            <Text style={{ color: COLORS.danger, textAlign: "center" }}>🚩 Report this ad</Text>
          </Pressable>
        )}
        <Text style={[styles.meta, { textAlign: "center", marginBottom: 20 }]}>Ad ID {l.id} · {l.views} views</Text>
      </View>
    </ScrollView>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderColor: "#f3f4f6" }}>
      <Text style={{ color: COLORS.muted }}>{k}</Text>
      <Text style={{ fontWeight: "600", textTransform: "capitalize" }}>{v}</Text>
    </View>
  );
}
