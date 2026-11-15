import { useAction, useMutation } from "convex/react";
import { Image } from "expo-image";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getPickedPhotos } from "../../src/lib/pickedPhotos";
import { requireUser, SignInCancelled, useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors, fonts, primaryButton, primaryButtonText, spacing, type } from "../../src/theme";

type Field = "condition" | "size" | "brand" | "color" | "category";

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
  touched: Field[];
};

const FIELD_LABELS: Record<Field, string> = {
  condition: "Condition",
  size: "Size",
  brand: "Brand",
  color: "Color",
  category: "Category",
};

const FIELD_OPTIONS: Partial<Record<Field, string[]>> = {
  condition: ["New", "Like new", "Good", "Fair", "For parts"],
  color: ["Black", "White", "Gray", "Blue", "Red", "Green", "Brown", "Beige", "Pink", "Multi"],
  category: ["Clothing", "Shoes", "Bags", "Home", "Electronics", "Toys", "Books", "Other"],
};

const sizeRelevant = (d: Draft) => d.size.trim() !== "" || /cloth|shoe|apparel|wear/i.test(d.category);

const visibleFields = (d: Draft): Field[] =>
  sizeRelevant(d) ? ["condition", "size", "brand", "color", "category"] : ["condition", "brand", "color", "category"];

const blockerOf = (d: Draft) =>
  !d.condition.trim() ? "condition" : !d.title.trim() ? "title" : d.priceCents <= 0 ? "price" : null;

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

const dollars = (cents: number) => (cents > 0 ? `$${Math.round(cents / 100)}` : "");

const parseDollars = (text: string) => {
  const value = parseInt(text.replace(/\D/g, ""), 10);
  return Number.isNaN(value) ? 0 : value * 100;
};

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
      touched: [],
    })),
  );
  const [sheet, setSheet] = useState<Field | "description" | null>(null);
  const [sheetText, setSheetText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const priceFresh = useRef(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();
  const { width } = useWindowDimensions();
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

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () =>
      setKeyboardUp(true),
    );
    const hide = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () =>
      setKeyboardUp(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const approved = drafts.filter((d) => d.review === "approved");
  const pricing = approved.filter((d) => d.status === "loading").length;
  const needsFix = approved.filter((d) => d.status === "ready" && blockerOf(d)).length;
  const canOpen = approved.length > 0 && pricing === 0 && needsFix === 0 && !opening;

  useEffect(() => setExpanded(false), [editingIndex]);

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
      const { neighborhood, lat, lng } = await (location.current ?? approximateLocation());
      const { garageId, itemIds, firstOpen } = await openWithItems({
        ownerId,
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
        params: { garageId, picked: itemIds.join(","), first: firstOpen ? "1" : "0" },
      });
    } catch {
      setError("Couldn't open your yard. Try again.");
      setOpening(false);
    }
  };

  const toggle = (index: number) =>
    update(index, { review: drafts[index].review === "approved" ? "removed" : "approved" });

  const discard = () => {
    if (approved.length === 0) return router.dismissTo("/");
    Alert.alert(`Discard ${approved.length} ${approved.length === 1 ? "item" : "items"}?`, undefined, [
      { text: "Keep reviewing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => router.dismissTo("/") },
    ]);
  };

  if (editingIndex === null) {
    const cardWidth = (width - spacing.sidePad * 2 - 12) / 2;
    return (
      <View style={styles.summaryScreen}>
        <Pressable onPress={discard} hitSlop={12} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
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
              <View key={index} style={[styles.card, { width: cardWidth }, removed && styles.cardRemoved]}>
                <Pressable
                  onPress={() => setEditingIndex(index)}
                  disabled={d.status !== "ready"}
                  accessibilityRole="button"
                  accessibilityLabel={d.title ? `Edit ${d.title}` : "Photo"}
                >
                  <View>
                    <Image source={{ uri: d.uri }} style={styles.cardPhoto} contentFit="cover" transition={0} />
                    {d.status === "loading" && (
                      <View style={styles.cardSpinner}>
                        <ActivityIndicator color={colors.white} />
                      </View>
                    )}
                    {d.status === "ready" && d.priceCents > 0 && (
                      <View style={styles.sticker}>
                        <Text style={styles.stickerText}>{dollars(d.priceCents)}</Text>
                      </View>
                    )}
                    {d.status === "ready" && size !== "" && (
                      <View style={styles.sizeBadge}>
                        <Text style={styles.sizeText} numberOfLines={1}>
                          {size}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {d.status === "failed" ? "Couldn't upload" : d.status === "loading" ? " " : d.title || "Add a title"}
                  </Text>
                  {d.status === "ready" && blockerOf(d) && <Text style={styles.cardFix}>Add {blockerOf(d)}</Text>}
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
                    <Text style={[styles.toggleText, removed && styles.toggleTextOff]}>{removed ? "✕" : "✓"}</Text>
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
  }

  const i = editingIndex;
  const d = drafts[i];
  const loading = d.status === "loading";
  const failed = d.status === "failed";
  const fields = visibleFields(d);
  const aiMarked = (field: Field) => d.aiGenerated && d[field].trim() !== "" && !d.touched.includes(field);
  const anyAi = d.aiGenerated && fields.some(aiMarked);
  const blocker = blockerOf(d);
  const canApprove = d.status === "ready" && !blocker;

  const setField = (field: Field, value: string) =>
    update(i, { [field]: value, touched: d.touched.includes(field) ? d.touched : [...d.touched, field] });

  const openSheet = (field: Field | "description") => {
    Keyboard.dismiss();
    setSheetText(field === "description" ? d.description : field === "brand" && !d.brand ? "" : d[field]);
    setSheet(field);
  };

  const closeSheet = (value?: string) => {
    if (sheet && value !== undefined) {
      if (sheet === "description") update(i, { description: value });
      else setField(sheet, value);
    }
    setSheet(null);
  };

  const done = () => {
    Keyboard.dismiss();
    setEditingIndex(null);
  };

  const remove = () => {
    Keyboard.dismiss();
    update(i, { review: "removed" });
    setEditingIndex(null);
  };

  const sheetOptions = sheet && sheet !== "description" ? FIELD_OPTIONS[sheet] : undefined;
  const sheetChoices =
    sheetOptions && d[sheet as Field] && !sheetOptions.includes(d[sheet as Field])
      ? [d[sheet as Field], ...sheetOptions]
      : sheetOptions;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={done} hitSlop={12} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.counter}>Edit item</Text>
        <Pressable onPress={done} disabled={!canApprove} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.skip, !canApprove && styles.disabled]}>Done</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Pressable onPress={Keyboard.dismiss} accessible={false}>
          <Image key={d.uri} source={{ uri: d.uri }} style={styles.photo} contentFit="cover" transition={0} />
        </Pressable>
        {failed ? (
          <Text style={styles.title}>Couldn't upload this one</Text>
        ) : loading ? (
          <View style={styles.skeleton}>
            <View style={[styles.skeletonBar, { width: "75%" }]} />
            <View style={[styles.skeletonBar, { width: 96, height: 48, borderRadius: 10 }]} />
            <View style={[styles.skeletonBar, { height: 196, borderRadius: 16 }]} />
          </View>
        ) : (
          <>
            {anyAi && (
              <Text style={styles.caveat}>
                <Text style={styles.spark}>✦ </Text>Filled in from your photo. Tap any row to fix.
              </Text>
            )}
            <TextInput
              value={d.title}
              onChangeText={(title) => update(i, { title })}
              placeholder="Add a title"
              placeholderTextColor={colors.muted}
              multiline
              blurOnSubmit
              returnKeyType="done"
              maxLength={80}
              numberOfLines={d.title.length > 26 ? 2 : 1}
              style={styles.title}
              accessibilityLabel="Title"
            />
            <View style={[styles.pricePill, d.priceCents <= 0 && styles.pricePillEmpty]}>
              <TextInput
                accessibilityLabel="Price"
                value={d.priceCents > 0 ? dollars(d.priceCents) : ""}
                selectTextOnFocus
                onFocus={() => {
                  priceFresh.current = true;
                }}
                onChangeText={(text) => {
                  const previous = dollars(d.priceCents);
                  const typed =
                    priceFresh.current && previous && text.startsWith(previous) && text.length > previous.length
                      ? text.slice(previous.length)
                      : text;
                  priceFresh.current = false;
                  update(i, { priceCents: parseDollars(typed) });
                }}
                placeholder="Add price"
                placeholderTextColor={colors.ink}
                keyboardType="number-pad"
                returnKeyType="done"
                style={[
                  styles.priceInput,
                  d.priceCents <= 0 ? styles.priceInputEmpty : { width: 24 + dollars(d.priceCents).length * 18 },
                ]}
              />
            </View>
            <View style={styles.details}>
              {fields.map((field, index) => {
                const value = d[field].trim();
                const required = field === "condition" && !value;
                return (
                  <Pressable
                    key={field}
                    onPress={() => openSheet(field)}
                    style={[styles.row, index > 0 && styles.rowDivider]}
                    accessibilityRole="button"
                    accessibilityLabel={`${FIELD_LABELS[field]}: ${value || (required ? "required" : "add")}`}
                  >
                    <View style={styles.rowLabelWrap}>
                      {required && <View style={styles.requiredDot} />}
                      <Text style={styles.rowLabel}>{FIELD_LABELS[field]}</Text>
                    </View>
                    <Text style={value || field === "brand" ? styles.rowValue : styles.rowAdd} numberOfLines={1}>
                      {aiMarked(field) && <Text style={styles.spark}>✦ </Text>}
                      {value || (field === "brand" && d.aiGenerated ? "No brand" : required ? "Required" : "Add")}
                    </Text>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => openSheet("description")} accessibilityRole="button" style={styles.description}>
              <Text style={styles.descriptionLabel}>Description</Text>
              {d.description ? (
                <>
                  <Text style={styles.descriptionBody} numberOfLines={expanded ? undefined : 2}>
                    {d.description}
                  </Text>
                  {!expanded && d.description.length > 80 && (
                    <Pressable onPress={() => setExpanded(true)} hitSlop={8}>
                      <Text style={styles.more}>more</Text>
                    </Pressable>
                  )}
                </>
              ) : (
                <Text style={styles.rowAdd}>Add</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
      <View style={styles.bottomBar}>
        {keyboardUp && (
          <Pressable onPress={Keyboard.dismiss} hitSlop={10} style={styles.keyboardDone} accessibilityRole="button">
            <Text style={styles.accessoryDone}>Done</Text>
          </Pressable>
        )}
        <Pressable onPress={remove} hitSlop={8} style={styles.remove} accessibilityRole="button">
          <Text style={styles.removeText}>Remove item</Text>
        </Pressable>
        {!failed && (
          <Pressable
            onPress={done}
            disabled={!canApprove}
            style={[styles.approve, !canApprove && styles.disabled]}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.approveText}>
                {blocker
                  ? `Add ${blocker} to save`
                  : `Save · ${dollars(d.priceCents)}`}
              </Text>
            )}
          </Pressable>
        )}
      </View>
      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => closeSheet()}>
        <Pressable style={styles.scrim} onPress={() => closeSheet()} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{sheet === "description" ? "Description" : sheet ? FIELD_LABELS[sheet] : ""}</Text>
            {sheetChoices ? (
              sheetChoices.map((option) => (
                <Pressable key={option} onPress={() => closeSheet(option)} style={styles.sheetOption}>
                  <Text style={styles.sheetOptionText}>{option}</Text>
                  {sheet && sheet !== "description" && d[sheet] === option && <Text style={styles.check}>✓</Text>}
                </Pressable>
              ))
            ) : (
              <>
                <TextInput
                  value={sheetText}
                  onChangeText={setSheetText}
                  placeholder={sheet === "brand" ? "Brand" : sheet === "size" ? "Size, like M or 32x30" : "Description"}
                  placeholderTextColor={colors.muted}
                  multiline={sheet === "description"}
                  autoFocus
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={() => closeSheet(sheetText.trim())}
                  style={[styles.sheetInput, sheet === "description" && styles.sheetInputTall]}
                />
                {sheet === "brand" && (
                  <Pressable onPress={() => closeSheet("")} style={styles.sheetOption}>
                    <Text style={styles.sheetOptionText}>No brand</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => closeSheet(sheetText.trim())} style={styles.approve} accessibilityRole="button">
                  <Text style={styles.approveText}>Save</Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const HAIRLINE = colors.hairline;
const MUTED = colors.muted;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream, paddingTop: 56 },
  summaryScreen: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingTop: 56,
    paddingHorizontal: spacing.sidePad,
    paddingBottom: 34,
    gap: 14,
  },
  flex: { flex: 1 },
  back: { alignSelf: "flex-start", minHeight: 44, justifyContent: "center" },
  backText: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
  headline: { ...type.title, color: colors.ink },
  topBar: {
    height: 44,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  counter: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
  skip: { fontFamily: fonts.medium, fontSize: 15, color: colors.brand },
  body: { padding: 16, gap: 12, paddingBottom: 24 },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: HAIRLINE },
  caveat: { fontFamily: fonts.body, fontSize: 13, color: MUTED },
  spark: { color: colors.brand, fontSize: 12 },
  title: { ...type.itemTitle, color: colors.ink, padding: 0, maxHeight: 60 },
  pricePill: {
    alignSelf: "flex-start",
    backgroundColor: colors.tag,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pricePillEmpty: { backgroundColor: "transparent", borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.ink },
  priceInput: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, color: colors.ink, padding: 0, minWidth: 60 },
  priceInputEmpty: { fontSize: 20, lineHeight: 28, width: 110 },
  details: { backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16 },
  row: { height: 48, flexDirection: "row", alignItems: "center", gap: 8 },
  rowDivider: { borderTopWidth: 1, borderTopColor: HAIRLINE },
  rowLabelWrap: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  requiredDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  rowLabel: { fontFamily: fonts.body, fontSize: 15, color: MUTED },
  rowValue: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, maxWidth: "60%" },
  rowAdd: { fontFamily: fonts.medium, fontSize: 15, color: colors.brand },
  chevron: { fontSize: 20, color: MUTED, width: 16, textAlign: "center" },
  description: { gap: 4 },
  descriptionLabel: { fontFamily: fonts.body, fontSize: 13, color: MUTED },
  descriptionBody: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21, color: colors.ink },
  more: { fontFamily: fonts.medium, fontSize: 15, color: colors.brand },
  skeleton: { gap: 12 },
  skeletonBar: { height: 28, borderRadius: 8, backgroundColor: HAIRLINE },
  bottomBar: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: HAIRLINE,
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 34,
    gap: 4,
  },
  remove: { alignSelf: "center", minHeight: 36, justifyContent: "center" },
  removeText: { fontFamily: fonts.body, fontSize: 14, color: MUTED },
  approve: primaryButton,
  disabled: { opacity: 0.4 },
  approveText: primaryButtonText,
  keyboardDone: { alignSelf: "flex-end", minHeight: 32, justifyContent: "center" },
  accessoryDone: { fontFamily: fonts.semibold, fontSize: 16, color: colors.brand },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    backgroundColor: colors.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: 34,
    gap: 4,
  },
  sheetTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, marginBottom: 8 },
  sheetOption: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  sheetOptionText: { fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  check: { fontSize: 16, color: colors.brand },
  sheetInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.ink,
    marginBottom: 8,
  },
  sheetInputTall: { height: 120, paddingTop: 10, textAlignVertical: "top" },
  muted: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  subline: { ...type.row, color: MUTED, marginTop: -6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingTop: 4, paddingBottom: 12 },
  card: { backgroundColor: colors.white, padding: 6, paddingBottom: 10, gap: 6, borderRadius: 4 },
  cardRemoved: { opacity: 0.45 },
  cardPhoto: { width: "100%", aspectRatio: 1, backgroundColor: HAIRLINE },
  cardSpinner: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(17,17,17,0.25)" },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18, color: colors.ink },
  cardFix: { ...type.meta, color: colors.brand },
  sticker: {
    position: "absolute",
    left: -4,
    bottom: 6,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tag,
    justifyContent: "center",
    transform: [{ rotate: "-4deg" }],
  },
  stickerText: { ...type.listPrice, fontSize: 16, color: colors.ink },
  sizeBadge: {
    position: "absolute",
    right: 6,
    bottom: 6,
    minWidth: 26,
    maxWidth: 72,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: spacing.radius,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  sizeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
  toggle: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: spacing.radius,
    backgroundColor: colors.brand,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleOff: { backgroundColor: colors.white, borderColor: colors.ink },
  toggleText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.white },
  toggleTextOff: { color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.error, textAlign: "center" },
});
