import { Stack, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { ListingCard, Loading, styles } from "../components/ui";
import { api } from "../lib/api";
import { COLORS } from "../lib/format";
import type { Category, Listing, Paged } from "../lib/types";

const SORTS: [string, string][] = [["", "Featured"], ["newest", "Newest"], ["price_asc", "Price ↑"], ["price_desc", "Price ↓"]];

export default function Search() {
  const params = useLocalSearchParams<{ q?: string; category?: string; title?: string }>();
  const [q, setQ] = useState(params.q ?? "");
  const [category, setCategory] = useState(params.category ?? "");
  const [subcats, setSubcats] = useState<Category[]>([]);
  const [sort, setSort] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [items, setItems] = useState<Listing[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const query = useCallback(
    (p: number) => {
      const s = new URLSearchParams({ page: String(p), limit: "20" });
      if (q) s.set("q", q);
      if (category) s.set("category", category);
      if (sort) s.set("sort", sort);
      if (minPrice) s.set("min_price", minPrice);
      if (maxPrice) s.set("max_price", maxPrice);
      return api<Paged<Listing>>(`/listings?${s}`).then((r) => {
        setItems((prev) => (p === 1 || !prev ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
        setPage(r.page);
        setPages(r.pages);
      });
    },
    [q, category, sort, minPrice, maxPrice],
  );

  useEffect(() => {
    setItems(null);
    query(1).catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, sort]);

  useEffect(() => {
    if (!category) return setSubcats([]);
    api<{ category: Category }>(`/categories/${category}`)
      .then((r) => r.category.children?.length && setSubcats(r.category.children))
      .catch(() => {});
  }, [category]);

  const apply = () => {
    setItems(null);
    query(1).catch(() => setItems([]));
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: params.title ?? "Search" }} />
      <View style={{ padding: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderColor: COLORS.border }}>
        <TextInput style={styles.input} placeholder="Search..." value={q} onChangeText={setQ} returnKeyType="search" onSubmitEditing={apply} />
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Min Rs" keyboardType="numeric" value={minPrice} onChangeText={setMinPrice} onSubmitEditing={apply} />
          <TextInput style={[styles.input, { flex: 1 }]} placeholder="Max Rs" keyboardType="numeric" value={maxPrice} onChangeText={setMaxPrice} onSubmitEditing={apply} />
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
          {SORTS.map(([v, l]) => (
            <Pressable key={v} onPress={() => setSort(v)} style={[styles.chip, sort === v && styles.chipActive]}>
              <Text style={{ color: sort === v ? "#fff" : COLORS.text, fontSize: 12 }}>{l}</Text>
            </Pressable>
          ))}
        </View>
        {subcats.length > 0 && (
          <FlatList
            horizontal
            data={subcats}
            keyExtractor={(c) => String(c.id)}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <Pressable onPress={() => setCategory(item.slug)} style={styles.chip}>
                <Text style={{ fontSize: 12 }}>{item.name}</Text>
              </Pressable>
            )}
          />
        )}
      </View>
      {!items ? (
        <Loading />
      ) : (
        <FlatList
          data={items}
          numColumns={2}
          keyExtractor={(l) => String(l.id)}
          renderItem={({ item }) => <ListingCard item={item} />}
          contentContainerStyle={{ padding: 5 }}
          ListHeaderComponent={<Text style={{ margin: 5, color: COLORS.muted }}>{total} ads found</Text>}
          ListEmptyComponent={<Text style={{ textAlign: "center", padding: 30, color: COLORS.muted }}>No ads match your search.</Text>}
          onEndReached={() => page < pages && query(page + 1)}
          onEndReachedThreshold={0.5}
        />
      )}
    </View>
  );
}
