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
  size: string;
  description: string;
  priceCents: number;
  suggestedPriceCents: number;
  aiGenerated: boolean;
};

type Preset = 1000 | 2000 | "ai" | null;

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
      size: "",
      description: "",
      priceCents: 0,
      suggestedPriceCents: 0,
      aiGenerated: false,
    })),
  );
  const [preset, setPreset] = useState<Preset>("ai");
  const [editing, setEditing] = useState<number | null>(null);
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
          size: listing.size,
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
      setError("Sign in to open your garage.");
      return;
    }
    setOpening(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Location is needed so buyers nearby can find your garage.");
      const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync({ latitude: coords.latitude, longitude: coords.longitude });
      const { garageId, firstOpen } = await openWithItems({
        ownerId: user.userId,
        neighborhood: place?.district ?? place?.subregion ?? "Nearby",
        lat: coords.latitude,
        lng: coords.longitude,
        items: uploaded.map((d) => ({
          storageId: d.storageId!,
          title: d.title.trim(),
          size: d.size.trim(),
          description: d.description.trim(),
          priceCents: d.priceCents,
          aiGenerated: d.aiGenerated,
        })),
      });
      router.replace({ pathname: "/seller/open", params: { garageId, first: firstOpen ? "1" : "0" } });
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
                  {option === "ai" ? "AI suggests" : `$${option / 100}`}
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
                    onBlur={() => setEditing(null)}
                    placeholder="Size, color, condition"
                    multiline
                    style={[styles.description, styles.input]}
                  />
                </>
              ) : (
                <Pressable onPress={() => setEditing(index)} style={styles.textBlock}>
                  <Text style={styles.title} numberOfLines={1}>
                    {draft.title || (draft.status === "failed" ? "Couldn't upload this one" : "Tap to add a title")}
                  </Text>
                  <Text style={styles.description} numberOfLines={2}>
                    {draft.description || "Tap to add size, color, condition"}
                  </Text>
                  {/* TODO(SEA-3 A): whether the "Written by AI · tap to edit" label shows here is undecided. */}
                </Pressable>
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
  input: { padding: 0, marginBottom: 4 },
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
