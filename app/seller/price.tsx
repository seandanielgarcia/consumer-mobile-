import { useAction, useMutation } from "convex/react";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getPickedPhotos } from "../../src/lib/pickedPhotos";
import { useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors, fonts, spacing } from "../../src/theme";

type Draft = {
  uri: string;
  status: "loading" | "ready" | "failed";
  storageId?: Id<"_storage">;
  title: string;
  category: string;
  size: string;
  brand: string;
  condition: string;
  color: string;
  description: string;
  priceCents: number;
  suggestedPriceCents: number;
  aiGenerated: boolean;
};

type Preset = 1000 | 2000 | "ai" | null;

type DetailField = "brand" | "size" | "condition" | "color";

const DETAIL_PLACEHOLDERS: Record<DetailField, string> = {
  brand: "Brand",
  size: "Size",
  condition: "Condition",
  color: "Color",
};

const sizeRelevant = (d: Draft) => d.size.trim() !== "" || /cloth|shoe|apparel|wear/i.test(d.category);

const detailFields = (d: Draft): DetailField[] =>
  sizeRelevant(d) ? ["size", "brand", "condition", "color"] : ["brand", "condition", "color"];

const chipLabel = (d: Draft, field: DetailField) => {
  const value = d[field].trim();
  if (!value) return `+ ${DETAIL_PLACEHOLDERS[field].toLowerCase()}`;
  return field === "size" ? `Size ${value}` : value;
};

export default function SellerPrice() {
  const user = useCurrentUser();
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);
  const describePhoto = useAction(api.ai.describePhoto);
  const openWithItems = useMutation(api.garages.openWithItems);
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    getPickedPhotos().map((uri) => ({
      uri,
      status: "loading",
      title: "",
      category: "",
      size: "",
      brand: "",
      condition: "",
      color: "",
      description: "",
      priceCents: 0,
      suggestedPriceCents: 0,
      aiGenerated: false,
    })),
  );
  const [preset, setPreset] = useState<Preset>("ai");
  const [editing, setEditing] = useState<number | null>(null);
  const [editingChip, setEditingChip] = useState<{ index: number; field: DetailField } | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  useEffect(() => {
    drafts.forEach(async (draft, index) => {
      let storageId: Id<"_storage"> | undefined;
      try {
        const uploadUrl = await generateUploadUrl();
        const blob = await (await fetch(draft.uri)).blob();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": blob.type || "image/jpeg" },
          body: blob,
        });
        storageId = (await res.json()).storageId as Id<"_storage">;
        const listing = await describePhoto({ storageId });
        update(index, {
          status: "ready",
          storageId,
          title: listing.title,
          category: listing.category,
          size: listing.size ?? "",
          brand: listing.brand ?? "",
          condition: listing.condition,
          color: listing.color,
          description: listing.description,
          priceCents: listing.suggestedPriceCents,
          suggestedPriceCents: listing.suggestedPriceCents,
          aiGenerated: true,
        });
      } catch {
        update(index, { status: storageId ? "ready" : "failed", storageId });
      }
    });
  }, []);

  const applyPreset = (next: Exclude<Preset, null>) => {
    setPreset(next);
    setDrafts((prev) =>
      prev.map((d) => ({ ...d, priceCents: next === "ai" ? d.suggestedPriceCents : next })),
    );
  };

  const ready = drafts.length > 0 && drafts.every((d) => d.status !== "loading");
  const uploaded = drafts.filter((d) => d.status === "ready");
  const canOpen = ready && uploaded.length > 0 && uploaded.every((d) => d.title.trim() && d.priceCents > 0);

  const openGarage = async () => {
    if (!user) {
      router.push("/signin");
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Location is needed so buyers nearby can find your garage.");
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude });
      const { garageId, itemIds, firstOpen } = await openWithItems({
        ownerId: user.userId,
        neighborhood: place?.district ?? place?.subregion ?? "Nearby",
        lat: Math.round(coords.latitude * 100) / 100,
        lng: Math.round(coords.longitude * 100) / 100,
        items: uploaded.map((d) => ({
          storageId: d.storageId!,
          title: d.title.trim(),
          category: d.category.trim() || undefined,
          size: d.size.trim() || undefined,
          brand: d.brand.trim() || undefined,
          condition: d.condition.trim() || undefined,
          color: d.color.trim() || undefined,
          description: d.description.trim(),
          priceCents: d.priceCents,
          aiGenerated: d.aiGenerated,
        })),
      });
      router.replace({
        pathname: "/seller/open",
        params: { garageId, picked: itemIds.slice(0, 3).join(","), first: firstOpen ? "1" : "0" },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't open your garage. Try again.");
      setOpening(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
        <Text style={styles.backText}>← Back</Text>
      </Pressable>
      <Text style={styles.headline}>{"We wrote it.\nYou price it."}</Text>
      <Text style={styles.subhead}>Share a photo and set a price, we'll take care of the rest.</Text>
      {drafts.length >= 2 && (
        <View style={styles.pillRow}>
          <Text style={styles.pillLabel}>Set all to</Text>
          {([1000, 2000, "ai"] as const).map((option) => {
            const selected = preset === option;
            return (
              <Pressable
                key={option}
                onPress={() => applyPreset(option)}
                disabled={!ready}
                style={[styles.pill, selected && styles.pillSelected, !ready && styles.pillDisabled]}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                  {option === "ai" ? "Suggested" : `$${option / 100}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {drafts.map((draft, index) => (
          <View key={draft.uri} style={styles.card}>
            <Image source={{ uri: draft.uri }} style={styles.photo} contentFit="cover" />
            <View style={styles.cardBody}>
              {draft.status === "loading" ? (
                <View style={styles.loading}>
                  <ActivityIndicator color={colors.brand} />
                </View>
              ) : editing === index ? (
                <>
                  <TextInput
                    value={draft.title}
                    onChangeText={(title) => update(index, { title })}
                    placeholder="What is it?"
                    style={[styles.title, styles.input]}
                    autoFocus
                  />
                  <TextInput
                    value={draft.description}
                    onChangeText={(description) => update(index, { description })}
                    placeholder="What should buyers know?"
                    multiline
                    style={[styles.description, styles.input, styles.descriptionInput]}
                  />
                  <Pressable onPress={() => setEditing(null)} hitSlop={8} style={styles.done}>
                    <Text style={styles.doneText}>Done</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.textBlock}>
                  <Pressable onPress={() => setEditing(index)}>
                    <Text style={styles.title} numberOfLines={1}>
                      {draft.title || (draft.status === "failed" ? "Couldn't upload this one" : "Tap to add a title")}
                    </Text>
                  </Pressable>
                  {draft.status === "ready" && (
                    <View style={styles.chips}>
                      {detailFields(draft).map((field) =>
                        editingChip?.index === index && editingChip.field === field ? (
                          <TextInput
                            key={field}
                            value={draft[field]}
                            onChangeText={(value) => update(index, { [field]: value })}
                            onBlur={() => setEditingChip(null)}
                            onSubmitEditing={() => setEditingChip(null)}
                            placeholder={DETAIL_PLACEHOLDERS[field]}
                            placeholderTextColor={colors.muted}
                            returnKeyType="done"
                            autoFocus
                            style={[styles.chip, styles.chipInput]}
                          />
                        ) : (
                          <Pressable
                            key={field}
                            onPress={() => setEditingChip({ index, field })}
                            hitSlop={4}
                            style={[styles.chip, !draft[field].trim() && styles.chipEmpty]}
                          >
                            <Text style={[styles.chipText, !draft[field].trim() && styles.chipTextEmpty]}>
                              {chipLabel(draft, field)}
                            </Text>
                          </Pressable>
                        ),
                      )}
                    </View>
                  )}
                  <Pressable onPress={() => setEditing(index)}>
                    <Text style={styles.description} numberOfLines={2}>
                      {draft.description || "Tap to add a description"}
                    </Text>
                    {draft.aiGenerated && <Text style={styles.hint}>filled in from your photo · tap to edit</Text>}
                  </Pressable>
                </View>
              )}
            </View>
            <TextInput
              accessibilityLabel={`Price for ${draft.title || "item"}`}
              value={draft.priceCents > 0 ? `$${Math.round(draft.priceCents / 100)}` : "$"}
              onChangeText={(text) => {
                const dollars = parseInt(text.replace(/\D/g, ""), 10);
                setPreset(null);
                update(index, { priceCents: Number.isNaN(dollars) ? 0 : dollars * 100 });
              }}
              keyboardType="number-pad"
              style={styles.price}
              editable={draft.status !== "loading"}
            />
          </View>
        ))}
      </ScrollView>
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable
        onPress={openGarage}
        disabled={!canOpen || opening}
        style={[styles.cta, (!canOpen || opening) && styles.ctaDisabled]}
        accessibilityRole="button"
      >
        {opening ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.ctaText}>Open my garage</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingTop: 56,
    paddingHorizontal: spacing.sidePad,
    paddingBottom: 34,
    gap: 16,
  },
  back: { alignSelf: "flex-start" },
  backText: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  headline: { fontFamily: fonts.display, fontSize: 34, lineHeight: 34, letterSpacing: -1, color: colors.ink },
  subhead: { fontFamily: fonts.body, fontSize: 15, lineHeight: 20, color: colors.muted, marginTop: -6 },
  pillRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pillLabel: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  pill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    justifyContent: "center",
  },
  pillSelected: { backgroundColor: colors.ink },
  pillDisabled: { opacity: 0.5 },
  pillText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  pillTextSelected: { color: colors.cream },
  list: { flex: 1 },
  listContent: { gap: 10 },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 12, flexDirection: "row", gap: 12 },
  photo: { width: 72, height: 88, borderRadius: 10, backgroundColor: colors.line },
  cardBody: { flex: 1 },
  loading: { flex: 1, alignItems: "flex-start", justifyContent: "center" },
  textBlock: { gap: 4 },
  title: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  description: { fontFamily: fonts.body, fontSize: 13, lineHeight: 17.5, color: colors.muted },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  chip: {
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: colors.cream,
    justifyContent: "center",
  },
  chipEmpty: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: colors.line },
  chipInput: { minWidth: 72, borderWidth: 1, borderColor: colors.ink, backgroundColor: colors.white, fontFamily: fonts.medium, fontSize: 12, color: colors.ink, paddingVertical: 0 },
  chipText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  chipTextEmpty: { color: colors.muted },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, opacity: 0.8 },
  input: { padding: 0, marginBottom: 4 },
  descriptionInput: { minHeight: 36 },
  done: { alignSelf: "flex-start", minHeight: 28, justifyContent: "center" },
  doneText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.brand },
  price: {
    alignSelf: "center",
    width: 64,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tag,
    textAlign: "center",
    fontFamily: fonts.display,
    fontSize: 18,
    color: colors.ink,
  },
  error: { fontFamily: fonts.medium, fontSize: 14, color: "#B3261E", textAlign: "center" },
  cta: {
    height: spacing.cta,
    borderRadius: 30,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.cream },
});
