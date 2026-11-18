import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { ListingCard, Loading, styles } from "../../components/ui";
import { api } from "../../lib/api";
import { categoryIcon, COLORS } from "../../lib/format";
import type { Category, Listing, Paged } from "../../lib/types";

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [items, setItems] = useState<Listing[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: number) => {
    const r = await api<Paged<Listing>>(`/listings?page=${p}&limit=20`);
    setItems((prev) => (p === 1 ? r.items : [...prev, ...r.items]));
    setPage(r.page);
    setPages(r.pages);
  }, []);

  useEffect(() => {
    api<Category[]>("/categories").then(setCats).catch(() => {});
    load(1).finally(() => setLoading(false));
  }, [load]);

  const header = (
    <View>
      <View style={{ padding: 10 }}>
        <TextInput
          style={styles.input}
          placeholder="Search cars, phones, houses..."
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
          onSubmitEditing={() => router.push({ pathname: "/search", params: { q } })}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 6 }}>
        {cats.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => router.push({ pathname: "/search", params: { category: c.slug, title: c.name } })}
            style={{ width: 84, alignItems: "center", padding: 6 }}
          >
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.brandLight, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 26 }}>{categoryIcon(c.icon)}</Text>
            </View>
            <Text numberOfLines={2} style={{ fontSize: 11, textAlign: "center", marginTop: 4 }}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={[styles.h2, { marginHorizontal: 10, marginTop: 10 }]}>Fresh recommendations</Text>
    </View>
  );

  return (
    <FlatList
      style={styles.screen}
      data={items}
      numColumns={2}
      keyExtractor={(l) => String(l.id)}
      renderItem={({ item }) => <ListingCard item={item} />}
      contentContainerStyle={{ paddingHorizontal: 5, paddingBottom: 20 }}
      ListHeaderComponent={header}
      ListEmptyComponent={loading ? <Loading /> : <Text style={{ textAlign: "center", color: COLORS.muted, padding: 30 }}>No ads yet.</Text>}
      onEndReached={() => page < pages && load(page + 1)}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load(1).catch(() => {});
            setRefreshing(false);
          }}
        />
      }
    />
  );
}
