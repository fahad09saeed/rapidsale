import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Loading, styles } from "../../components/ui";
import { api, errorMessage, uploadImage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { COLORS, formatPrice } from "../../lib/format";
import type { Conversation, Message } from "../../lib/types";

export default function ChatThread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const convId = Number(id);
  const { user, subscribe, sendSocket, refreshUnread } = useAuth();
  const insets = useSafeAreaInsets();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<FlatList<Message>>(null);
  const lastTyping = useRef(0);

  const markRead = useCallback(() => {
    api(`/conversations/${convId}/read`, { method: "POST" }).then(refreshUnread).catch(() => {});
  }, [convId, refreshUnread]);

  useEffect(() => {
    api<Conversation>(`/conversations/${convId}`).then(setConv).catch((e) => setError(errorMessage(e)));
    api<{ items: Message[] }>(`/conversations/${convId}/messages`).then((r) => setMessages(r.items));
    markRead();
  }, [convId, markRead]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const off = subscribe((ev) => {
      if (ev.data?.conversation_id !== convId) return;
      if (ev.type === "message") {
        const m = ev.data as Message;
        setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
        setTyping(false);
        if (m.sender_id !== user?.id) markRead();
      } else if (ev.type === "read") {
        setMessages((l) => l.map((m) => (m.sender_id === user?.id && !m.read_at ? { ...m, read_at: ev.data.read_at } : m)));
      } else if (ev.type === "typing") {
        setTyping(true);
        clearTimeout(t);
        t = setTimeout(() => setTyping(false), 3000);
      }
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, [convId, subscribe, user, markRead]);

  const send = async (body: string, image_url = "") => {
    setError("");
    try {
      const m = await api<Message>(`/conversations/${convId}/messages`, { method: "POST", body: { body, image_url } });
      setMessages((l) => (l.some((x) => x.id === m.id) ? l : [...l, m]));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const sendPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (r.canceled || !r.assets[0]) return;
    try {
      send("", await uploadImage(r.assets[0].uri, r.assets[0].mimeType ?? "image/jpeg", "chat"));
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  if (!conv) return error ? <Text style={styles.error}>{error}</Text> : <Loading />;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: conv.other_user.name, headerRight: () => <Text style={styles.meta}>{typing ? "typing..." : conv.other_user.online ? "Online" : ""}</Text> }} />
      {conv.listing && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 8, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: COLORS.border }}>
          {!!conv.listing.image && <Image source={{ uri: conv.listing.image }} style={{ width: 40, height: 40, borderRadius: 6 }} />}
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1}>{conv.listing.title}</Text>
            <Text style={{ fontWeight: "700" }}>{formatPrice(conv.listing.price)}</Text>
          </View>
        </View>
      )}
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(m) => String(m.id)}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        renderItem={({ item: m }) => {
          const mine = m.sender_id === user?.id;
          return (
            <View style={{ alignItems: mine ? "flex-end" : "flex-start", marginBottom: 6 }}>
              <View style={{ maxWidth: "78%", padding: 10, borderRadius: 16, backgroundColor: mine ? COLORS.brand : "#fff" }}>
                {!!m.image_url && <Image source={{ uri: m.image_url }} style={{ width: 200, height: 150, borderRadius: 10, marginBottom: 4 }} />}
                {!!m.body && <Text style={{ color: mine ? "#fff" : COLORS.text }}>{m.body}</Text>}
                <Text style={{ fontSize: 10, textAlign: "right", color: mine ? "#d5f5e8" : COLORS.muted, marginTop: 2 }}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  {mine ? (m.read_at ? " ✓✓" : " ✓") : ""}
                </Text>
              </View>
            </View>
          );
        }}
      />
      {!!error && <Text style={[styles.error, { marginHorizontal: 10 }]}>{error}</Text>}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: 8, paddingBottom: 8 + insets.bottom, backgroundColor: "#fff", borderTopWidth: 1, borderColor: COLORS.border }}>
        <Pressable onPress={sendPhoto}><Text style={{ fontSize: 24 }}>📷</Text></Pressable>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Type a message"
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (Date.now() - lastTyping.current > 2000) {
              sendSocket({ type: "typing", conversation_id: convId });
              lastTyping.current = Date.now();
            }
          }}
          multiline
        />
        <Pressable
          onPress={() => {
            if (!text.trim()) return;
            send(text);
            setText("");
          }}
          style={{ backgroundColor: COLORS.brand, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
