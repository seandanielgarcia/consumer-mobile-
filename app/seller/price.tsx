import { useAction, useMutation } from "convex/react";
import { useHeaderBack, useLeaveGuard } from "../../src/lib/headerBack";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { EditItemSheet, missingField } from "../../src/components/EditItemSheet";
import { getPickedPhotos } from "../../src/lib/pickedPhotos";
import { requireUser, SignInCancelled, useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors, fonts, primaryButton, primaryButtonText, spacing, type } from "../../src/theme";

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

const DEFAULT_LOCATION = { neighborhood: "Mission", city: "San Francisco", lat: 37.76, lng: -122.42 };

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
      neighborhood: place?.district ?? place?.subregion ?? place?.city ?? "Nearby",
      city: place?.city ?? undefined,
      lat: Math.round(latitude * 100) / 100,
      lng: Math.round(longitude * 100) / 100,
    };
  } catch {
    return DEFAULT_LOCATION;
  }
}

const dollars = (cents: number) => (cents > 0 ? `$${Math.round(cents / 100)}` : "");

export default function SellerReview() {
  const generateUploadUrl = useMutation(api.items.generateUploadUrl);
  const describePhoto = useAction(api.ai.describePhoto);
  const openWithItems = useMutation(api.garages.openWithItems);
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    getPickedPhotos().map((uri) => ({
      uri,
      status: "loading",
      review: "approved",
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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [wantsOpen, setWantsOpen] = useState(false);
  const location = useRef<ReturnType<typeof approximateLocation> | null>(null);

  useEffect(() => {
    location.current = approximateLocation();
  }, []);

  const update = (index: number, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  useEffect(() => {
    const describe = async (uri: string, index: number) => {
      let storageId: Id<"_storage"> | undefined;
      try {
        const uploadUrl = await generateUploadUrl();
        const blob = await (await fetch(uri)).blob();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: blob,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
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
        update(index, storageId ? { status: "ready", storageId } : { status: "failed", review: "removed" });
      }
    };
    (async () => {
      for (const [index, draft] of drafts.entries()) {
        try {
          const rendered = await ImageManipulator.manipulate(draft.uri).resize({ width: 1600 }).renderAsync();
          const { uri } = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 });
          update(index, { uri });
          describe(uri, index);
        } catch {
          update(index, { status: "failed", review: "removed" });
        }
      }
    })();
  }, []);

  const approved = drafts.filter((d) => d.review === "approved");
  const pricing = approved.filter((d) => d.status === "loading").length;
  const needsFix = approved.filter((d) => d.status === "ready" && missingField(d)).length;
  const canOpen = approved.length > 0 && pricing === 0 && needsFix === 0 && !opening;

  const openGarage = () => {
    setError(null);
    setWantsOpen(true);
    if (user) return;
    requireUser("Sign in to open your yard").catch((e) => {
      setWantsOpen(false);
      if (!(e instanceof SignInCancelled)) setError("Couldn't sign you in. Try again.");
    });
  };

  useEffect(() => {
    if (!wantsOpen || !user) return;
    setWantsOpen(false);
    openFor(user.userId);
  }, [wantsOpen, user]);

  const openFor = async (ownerId: Id<"users">) => {
    setOpening(true);
    try {
      const { neighborhood, city, lat, lng } = await (location.current ?? approximateLocation());
      const { garageId, itemIds, firstOpen } = await openWithItems({
        ownerId,
        neighborhood,
        city,
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
        params: { garageId, picked: itemIds.join(","), first: firstOpen ? "1" : "0" },
      });
    } catch {
      setError("Couldn't open your yard. Try again.");
      setOpening(false);
    }
  };

  const toggle = (index: number) =>
    update(index, { review: drafts[index].review === "approved" ? "removed" : "approved" });

  const confirmDiscard = (leave: () => void) => {
    if (approved.length === 0) return leave();
    Alert.alert(`Discard ${approved.length} ${approved.length === 1 ? "item" : "items"}?`, undefined, [
      { text: "Keep reviewing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: leave },
    ]);
  };
  const discard = () => confirmDiscard(() => router.dismissTo("/"));
  useLeaveGuard(confirmDiscard);

  useHeaderBack(() => (editingIndex === null ? discard() : setEditingIndex(null)));

  const cardWidth = (width - spacing.sidePad * 2 - 12) / 2;
  const overview = (
      <View style={[styles.summaryScreen, { paddingTop: 8, paddingBottom: insets.bottom + 8 }]}>
        <Text style={styles.headline}>Your yard</Text>
        <Text style={styles.subline}>
          {pricing > 0
            ? `Pricing ${pricing} ${pricing === 1 ? "photo" : "photos"}…`
            : `${approved.length} ${approved.length === 1 ? "item" : "items"} · ${dollars(approved.reduce((sum, d) => sum + d.priceCents, 0)) || "$0"} · tap to edit`}
        </Text>
        <ScrollView style={styles.flex} contentContainerStyle={styles.grid}>
          {drafts.map((d, index) => {
            const removed = d.review === "removed";
            const size = d.size.trim();
            return (
              <View key={index} style={[{ width: cardWidth }, removed && styles.cardRemoved]}>
                <Pressable
                  onPress={() => setEditingIndex(index)}
                  disabled={d.status !== "ready"}
                  accessibilityRole="button"
                  accessibilityLabel={d.title ? `Edit ${d.title}` : "Photo"}
                  style={styles.card}
                >
                  <View>
                    <Image source={{ uri: d.uri }} style={styles.cardPhoto} contentFit="cover" transition={0} />
                    {d.status === "ready" && size !== "" && (
                      <View style={styles.sizeBadge} accessible={false}>
                        <Text style={styles.sizeText} numberOfLines={1}>
                          {size}
                        </Text>
                      </View>
                    )}
                    {d.status === "loading" && (
                      <View style={styles.cardSpinner}>
                        <ActivityIndicator color={colors.white} />
                      </View>
                    )}
                  </View>
                  {d.status === "ready" ? (
                    <>
                      <Text style={styles.cardPrice}>{dollars(d.priceCents) || "Add price"}</Text>
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {d.title || "Add a title"}
                      </Text>
                      <Text style={missingField(d) ? styles.cardFix : styles.cardMeta} numberOfLines={1}>
                        {missingField(d) ? `Add ${missingField(d)}` : d.condition.trim() || " "}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.cardMeta}>{d.status === "failed" ? "Couldn't upload" : "Pricing…"}</Text>
                  )}
                </Pressable>
                {d.status !== "failed" && (
                  <Pressable
                    onPress={() => toggle(index)}
                    hitSlop={8}
                    style={[styles.toggle, removed && styles.toggleOff]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: !removed }}
                    accessibilityLabel={removed ? "Add back" : "Remove"}
                  >
                    {!removed && <Text style={styles.toggleText}>✓</Text>}
                  </Pressable>
                )}
              </View>
            );
          })}
        </ScrollView>
        {error && <Text style={styles.error}>{error}</Text>}
        {needsFix > 0 && pricing === 0 && (
          <Text style={styles.muted}>Fix {needsFix} {needsFix === 1 ? "item" : "items"} to continue</Text>
        )}
        <Pressable
          onPress={openGarage}
          disabled={!canOpen}
          style={[styles.approve, !canOpen && styles.disabled]}
          accessibilityRole="button"
        >
          {opening ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.approveText}>Approve all ({approved.length})</Text>
          )}
        </Pressable>
      </View>
  );

  if (editingIndex === null) return overview;

  const i = editingIndex;
  const d = drafts[i];

  const done = () => setEditingIndex(null);

  const remove = () => {
    update(i, { review: "removed" });
    setEditingIndex(null);
  };

  return (
    <>
      {overview}
      <EditItemSheet
        visible
        photo={d.uri}
        value={d}
        onChange={(patch) => update(i, patch)}
        aiNote={d.aiGenerated}
        onSave={done}
        onRemove={remove}
        onClose={done}
      />
    </>
  );
}

const HAIRLINE = colors.hairline;
const MUTED = colors.muted;

const styles = StyleSheet.create({
  summaryScreen: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingTop: 4,
    paddingHorizontal: spacing.sidePad,
    paddingBottom: 34,
    gap: 14,
  },
  flex: { flex: 1 },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  backText: { ...fonts.body, fontSize: 15, color: colors.muted },
  headline: { ...type.title, color: colors.ink },
  approve: primaryButton,
  disabled: { opacity: 0.4 },
  approveText: primaryButtonText,
  muted: { ...fonts.body, fontSize: 14, color: colors.muted },
  subline: { ...type.row, color: MUTED, marginTop: -6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 4, paddingBottom: 12 },
  card: { gap: 2 },
  cardRemoved: { opacity: 0.45 },
  cardPhoto: { width: "100%", aspectRatio: 1, borderRadius: 16, backgroundColor: HAIRLINE, marginBottom: 6 },
  cardSpinner: { position: "absolute", top: 0, right: 0, bottom: 6, left: 0, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(17,17,17,0.25)" },
  sizeBadge: {
    position: "absolute",
    right: 8,
    bottom: 14,
    maxWidth: 80,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: "rgba(17,17,17,0.85)",
    justifyContent: "center",
  },
  sizeText: { ...fonts.semibold, fontSize: 12, color: colors.white },
  cardPrice: { ...fonts.display, fontSize: 17, lineHeight: 22, color: colors.ink },
  cardTitle: { ...fonts.body, fontSize: 15, lineHeight: 20, color: colors.ink },
  cardMeta: { ...type.meta, color: MUTED },
  cardFix: { ...type.meta, color: colors.brand },
  toggle: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: spacing.radius,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleOff: { backgroundColor: "rgba(255,255,255,0.7)", borderColor: colors.ink },
  toggleText: { ...fonts.semibold, fontSize: 14, color: colors.white },
  error: { ...fonts.medium, fontSize: 14, color: colors.error, textAlign: "center" },
});
