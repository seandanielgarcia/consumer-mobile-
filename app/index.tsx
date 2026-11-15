import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "../convex/_generated/api";
import type { Doc } from "../convex/_generated/dataModel";
import { ItemEditFields, type ItemFields } from "../src/components/ItemEditFields";
import { setPickedPhotos } from "../src/lib/pickedPhotos";
import { loadSamplePhotos } from "../src/lib/samplePhotos";
import { shareYard } from "../src/lib/shareYard";
import { signOut, useCurrentUser } from "../src/lib/useCurrentUser";
import { colors, fonts, spacing } from "../src/theme";

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

async function pickFromCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return;
  const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
  if (result.canceled || result.assets.length === 0) return;
  setPickedPhotos(result.assets.map((asset) => asset.uri));
  router.push("/seller/price");
}

async function pickSamplePhotos() {
  setPickedPhotos(await loadSamplePhotos());
  router.push("/seller/price");
}

function addMore() {
  ActionSheetIOS.showActionSheetWithOptions(
    { title: "Add more", options: ["Photo library", "Camera", "Cancel"], cancelButtonIndex: 2 },
    (index) => {
      if (index === 0) pickFromLibrary();
      if (index === 1) pickFromCamera();
    },
  );
}

const dollars = (cents: number) => (cents > 0 ? `$${Math.round(cents / 100)}` : "$");
const parseDollars = (text: string) => {
  const value = parseInt(text.replace(/\D/g, ""), 10);
  return Number.isNaN(value) ? 0 : value * 100;
};

export default function Home() {
  const user = useCurrentUser();
  const mine = useQuery(api.garages.mine, user ? { ownerId: user.userId } : "skip");
  if (user && mine) return <Yard user={user} garage={mine.garage} />;
  return <Landing user={user} />;
}

// Signed out, or signed in without a yard yet.
function Landing({ user }: { user: { userId: Doc<"users">["_id"]; name?: string } | null }) {
  const samples = useQuery(api.items.sampleLive) ?? [];
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
          {samples.map((item, index) => (
            <View key={item._id} style={[styles.polaroid, POLAROID_POSITIONS[index]]}>
              <Image source={{ uri: item.photoUrl }} style={styles.polaroidPhoto} contentFit="cover" />
              <View style={styles.sticker}>
                <Text style={styles.stickerText}>${Math.round(item.priceCents / 100)}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.buttons}>
          <Pressable style={styles.button} onPress={pickFromLibrary} accessibilityRole="button">
            <Text style={styles.buttonText}>Sell your stuff</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => router.push("/buyer")} accessibilityRole="button">
            <Text style={styles.buttonText}>Shop near you</Text>
          </Pressable>
        </View>
        <View style={styles.landingLinks}>
          {showSamplePhotos && (
            <Pressable onPress={pickSamplePhotos} hitSlop={8} style={styles.linkButton} accessibilityRole="button">
              <Text style={[styles.sessionText, styles.signOut]}>Use sample photos</Text>
            </Pressable>
          )}
          {user && (
            <View style={styles.session}>
              <Text style={styles.sessionText}>{user.name ? `Hi ${user.name}` : "Signed in"} · </Text>
              <Pressable onPress={signOut} hitSlop={8} style={styles.linkButton} accessibilityRole="button">
                <Text style={[styles.sessionText, styles.signOut]}>Sign out</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

type Item = Doc<"items">;
type EditState = ItemFields & { priceCents: number };

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
    ActionSheetIOS.showActionSheetWithOptions(
      { title: `Remove ${item.title}?`, options: ["Remove", "Cancel"], cancelButtonIndex: 1, destructiveButtonIndex: 0 },
      async (index) => {
        if (index !== 0) return;
        const ok = await run(() => removeItem({ itemId: item._id, ownerId: user.userId }));
        if (ok) closeEdit();
      },
    );
  };

  // "Your yard · N live · N reserved · N sold" (zero counts other than live are omitted)
  const counts = (["live", "reserved", "sold"] as const)
    .map((status) => [items.filter((item) => item.status === status).length, status] as const)
    .filter(([n, status]) => n > 0 || status === "live")
    .map(([n, status]) => `${n} ${status}`)
    .join(" · ");

  return (
    <View style={styles.yard}>
      <View style={styles.yardHeader}>
        <Pressable onPress={() => router.dismissTo("/")} accessibilityRole="link" accessibilityLabel="Home">
          <Text style={styles.yardWordmark}>yardsale</Text>
        </Pressable>
        <View style={styles.session}>
          <Text style={styles.yardSessionText}>{user.name ? `Hi ${user.name}` : "Signed in"} · </Text>
          <Pressable onPress={signOut} hitSlop={8} accessibilityRole="button" style={styles.signOutButton}>
            <Text style={[styles.yardSessionText, styles.signOut]}>Sign out</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.yardHeadline}>Your yard{counts ? ` · ${counts}` : ""}</Text>
      <View style={styles.yardMetaRow}>
        <Text style={[styles.yardMeta, styles.yardMetaText]}>{garage.neighborhood} · visible to buyers nearby</Text>
        <Pressable onPress={() => shareYard(garage._id, user.name)} accessibilityRole="button" style={styles.sharePill}>
          <Text style={styles.sharePillText}>Share my yard</Text>
        </Pressable>
      </View>
      {error && !editing && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={<Text style={styles.yardMeta}>Nothing in your yard yet. Add a photo to start.</Text>}
        renderItem={({ item }) => (
          <YardCard item={item} busy={busy} onEdit={() => openEdit(item)} onStatus={(status) => change(item, status)} />
        )}
      />
      <View style={styles.bottomBar}>
        <Pressable style={styles.cta} onPress={addMore} accessibilityRole="button">
          <Text style={styles.ctaText}>Add more</Text>
        </Pressable>
        <Pressable style={styles.shopPill} onPress={() => router.push("/buyer")} accessibilityRole="button">
          <Text style={styles.shopPillText}>Shop near you</Text>
        </Pressable>
      </View>

      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeEdit}>
        {editing && draft && (
          <View style={styles.sheet}>
            <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
              <View style={styles.sheetHeader}>
                <Image source={{ uri: editing.photoUrl }} style={styles.sheetPhoto} contentFit="cover" />
                <View style={styles.priceSticker}>
                  <TextInput
                    accessibilityLabel="Price"
                    value={dollars(draft.priceCents)}
                    onChangeText={(text) => setDraft({ ...draft, priceCents: parseDollars(text) })}
                    keyboardType="number-pad"
                    style={styles.priceInput}
                  />
                </View>
              </View>
              <ItemEditFields value={draft} onChange={(patch) => setDraft({ ...draft, ...patch })} autoFocus={false} />
              {error && <Text style={styles.error}>{error}</Text>}
            </ScrollView>
            <View style={styles.sheetActions}>
              <View style={styles.sheetActionRow}>
                <Pressable onPress={remove} disabled={busy} style={[styles.secondary, busy && styles.disabled]} accessibilityRole="button">
                  <Text style={styles.secondaryText}>Remove</Text>
                </Pressable>
                <Pressable
                  onPress={save}
                  disabled={busy || !draft.title.trim() || draft.priceCents <= 0}
                  style={[styles.cta, styles.flex, (busy || !draft.title.trim() || draft.priceCents <= 0) && styles.disabled]}
                  accessibilityRole="button"
                >
                  <Text style={styles.ctaText}>Save</Text>
                </Pressable>
              </View>
              <Pressable onPress={closeEdit} style={styles.cancel} accessibilityRole="button">
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      </Modal>
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
        <Image source={{ uri: item.photoUrl }} style={styles.cardPhoto} contentFit="cover" />
        <View style={[styles.cardSticker, reserved && styles.stickerReserved, sold && styles.stickerSold]}>
          <Text style={[styles.stickerText, (reserved || sold) && styles.stickerTextInverse]}>
            {reserved ? "Reserved" : sold ? "Sold" : `$${Math.round(item.priceCents / 100)}`}
          </Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title}
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
    paddingTop: 60,
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
  stickerText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  wordmark: { fontFamily: fonts.display, fontSize: 44, letterSpacing: -1.5, color: colors.cream },
  landingLinks: { marginTop: 8, alignItems: "center", gap: 8 },
  linkButton: {
    minHeight: spacing.minButton,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.cream,
  },
  session: { flexDirection: "row", justifyContent: "center", alignItems: "center", minHeight: spacing.minButton },
  sessionText: { fontFamily: fonts.body, fontSize: 14, color: colors.cream },
  signOut: { fontFamily: fonts.semibold },
  tagline: { fontFamily: fonts.body, fontSize: 17, lineHeight: 23, color: colors.cream },
  button: {
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },

  // Yard
  yard: { flex: 1, backgroundColor: colors.cream, paddingTop: spacing.topPadMin, paddingHorizontal: spacing.sidePad, paddingBottom: 34, gap: 8 },
  yardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  yardWordmark: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.5, color: colors.brand },
  yardSessionText: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  signOutButton: {
    minHeight: spacing.minButton,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.muted,
  },
  yardHeadline: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: colors.ink },
  yardMeta: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  yardMetaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  yardMetaText: { flex: 1 },
  sharePill: {
    minHeight: spacing.minButton,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: spacing.radius,
    backgroundColor: colors.tag,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  sharePillText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  grid: { paddingTop: 8, paddingBottom: 12, gap: 14 },
  gridRow: { gap: 14 },
  card: { flex: 1, gap: 6 },
  cardBody: { minHeight: spacing.minButton, backgroundColor: colors.white, padding: 8, paddingBottom: 10, gap: 8 },
  cardPhoto: { width: "100%", aspectRatio: 0.85, backgroundColor: colors.line },
  cardSticker: {
    position: "absolute",
    left: 2,
    top: 2,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tag,
    justifyContent: "center",
  },
  stickerReserved: { backgroundColor: colors.ink },
  stickerSold: { backgroundColor: colors.muted },
  stickerTextInverse: { color: colors.cream },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
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
  cardActionText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
  bottomBar: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8 },
  cta: {
    flex: 1,
    height: spacing.cta,
    borderRadius: spacing.radius,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.cream },
  shopPill: {
    height: spacing.cta,
    paddingHorizontal: 20,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  shopPillText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },

  // Edit sheet
  sheet: { flex: 1, backgroundColor: colors.cream, paddingHorizontal: spacing.sidePad, paddingTop: 20, paddingBottom: 34, gap: 12 },
  sheetBody: { gap: 16 },
  sheetHeader: { backgroundColor: colors.white, padding: 10, paddingBottom: 14 },
  sheetPhoto: { width: "100%", aspectRatio: 1, backgroundColor: colors.line },
  priceSticker: { position: "absolute", left: 18, bottom: 22 },
  priceInput: {
    width: 110,
    height: spacing.cta,
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
  sheetActions: { gap: 6 },
  sheetActionRow: { flexDirection: "row", gap: 10 },
  flex: { flex: 1 },
  secondary: {
    height: spacing.cta,
    paddingHorizontal: 24,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
  disabled: { opacity: 0.5 },
  cancel: {
    alignSelf: "center",
    minHeight: spacing.minButton,
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.muted,
  },
  cancelText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
});
