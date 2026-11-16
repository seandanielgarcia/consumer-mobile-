import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { EditItemSheet, type EditableItem } from "../../src/components/EditItemSheet";
import { textKeikiVerification } from "../../src/lib/keiki";
import { setPickedPhotos } from "../../src/lib/pickedPhotos";
import { loadSamplePhotos } from "../../src/lib/samplePhotos";
import { formatPlace } from "../../src/lib/place";
import { shareYard } from "../../src/lib/shareYard";
import { stockImages } from "../../src/lib/stockImages";
import { markEntered } from "../../src/lib/entered";
import { useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors, fonts, secondaryButton, secondaryButtonText, shadows, spacing, surfaces } from "../../src/theme";

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
  if (user && mine === undefined) return null;
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
          <Pressable style={styles.buttonSecondary} onPress={() => (markEntered(), router.navigate("/buyer"))} accessibilityRole="button">
            <Text style={styles.buttonSecondaryText}>Shop near you</Text>
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
  const textable = useQuery(api.users.sellerTextable, { garageId: garage._id });
  const demoUser = useQuery(api.users.isDemoUser, { userId: user.userId });
  const requestBuyerTexts = useMutation(api.users.requestBuyerTexts);
  const [textRequest, setTextRequest] = useState<boolean>();
  const [openingMessages, setOpeningMessages] = useState(false);
  const setStatus = useMutation(api.items.setStatus);
  const updateItem = useMutation(api.items.update);
  const removeItem = useMutation(api.items.remove);
  const [editing, setEditing] = useState<Item | null>(null);
  const [draft, setDraft] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (textRequest === textable) setTextRequest(undefined);
  }, [textRequest, textable]);

  const changeBuyerTexts = () => {
    if (textable === undefined || openingMessages) return;
    const allow = !textable;
    Alert.alert(
      allow ? "Allow texts from buyers?" : "Turn off buyer texts?",
      allow
        ? "Signed-in buyers can see your phone number in Messages. Send the draft to Keiki to confirm."
        : "Send the draft to Keiki to remove the text button from your yard.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Open Messages",
          onPress: async () => {
            setOpeningMessages(true);
            setError(null);
            try {
              const code = await requestBuyerTexts({ garageId: garage._id, ownerId: user.userId, allow });
              await textKeikiVerification(code);
              setTextRequest(allow);
            } catch {
              setError("Couldn't start buyer text setup. Try again.");
            } finally {
              setOpeningMessages(false);
            }
          },
        },
      ],
    );
  };

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
    if (item.status === "reserved") {
      setError("Reserved items can't be edited until pickup. Mark it sold or put it back first.");
      return;
    }
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
        <Pressable onPress={() => shareYard(garage._id, user.name)} hitSlop={8} style={styles.takePhoto} accessibilityRole="button">
          <Text style={styles.takePhotoText}>Share my yard</Text>
        </Pressable>
        {demoUser === false && textable !== undefined && (
          <Pressable
            onPress={changeBuyerTexts}
            disabled={openingMessages}
            style={[styles.takePhoto, styles.buyerTextsPill]}
            accessibilityRole="button"
          >
            <Text style={styles.takePhotoText}>{textable ? "Turn off buyer texts" : "Allow buyer texts"}</Text>
          </Pressable>
        )}
      </View>
      {textRequest !== undefined && <Text style={styles.yardMeta}>Send the draft to Keiki to confirm.</Text>}
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
          onRemove={editing.status === "reserved" ? undefined : remove}
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
          <View style={styles.priceSticker}>
            <Text style={styles.cardPrice}>${Math.round(item.priceCents / 100)}</Text>
          </View>
          {item.size && (
            <View style={styles.sizeBadge} accessible={false}>
              <Text style={styles.sizeText} numberOfLines={1}>
                {item.size}
              </Text>
            </View>
          )}
        </View>
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
              <Text style={styles.cardActionText}>Put back</Text>
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
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.sidePad,
    paddingBottom: 34,
    justifyContent: "center",
  },
  block: { gap: 12 },
  buttons: { gap: 12, marginTop: 8 },
  stack: { height: 190, marginTop: 12 },
  polaroid: { position: "absolute", width: 104, backgroundColor: colors.white, borderRadius: 14, padding: 6, paddingBottom: 18, ...shadows.card },
  polaroidPhoto: { width: 92, height: 112, borderRadius: 9, backgroundColor: colors.line },
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
  stickerText: { fontSize: 15, fontWeight: "800", color: colors.ink },
  wordmark: { ...fonts.wordmark, fontSize: 44, letterSpacing: -1.5, color: colors.ink },
  landingLinks: { marginTop: 8, alignItems: "center", gap: 8 },
  linkButton: {
    minHeight: spacing.minButton,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sessionText: { ...fonts.body, fontSize: 14, color: colors.muted },
  signOut: { ...fonts.semibold },
  tagline: { ...fonts.body, fontSize: 17, lineHeight: 23, color: colors.muted },
  button: {
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.float,
    shadowOpacity: 0.2,
  },
  buttonText: { ...fonts.semibold, fontSize: 20, color: colors.white },
  buttonSecondary: { ...secondaryButton, height: 64, borderRadius: 32 },
  buttonSecondaryText: { ...secondaryButtonText, fontSize: 20 },

  // Yard
  yard: { flex: 1, backgroundColor: colors.cream, paddingTop: 4, paddingHorizontal: spacing.sidePad, paddingBottom: 34, gap: 8 },
  yardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  yardWordmark: { ...fonts.display, fontSize: 20, letterSpacing: -0.5, color: colors.brand },
  yardHeadline: { ...fonts.wordmark, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: colors.ink },
  yardMeta: { ...fonts.semibold, fontSize: 11, letterSpacing: 1.6, textTransform: "uppercase", color: colors.muted },
  grid: { paddingTop: 8, paddingBottom: 12, gap: 14 },
  gridRow: { gap: 14 },
  card: { flex: 1, maxWidth: "48%", gap: 8 },
  cardBody: { ...surfaces.card, padding: 8, paddingBottom: 12, gap: 2 },
  cardPhoto: { width: "100%", aspectRatio: 1, borderRadius: spacing.photo, backgroundColor: colors.hairline, marginBottom: 8 },
  sizeBadge: {
    position: "absolute",
    right: 8,
    bottom: 16,
    maxWidth: 80,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    backgroundColor: colors.badge,
    justifyContent: "center",
  },
  sizeText: { ...fonts.semibold, fontSize: 12, color: colors.white },
  priceSticker: { position: "absolute", left: 6, bottom: 14, ...surfaces.sticker },
  cardPrice: { fontSize: 15, fontWeight: "800", color: colors.ink },
  cardTitle: { ...fonts.semibold, fontSize: 15, lineHeight: 20, color: colors.ink, paddingHorizontal: 4 },
  cardMeta: { ...fonts.medium, fontSize: 13, color: colors.muted, paddingHorizontal: 4 },
  cardReserved: { color: colors.pink },
  cardActions: { flexDirection: "row", gap: 6 },
  cardAction: {
    flex: 1,
    minHeight: spacing.minButton,
    borderRadius: spacing.radius,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.white,
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
  buyerTextsPill: { borderWidth: 1, borderColor: colors.hairline, borderRadius: 999, paddingHorizontal: 12 },
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
