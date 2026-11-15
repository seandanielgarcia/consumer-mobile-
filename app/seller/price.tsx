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
  review: "pending" | "approved" | "removed";
  storageId?: Id<"_storage">;
  title: string;
  category: string;
  size: string;
  brand: string;
  condition: string;
  color: string;
  description: string;
  priceCents: number;
  aiGenerated: boolean;
};

type ChipField = "size" | "brand" | "condition" | "color";

const CHIP_LABELS: Record<ChipField, string> = { size: "Size", brand: "Brand", condition: "Condition", color: "Color" };

const chipFields = (d: Draft): ChipField[] =>
  sizeRelevant(d) ? ["size", "brand", "condition", "color"] : ["brand", "condition", "color"];

const chipLabel = (d: Draft, field: ChipField) => {
  const value = d[field].trim();
  if (!value) return `+ ${CHIP_LABELS[field].toLowerCase()}`;
  return field === "size" ? `Size ${value}` : value;
};

const sizeRelevant = (d: Draft) => d.size.trim() !== "" || /cloth|shoe|apparel|wear/i.test(d.category);

const DEFAULT_LOCATION = { neighborhood: "Mission", lat: 37.76, lng: -122.42 };

const withTimeout = <T,>(promise: Promise<T>, ms: number) =>
  Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);

async function approximateLocation() {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return DEFAULT_LOCATION;
    const position =
      (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), 5000).catch(
        () => null,
      )) ?? (await Location.getLastKnownPositionAsync().catch(() => null));
    if (!position) return DEFAULT_LOCATION;
    const { latitude, longitude } = position.coords;
    const [place] = await withTimeout(Location.reverseGeocodeAsync({ latitude, longitude }), 3000).catch(() => null) ?? [];
    return {
      neighborhood: place?.district ?? place?.subregion ?? "Nearby",
      lat: Math.round(latitude * 100) / 100,
      lng: Math.round(longitude * 100) / 100,
    };
  } catch {
    return DEFAULT_LOCATION;
  }
}

const dollars = (cents: number) => (cents > 0 ? `$${Math.round(cents / 100)}` : "$");

const parseDollars = (text: string) => {
  const value = parseInt(text.replace(/\D/g, ""), 10);
  return Number.isNaN(value) ? 0 : value * 100;
};

export default function SellerReview() {
  const user = useCurrentUser();
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);
  const describePhoto = useAction(api.ai.describePhoto);
  const openWithItems = useMutation(api.garages.openWithItems);
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    getPickedPhotos().map((uri) => ({
      uri,
      status: "loading",
      review: "pending",
      title: "",
      category: "",
      size: "",
      brand: "",
      condition: "",
      color: "",
      description: "",
      priceCents: 0,
      aiGenerated: false,
    })),
  );
  const [focus, setFocus] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [editingChip, setEditingChip] = useState<ChipField | null>(null);
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
          aiGenerated: true,
        });
      } catch {
        update(index, { status: storageId ? "ready" : "failed", storageId });
      }
    });
  }, []);

  const kept = drafts.filter((d) => d.review !== "removed");
  const approved = kept.filter((d) => d.review === "approved");
  const pending = drafts.map((d, i) => ({ d, i })).filter(({ d }) => d.review === "pending");
  const focused = pending.find(({ i }) => i === focus && drafts[i].status !== "loading");
  const current = focused ?? pending.find(({ d }) => d.status !== "loading") ?? pending[0];

  useEffect(() => {
    if (current && current.d.status !== "loading" && current.i !== focus) setFocus(current.i);
  }, [current?.i, current?.d.status, focus]);

  const advance = (patch: Partial<Draft>) => {
    if (!current) return;
    update(current.i, patch);
    setEditing(false);
    setEditingChip(null);
  };

  const openGarage = async () => {
    if (!user) {
      router.push({ pathname: "/signin", params: { next: "back" } });
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const { neighborhood, lat, lng } = await approximateLocation();
      const { garageId, itemIds, firstOpen } = await openWithItems({
        ownerId: user.userId,
        neighborhood,
        lat,
        lng,
        items: approved.map((d) => ({
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
      setError("Couldn't open your garage. Try again.");
      setOpening(false);
    }
  };

  if (!current) {
    return (
      <View style={styles.screen}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headline}>Ready to go</Text>
        <ScrollView style={styles.flex} contentContainerStyle={styles.summaryList}>
          {approved.length === 0 && <Text style={styles.muted}>Nothing approved yet</Text>}
          {drafts.map((d, i) =>
            d.review === "approved" ? (
              <View key={d.uri} style={styles.summaryRow}>
                <Image source={{ uri: d.uri }} style={styles.thumb} contentFit="cover" />
                <Text style={styles.summaryTitle} numberOfLines={1}>
                  {d.title}
                </Text>
                <Text style={styles.summaryPrice}>{dollars(d.priceCents)}</Text>
                <Pressable
                  onPress={() => update(i, { review: "pending" })}
                  hitSlop={10}
                  accessibilityLabel={`Edit ${d.title}`}
                  style={styles.editIcon}
                >
                  <Text style={styles.editIconText}>✎</Text>
                </Pressable>
              </View>
            ) : null,
          )}
        </ScrollView>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          onPress={openGarage}
          disabled={approved.length === 0 || opening}
          style={[styles.cta, (approved.length === 0 || opening) && styles.ctaDisabled]}
          accessibilityRole="button"
        >
          {opening ? (
            <ActivityIndicator color={colors.cream} />
          ) : (
            <Text style={styles.ctaText}>Open my garage ({approved.length} {approved.length === 1 ? "item" : "items"})</Text>
          )}
        </Pressable>
      </View>
    );
  }

  const { d, i } = current;
  const position = approved.length + 1;
  const loading = d.status === "loading";
  const failed = d.status === "failed";
  const canApprove = d.status === "ready" && d.title.trim() !== "" && d.priceCents > 0;

  return (
    <View style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.counter}>
          Review {position} of {kept.length}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(position / Math.max(kept.length, 1)) * 100}%` }]} />
      </View>
      <ScrollView style={styles.flex} contentContainerStyle={styles.itemBody} keyboardShouldPersistTaps="handled">
        <View style={styles.photoFrame}>
          <Image key={d.uri} source={{ uri: d.uri }} style={styles.photo} contentFit="cover" transition={0} />
          {!loading && !failed && (
            <View style={styles.sticker}>
              <TextInput
                accessibilityLabel="Price"
                value={dollars(d.priceCents)}
                onChangeText={(text) => update(i, { priceCents: parseDollars(text) })}
                keyboardType="number-pad"
                style={styles.priceInput}
              />
            </View>
          )}
        </View>
        {loading ? (
          <View style={styles.skeleton}>
            <View style={[styles.skeletonBar, { width: "70%" }]} />
            <View style={[styles.skeletonBar, { width: "40%", height: 24 }]} />
          </View>
        ) : failed ? (
          <Text style={styles.title}>Couldn't upload this one</Text>
        ) : editing ? (
          <View style={styles.fields}>
            <TextInput
              value={d.title}
              onChangeText={(title) => update(i, { title })}
              placeholder="Title"
              placeholderTextColor={colors.muted}
              style={styles.fieldInput}
              autoFocus
            />
            <View style={styles.chips}>
              {chipFields(d).map((field) => (
                <TextInput
                  key={field}
                  value={d[field]}
                  onChangeText={(value) => update(i, { [field]: value })}
                  placeholder={CHIP_LABELS[field]}
                  placeholderTextColor={colors.muted}
                  style={[styles.chip, styles.chipInput]}
                />
              ))}
            </View>
            <TextInput
              value={d.description}
              onChangeText={(description) => update(i, { description })}
              placeholder="Description"
              placeholderTextColor={colors.muted}
              style={styles.fieldInput}
            />
          </View>
        ) : (
          <View style={styles.fields}>
            <Text style={styles.title} numberOfLines={1}>
              {d.title || "Add a title"}
            </Text>
            <View style={styles.chips}>
              {chipFields(d).map((field) =>
                editingChip === field ? (
                  <TextInput
                    key={field}
                    value={d[field]}
                    onChangeText={(value) => update(i, { [field]: value })}
                    onBlur={() => setEditingChip(null)}
                    onSubmitEditing={() => setEditingChip(null)}
                    placeholder={CHIP_LABELS[field]}
                    placeholderTextColor={colors.muted}
                    returnKeyType="done"
                    autoFocus
                    style={[styles.chip, styles.chipInput]}
                  />
                ) : (
                  <Pressable
                    key={field}
                    onPress={() => setEditingChip(field)}
                    style={[styles.chip, !d[field].trim() && styles.chipEmpty]}
                  >
                    <Text style={[styles.chipText, !d[field].trim() && styles.chipTextEmpty]}>{chipLabel(d, field)}</Text>
                  </Pressable>
                ),
              )}
            </View>
          </View>
        )}
      </ScrollView>
      <View style={styles.actions}>
        <View style={styles.actionRow}>
          {!failed && (
            <Pressable
              onPress={() => setEditing((v) => !v)}
              disabled={loading}
              style={[styles.secondary, loading && styles.ctaDisabled]}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>{editing ? "Done" : "Edit"}</Text>
            </Pressable>
          )}
          {!failed && (
            <Pressable
              onPress={() => advance({ review: "approved" })}
              disabled={!canApprove}
              style={[styles.cta, styles.flex, !canApprove && styles.ctaDisabled]}
              accessibilityRole="button"
            >
              {loading ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.ctaText}>Approve</Text>}
            </Pressable>
          )}
        </View>
        <Pressable onPress={() => advance({ review: "removed" })} hitSlop={8} style={styles.skip}>
          <Text style={styles.skipText}>skip / remove</Text>
        </Pressable>
      </View>
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
    gap: 14,
  },
  flex: { flex: 1 },
  back: { alignSelf: "flex-start" },
  backText: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  counter: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: "hidden" },
  progressFill: { height: 6, backgroundColor: colors.brand },
  headline: { fontFamily: fonts.display, fontSize: 34, lineHeight: 34, letterSpacing: -1, color: colors.ink },
  itemBody: { gap: 16, paddingTop: 4 },
  photoFrame: { backgroundColor: colors.white, padding: 10, paddingBottom: 14 },
  photo: { width: "100%", aspectRatio: 1, backgroundColor: colors.line },
  sticker: { position: "absolute", left: 18, bottom: 22 },
  priceInput: {
    width: 110,
    height: 60,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tag,
    textAlign: "center",
    fontFamily: fonts.display,
    fontSize: 30,
    color: colors.ink,
  },
  skeleton: { gap: 10 },
  skeletonBar: { height: 28, borderRadius: 8, backgroundColor: colors.line },
  fields: { gap: 10 },
  title: { fontFamily: fonts.display, fontSize: 26, color: colors.ink },
  fieldInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white, justifyContent: "center" },
  chipEmpty: { backgroundColor: "transparent", borderWidth: 1, borderStyle: "dashed", borderColor: colors.muted },
  chipInput: { width: 120, borderWidth: 2, borderColor: colors.ink, fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  chipTextEmpty: { color: colors.muted },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  actions: { gap: 6 },
  actionRow: { flexDirection: "row", gap: 10 },
  secondary: {
    height: spacing.cta,
    paddingHorizontal: 24,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
  skip: { alignSelf: "center", minHeight: 36, justifyContent: "center" },
  skipText: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, textDecorationLine: "underline" },
  summaryList: { gap: 10 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 14, padding: 8 },
  thumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.line },
  summaryTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  summaryPrice: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  editIcon: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  editIconText: { fontSize: 18, color: colors.muted },
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
