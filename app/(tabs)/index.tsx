import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { EditItemSheet, type EditableItem } from "../../src/components/EditItemSheet";
import { setPickedPhotos } from "../../src/lib/pickedPhotos";
import { loadSamplePhotos } from "../../src/lib/samplePhotos";
import { formatPlace } from "../../src/lib/place";
import { shareYard } from "../../src/lib/shareYard";
import { stockImages } from "../../src/lib/stockImages";
import { markEntered } from "../../src/lib/entered";
import { pickFromCamera } from "../../src/lib/sell";
import { useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors, fonts, spacing } from "../../src/theme";

const POLAROID_POSITIONS = [
  { left: 8, top: 18, transform: [{ rotate: "-8deg" }] },
  { left: 92, top: 0, transform: [{ rotate: "4deg" }] },
  { left: 176, top: 22, transform: [{ rotate: "-3deg" }] },
  { left: 236, top: 4, transform: [{ rotate: "7deg" }] },
];

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6 };

// Photo library and Camera both feed the same review queue (/seller/price).
async function pickFromLibrary() {
  const result = await ImagePicker.launchImageLibraryAsync({ ...PICKER_OPTIONS, allowsMultipleSelection: true, selectionLimit: 0 });
  if (result.canceled || result.assets.length === 0) return;
  setPickedPhotos(result.assets.map((asset) => asset.uri));
  router.push("/seller/price");
}

async function pickSamplePhotos() {
  setPickedPhotos(await loadSamplePhotos());
  router.push("/seller/price");
}



export default function Home() {
  const user = useCurrentUser();
  const mine = useQuery(api.garages.mine, user ? { ownerId: user.userId } : "skip");
  if (user && mine) return <Yard user={user} garage={mine.garage} />;
  return <Landing user={user} />;
}

// Signed out, or signed in without a yard yet.
function Landing({ user }: { user: { userId: Doc<"users">["_id"]; name?: string } | null }) {
  const isDemoUser = useQuery(api.users.isDemoUser, user ? { userId: user.userId } : "skip");
  // Dev builds, demo numbers, and signed-out users (unless EXPO_PUBLIC_SHOW_SAMPLES=0).
  const showSamplePhotos = __DEV__ || isDemoUser === true || (!user && process.env.EXPO_PUBLIC_SHOW_SAMPLES !== "0");
  return (
    <View style={styles.screen}>
      <View style={styles.block}>
        <Pressable onPress={() => router.dismissTo("/")} accessibilityRole="link" accessibilityLabel="Home">
          <Text style={styles.wordmark}>yardsale</Text>
        </Pressable>
        <Text style={styles.tagline} numberOfLines={1} adjustsFontSizeToFit>
          Share a photo and set a price, we'll take care of the rest
        </Text>
        <View style={styles.stack}>
          {stockImages("landing").map((item, index) => (
            <View key={item.file} style={[styles.polaroid, POLAROID_POSITIONS[index]]}>
              <Image source={item.image} style={styles.polaroidPhoto} contentFit="cover" />
              <View style={styles.sticker}>
                <Text style={styles.stickerText}>${Math.round(item.priceCents / 100)}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.buttons}>
          <Pressable style={styles.button} onPress={() => (markEntered(), pickFromLibrary())} accessibilityRole="button">
            <Text style={styles.buttonText}>Sell your stuff</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => (markEntered(), router.navigate("/buyer"))} accessibilityRole="button">
            <Text style={styles.buttonText}>Shop near you</Text>
          </Pressable>
        </View>
        <View style={styles.landingLinks}>
          {showSamplePhotos && (
            <Pressable onPress={() => (markEntered(), pickSamplePhotos())} hitSlop={8} style={styles.linkButton} accessibilityRole="button">
              <Text style={[styles.sessionText, styles.signOut]}>Use sample photos</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

type Item = Doc<"items">;
type EditState = EditableItem;

const toFields = (item: Item): EditState => ({
  title: item.title,
  category: item.category ?? "",
  size: item.size ?? "",
  brand: item.brand ?? "",
  condition: item.condition ?? "",
  color: item.color ?? "",
  description: item.description,
  priceCents: item.priceCents,
});

// Signed-in seller with a yard: Home is the yard.
function Yard({ user, garage }: { user: { userId: Doc<"users">["_id"]; name?: string }; garage: Doc<"garages"> }) {
  const items = useQuery(api.items.byGarage, { garageId: garage._id }) ?? [];
  const setStatus = useMutation(api.items.setStatus);
  const updateItem = useMutation(api.items.update);
  const removeItem = useMutation(api.items.remove);
  const [editing, setEditing] = useState<Item | null>(null);
  const [draft, setDraft] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const change = (item: Item, status: "sold" | "live") => run(() => setStatus({ itemId: item._id, ownerId: user.userId, status }));

  const openEdit = (item: Item) => {
    setError(null);
    setEditing(item);
    setDraft(toFields(item));
  };
  const closeEdit = () => {
    setEditing(null);
    setDraft(null);
  };
  const save = async () => {
    if (!editing || !draft) return;
    const ok = await run(() =>
      updateItem({
        itemId: editing._id,
        ownerId: user.userId,
        title: draft.title,
        category: draft.category.trim() || undefined,
        size: draft.size.trim() || undefined,
        brand: draft.brand.trim() || undefined,
        condition: draft.condition.trim() || undefined,
        color: draft.color.trim() || undefined,
        description: draft.description,
        priceCents: draft.priceCents,
      }),
    );
    if (ok) closeEdit();
  };
  const remove = async () => {
    if (!editing) return;
    const item = editing;
    const ok = await run(() => removeItem({ itemId: item._id, ownerId: user.userId }));
    if (ok) closeEdit();
  };

  // "Your yard · N live · N reserved · N sold" (zero counts other than live are omitted)
  const counts = (["live", "reserved", "sold"] as const)
    .map((status) => [items.filter((item) => item.status === status).length, status] as const)
    .filter(([n, status]) => n > 0 || status === "live")
    .map(([n, status]) => `${n} ${status}`)
    .join(" · ");

  return (
    <View style={[styles.yard, { paddingTop: 8, paddingBottom: 0 }]}>
      <Text style={styles.yardHeadline}>Your yard{counts ? ` · ${counts}` : ""}</Text>
      <Text style={styles.yardMeta}>{formatPlace(garage)}</Text>
      <View style={styles.textActions}>
        <Pressable onPress={pickFromCamera} hitSlop={8} style={styles.takePhoto} accessibilityRole="button">
          <Text style={styles.takePhotoText}>Take photo</Text>
        </Pressable>
        <Pressable onPress={() => router.push(`/buyer/garage/${garage._id}`)} hitSlop={8} style={styles.takePhoto} accessibilityRole="button">
          <Text style={styles.takePhotoText}>View your yard</Text>
        </Pressable>
        <Pressable onPress={() => shareYard(garage._id, user.name)} hitSlop={8} style={styles.takePhoto} accessibilityRole="button">
          <Text style={styles.takePhotoText}>Share my yard</Text>
        </Pressable>
      </View>
      {error && !editing && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        style={styles.gridList}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={<Text style={styles.yardMeta}>Nothing in your yard yet. Add a photo to start.</Text>}
        renderItem={({ item }) => (
          <YardCard item={item} busy={busy} onEdit={() => openEdit(item)} onStatus={(status) => change(item, status)} />
        )}
      />

      {editing && draft && (
        <EditItemSheet
          visible
          photo={editing.photoUrl}
          value={draft}
          onChange={(patch) => setDraft({ ...draft, ...patch })}
          busy={busy}
          error={error}
          onSave={save}
          onRemove={remove}
          onClose={closeEdit}
        />
      )}
    </View>
  );
}

function YardCard({
  item,
  busy,
  onEdit,
  onStatus,
}: {
  item: Item;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: "sold" | "live") => void;
}) {
  const reserved = item.status === "reserved";
  const sold = item.status === "sold";
  return (
    <View style={styles.card}>
      <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} style={styles.cardBody}>
        <View>
          <Image source={{ uri: item.photoUrl }} style={styles.cardPhoto} contentFit="cover" />
          {item.size && (
            <View style={styles.sizeBadge} accessible={false}>
              <Text style={styles.sizeText} numberOfLines={1}>
                {item.size}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.cardPrice}>${Math.round(item.priceCents / 100)}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.cardMeta, reserved && styles.cardReserved]} numberOfLines={1}>
          {reserved ? "Reserved" : sold ? "Sold" : item.condition || " "}
        </Text>
      </Pressable>
      {(reserved || sold) && (
        <View style={styles.cardActions}>
          {reserved && (
            <>
              <Pressable onPress={() => onStatus("sold")} disabled={busy} style={styles.cardAction} accessibilityRole="button">
                <Text style={styles.cardActionText}>Sold</Text>
              </Pressable>
              <Pressable onPress={() => onStatus("live")} disabled={busy} style={styles.cardAction} accessibilityRole="button">
                <Text style={styles.cardActionText}>Put back</Text>
              </Pressable>
            </>
          )}
          {sold && (
            <Pressable onPress={() => onStatus("live")} disabled={busy} style={styles.cardAction} accessibilityRole="button">
              <Text style={styles.cardActionText}>Relist</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Landing
  screen: {
    flex: 1,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.sidePad,
    paddingBottom: 34,
    justifyContent: "center",
  },
  block: { gap: 12 },
  buttons: { gap: 12, marginTop: 8 },
  stack: { height: 190, marginTop: 12 },
  polaroid: { position: "absolute", width: 104, backgroundColor: colors.white, padding: 6, paddingBottom: 18 },
  polaroidPhoto: { width: 92, height: 112, backgroundColor: colors.line },
  sticker: {
    position: "absolute",
    left: -6,
    bottom: 6,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tag,
    justifyContent: "center",
  },
  stickerText: { ...fonts.display, fontSize: 15, color: colors.ink },
  wordmark: { ...fonts.wordmark, fontSize: 44, letterSpacing: -1.5, color: colors.cream },
  landingLinks: { marginTop: 8, alignItems: "center", gap: 8 },
  linkButton: {
    minHeight: spacing.minButton,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.cream,
  },
  sessionText: { ...fonts.body, fontSize: 14, color: colors.cream },
  signOut: { ...fonts.semibold },
  tagline: { ...fonts.body, fontSize: 17, lineHeight: 23, color: colors.cream },
  button: {
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { ...fonts.semibold, fontSize: 24, color: colors.ink },

  // Yard
  yard: { flex: 1, backgroundColor: colors.cream, paddingTop: 4, paddingHorizontal: spacing.sidePad, paddingBottom: 34, gap: 8 },
  yardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  yardWordmark: { ...fonts.display, fontSize: 20, letterSpacing: -0.5, color: colors.brand },
  yardHeadline: { ...fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: colors.ink },
  yardMeta: { ...fonts.body, fontSize: 15, color: colors.muted },
  grid: { paddingTop: 8, paddingBottom: 12, gap: 14 },
  gridRow: { gap: 14 },
  card: { flex: 1, gap: 6 },
  cardBody: { gap: 2 },
  cardPhoto: { width: "100%", aspectRatio: 1, borderRadius: 16, backgroundColor: colors.hairline, marginBottom: 6 },
  sizeBadge: {
    position: "absolute",
    right: 8,
    bottom: 14,
    maxWidth: 80,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: colors.badge,
    justifyContent: "center",
  },
  sizeText: { ...fonts.semibold, fontSize: 12, color: colors.white },
  cardPrice: { ...fonts.display, fontSize: 17, lineHeight: 22, color: colors.ink },
  cardTitle: { ...fonts.body, fontSize: 15, lineHeight: 20, color: colors.ink },
  cardMeta: { ...fonts.medium, fontSize: 13, color: colors.muted },
  cardReserved: { color: colors.brand },
  cardActions: { flexDirection: "row", gap: 6 },
  cardAction: {
    flex: 1,
    minHeight: spacing.minButton,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  cardActionText: { ...fonts.semibold, fontSize: 14, color: colors.ink },
  gridList: { flex: 1 },
  cta: {
    height: 56,
    borderRadius: spacing.radius,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { ...fonts.semibold, fontSize: 17, color: colors.white },
  textActions: { flexDirection: "row", justifyContent: "center", gap: 24, marginTop: -4 },
  takePhoto: { minHeight: spacing.minButton, justifyContent: "center" },
  takePhotoText: { ...fonts.medium, fontSize: 16, color: colors.brand },
  shopPill: {
    height: 56,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  shopPillText: { ...fonts.semibold, fontSize: 17, color: colors.ink },
  error: { ...fonts.medium, fontSize: 14, color: colors.ink },

  // Edit sheet
});
