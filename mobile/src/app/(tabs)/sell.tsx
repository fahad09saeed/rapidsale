import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Switch, Text, View } from "react-native";
import LoginPrompt from "../../components/LoginPrompt";
import { Button, ErrorText, Input, styles } from "../../components/ui";
import { api, errorMessage, uploadImage } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { categoryIcon, COLORS } from "../../lib/format";
import type { Category, CategoryAttribute, Listing, Location } from "../../lib/types";

/** Simple inline picker: tappable chips (works the same on iOS and Android without extra deps). */
function ChipPicker<T extends { id: number | string; label: string }>({ items, value, onChange }: { items: T[]; value?: T["id"]; onChange: (id: T["id"]) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
      {items.map((it) => (
        <Pressable key={String(it.id)} onPress={() => onChange(it.id)} style={[styles.chip, value === it.id && styles.chipActive]}>
          <Text style={{ fontSize: 13, color: value === it.id ? "#fff" : COLORS.text }}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function Sell() {
  const { user } = useAuth();
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>([]);
  const [locs, setLocs] = useState<Location[]>([]);
  const [root, setRoot] = useState<Category | null>(null);
  const [cat, setCat] = useState<Category | null>(null);
  const [defs, setDefs] = useState<CategoryAttribute[]>([]);
  const [attrs, setAttrs] = useState<Record<string, string | boolean>>({});
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [negotiable, setNegotiable] = useState(false);
  const [condition, setCondition] = useState("used");
  const [province, setProvince] = useState<Location | null>(null);
  const [city, setCity] = useState<Location | null>(null);
  const [area, setArea] = useState<Location | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(0);
  const [showPhone, setShowPhone] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Category[]>("/categories").then(setCats).catch(() => {});
    api<Location[]>("/locations").then(setLocs).catch(() => {});
  }, []);

  useEffect(() => {
    if (!cat) return;
    api<{ category: Category }>(`/categories/${cat.slug}`).then((r) => {
      setDefs(r.category.attributes ?? []);
      setAttrs({});
    });
  }, [cat]);

  if (!user) return <LoginPrompt message="Log in to post an ad and reach thousands of buyers." />;

  const pickImages = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsMultipleSelection: true, selectionLimit: 12 - images.length, quality: 0.7 });
    if (r.canceled) return;
    setUploading((n) => n + r.assets.length);
    for (const a of r.assets) {
      try {
        const url = await uploadImage(a.uri, a.mimeType ?? "image/jpeg");
        setImages((l) => [...l, url]);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const reset = () => {
    setCat(null); setRoot(null); setTitle(""); setDescription(""); setPrice(""); setImages([]); setAttrs({});
  };

  const submit = async () => {
    if (!cat) return;
    const loc = area ?? city;
    if (!loc) return setError("Please choose a city");
    setBusy(true);
    setError("");
    const attributes: Record<string, unknown> = {};
    for (const d of defs) {
      const v = attrs[d.key];
      if (v === undefined || v === "") continue;
      attributes[d.key] = d.type === "number" ? Number(v) : v;
    }
    try {
      const l = await api<Listing>("/listings", {
        method: "POST",
        body: {
          category_id: cat.id, location_id: loc.id, title, description, price: Number(price || 0), negotiable,
          condition: ["jobs", "services", "property-for-sale", "property-for-rent", "animals"].includes(root?.slug ?? "") ? "" : condition,
          attributes, images, contact_name: user.name, contact_phone: user.phone ?? "", show_phone: showPhone,
        },
      });
      reset();
      router.push(`/listing/${l.id}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!cat) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 12 }}>
        <Text style={styles.h1}>{root ? root.name : "What are you selling?"}</Text>
        {root && <Button title="‹ All categories" variant="outline" onPress={() => setRoot(null)} style={{ marginBottom: 10 }} />}
        {(root ? root.children ?? [] : cats).map((c) => (
          <Pressable
            key={c.id}
            onPress={() => (c.children?.length ? setRoot(c) : setCat(c))}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderRadius: 10, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border }}
          >
            {!root && <Text style={{ fontSize: 24 }}>{categoryIcon(c.icon)}</Text>}
            <Text style={{ flex: 1, fontSize: 15 }}>{c.name}</Text>
            <Text style={{ color: COLORS.muted }}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ padding: 12 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.section, { flexDirection: "row", justifyContent: "space-between" }]}>
        <Text style={{ fontWeight: "700", flex: 1 }}>{root?.name} › {cat.name}</Text>
        <Pressable onPress={() => setCat(null)}><Text style={{ color: COLORS.brand }}>Change</Text></Pressable>
      </View>
      <ErrorText>{error}</ErrorText>

      <View style={styles.section}>
        <Text style={styles.h2}>Photos ({images.length}/12)</Text>
        <ScrollView horizontal>
          {images.map((u, i) => (
            <Pressable key={u} onLongPress={() => setImages(images.filter((_, j) => j !== i))}>
              <Image source={{ uri: u }} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 6 }} />
            </Pressable>
          ))}
          {images.length < 12 && (
            <Pressable onPress={pickImages} style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderStyle: "dashed", borderColor: COLORS.border, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 12, color: COLORS.muted }}>{uploading ? `Uploading ${uploading}` : "+ Add"}</Text>
            </Pressable>
          )}
        </ScrollView>
        <Text style={[styles.meta, { marginTop: 6 }]}>Long-press a photo to remove it. The first photo is the cover.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.h2}>Details</Text>
        <Text style={styles.label}>Condition</Text>
        <ChipPicker items={[{ id: "new", label: "New" }, { id: "used", label: "Used" }, { id: "refurbished", label: "Refurbished" }]} value={condition} onChange={(v) => setCondition(String(v))} />
        {defs.map((d) => (
          <View key={d.key} style={{ marginTop: 10 }}>
            {d.type === "select" ? (
              <>
                <Text style={styles.label}>{d.label}{d.required ? " *" : ""}</Text>
                <ChipPicker items={(d.options ?? []).map((o) => ({ id: o, label: o }))} value={String(attrs[d.key] ?? "")} onChange={(v) => setAttrs({ ...attrs, [d.key]: String(v) })} />
              </>
            ) : d.type === "boolean" ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.label}>{d.label}</Text>
                <Switch value={Boolean(attrs[d.key])} onValueChange={(v) => setAttrs({ ...attrs, [d.key]: v })} />
              </View>
            ) : (
              <Input
                label={`${d.label}${d.unit ? ` (${d.unit})` : ""}${d.required ? " *" : ""}`}
                keyboardType={d.type === "number" ? "numeric" : "default"}
                value={String(attrs[d.key] ?? "")}
                onChangeText={(v) => setAttrs({ ...attrs, [d.key]: v })}
              />
            )}
          </View>
        ))}
        <View style={{ marginTop: 10 }}>
          <Input label="Ad title *" value={title} onChangeText={setTitle} maxLength={150} />
          <Input label="Description *" value={description} onChangeText={setDescription} multiline maxLength={5000} />
        </View>
      </View>

      <View style={styles.section}>
        <Input label="Price (Rs)" keyboardType="numeric" value={price} onChangeText={(v) => setPrice(v.replace(/\D/g, ""))} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text>Negotiable</Text>
          <Switch value={negotiable} onValueChange={setNegotiable} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.h2}>Location *</Text>
        <ChipPicker items={locs.map((l) => ({ id: l.id, label: l.name }))} value={province?.id} onChange={(id) => { setProvince(locs.find((l) => l.id === id) ?? null); setCity(null); setArea(null); }} />
        {province && (
          <>
            <Text style={[styles.label, { marginTop: 8 }]}>City</Text>
            <ChipPicker items={(province.children ?? []).map((l) => ({ id: l.id, label: l.name }))} value={city?.id} onChange={(id) => { setCity(province.children?.find((l) => l.id === id) ?? null); setArea(null); }} />
          </>
        )}
        {!!city?.children?.length && (
          <>
            <Text style={[styles.label, { marginTop: 8 }]}>Area (optional)</Text>
            <ChipPicker items={city.children.map((l) => ({ id: l.id, label: l.name }))} value={area?.id} onChange={(id) => setArea(city.children?.find((l) => l.id === id) ?? null)} />
          </>
        )}
      </View>

      <View style={[styles.section, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
        <Text>Show my phone number ({user.phone ?? "none"})</Text>
        <Switch value={showPhone} onValueChange={setShowPhone} />
      </View>

      <Button title={busy ? "Posting..." : "Post now"} disabled={busy || uploading > 0} onPress={submit} style={{ marginBottom: 30 }} />
    </ScrollView>
  );
}
