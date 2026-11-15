import { useAction, useMutation } from "convex/react";
import { Image } from "expo-image";
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
      touched: [],
    })),
  );
  const [order, setOrder] = useState<number[]>(() => getPickedPhotos().map((_, index) => index));
  const [sheet, setSheet] = useState<Field | "description" | null>(null);
  const [sheetText, setSheetText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [undo, setUndo] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const priceFresh = useRef(false);
  const [history, setHistory] = useState<number[]>([]);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = useCurrentUser();
  const [wantsOpen, setWantsOpen] = useState(false);
  const location = useRef<ReturnType<typeof approximateLocation> | null>(null);

  useEffect(() => {
    location.current = approximateLocation();
  }, []);

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

  useEffect(() => {
    if (undo === null) return;
    const timer = setTimeout(() => setUndo(null), 3000);
    return () => clearTimeout(timer);
  }, [undo]);

  const kept = drafts.filter((d) => d.review !== "removed");
  const approved = kept.filter((d) => d.review === "approved");
  const currentIndex =
    editingIndex !== null && drafts[editingIndex].review === "pending"
      ? editingIndex
      : order.find((index) => drafts[index].review === "pending");

  useEffect(() => setExpanded(false), [currentIndex]);

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

  const reopen = (index: number) => {
    update(index, { review: "pending" });
    setUndo(null);
    setEditingIndex(index);
  };

  const goBack = () => {
    Keyboard.dismiss();
    const previous = [...history].reverse().find((index) => drafts[index].review === "approved");
    if (previous !== undefined) return reopen(previous);
    if (kept.length === 0) return router.dismissTo("/");
    Alert.alert(`Discard ${kept.length} ${kept.length === 1 ? "item" : "items"}?`, undefined, [
      { text: "Keep reviewing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => router.dismissTo("/") },
    ]);
  };

  if (currentIndex === undefined) {
    return (
      <View style={styles.summaryScreen}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.back}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.headline}>Ready to go</Text>
        <Text style={styles.subline}>
          {approved.length} {approved.length === 1 ? "item" : "items"} · {dollars(approved.reduce((sum, d) => sum + d.priceCents, 0)) || "$0"}
        </Text>
        <ScrollView style={styles.flex} contentContainerStyle={styles.summaryContent} keyboardShouldPersistTaps="handled">
          {approved.length === 0 ? (
            <Text style={styles.muted}>Nothing approved yet</Text>
          ) : (
            <View style={styles.summaryList}>
              {drafts.map((d, index) => ({ d, index }))
                .filter(({ d }) => d.review === "approved")
                .map(({ d, index }, row) => (
                  <Pressable
                    key={d.uri}
                    onPress={() => reopen(index)}
                    style={[styles.summaryRow, row > 0 && styles.rowDivider]}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${d.title}`}
                  >
                    <Image source={{ uri: d.uri }} style={styles.thumb} contentFit="cover" />
                    <View style={styles.summaryText}>
                      <Text style={styles.summaryTitle} numberOfLines={1}>
                        {d.title}
                      </Text>
                      <Text style={styles.summaryMeta} numberOfLines={1}>
                        {[d.condition.trim(), d.size.trim() && `Size ${d.size.trim()}`, d.brand.trim()].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Text style={styles.summaryPrice}>{dollars(d.priceCents)}</Text>
                  </Pressable>
                ))}
            </View>
          )}
        </ScrollView>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          onPress={openGarage}
          disabled={approved.length === 0 || opening}
          style={[styles.approve, (approved.length === 0 || opening) && styles.disabled]}
          accessibilityRole="button"
        >
          {opening ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.approveText}>
              Open my yard
            </Text>
          )}
        </Pressable>
      </View>
    );
  }

  const i = currentIndex;
  const d = drafts[i];
  const loading = d.status === "loading";
  const failed = d.status === "failed";
  const fields = visibleFields(d);
  const aiMarked = (field: Field) => d.aiGenerated && d[field].trim() !== "" && !d.touched.includes(field);
  const anyAi = d.aiGenerated && fields.some(aiMarked);
  const blocker = !d.condition.trim() ? "condition" : !d.title.trim() ? "title" : d.priceCents <= 0 ? "price" : null;
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

  const editing = editingIndex === i;

  const approve = () => {
    Keyboard.dismiss();
    update(i, { review: "approved" });
    if (editing) setEditingIndex(null);
    else setUndo(i);
    setHistory((prev) => [...prev.filter((index) => index !== i), i]);
  };

  const skip = () => {
    Keyboard.dismiss();
    setOrder((prev) => [...prev.filter((index) => index !== i), i]);
  };

  const remove = () => {
    Keyboard.dismiss();
    update(i, { review: "removed" });
    if (editing) setEditingIndex(null);
  };

  const undoApprove = () => {
    if (undo === null) return;
    update(undo, { review: "pending" });
    setOrder((prev) => [undo, ...prev.filter((index) => index !== undo)]);
    setUndo(null);
  };

  const sheetOptions = sheet && sheet !== "description" ? FIELD_OPTIONS[sheet] : undefined;
  const sheetChoices =
    sheetOptions && d[sheet as Field] && !sheetOptions.includes(d[sheet as Field])
      ? [d[sheet as Field], ...sheetOptions]
      : sheetOptions;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.topBar}>
        <Pressable onPress={goBack} hitSlop={12} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.counter}>{editing ? "Edit item" : `${approved.length + 1} of ${kept.length}`}</Text>
        {editing ? (
          <Pressable onPress={approve} disabled={!canApprove} hitSlop={12} accessibilityRole="button">
            <Text style={[styles.skip, !canApprove && styles.disabled]}>Done</Text>
          </Pressable>
        ) : (
          <Pressable onPress={skip} hitSlop={12} accessibilityRole="button">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>
      {!editing && (
        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${((approved.length + 1) / Math.max(kept.length, 1)) * 100}%` }]}
          />
        </View>
      )}
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
        {undo !== null && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>Approved</Text>
            <Pressable onPress={undoApprove} hitSlop={10} accessibilityRole="button">
              <Text style={styles.toastUndo}>Undo</Text>
            </Pressable>
          </View>
        )}
        <Pressable onPress={remove} hitSlop={8} style={styles.remove} accessibilityRole="button">
          <Text style={styles.removeText}>Remove item</Text>
        </Pressable>
        {!failed && (
          <Pressable
            onPress={approve}
            disabled={!canApprove}
            style={[styles.approve, !canApprove && styles.disabled]}
            accessibilityRole="button"
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.approveText}>
                {blocker
                  ? `Add ${blocker} to ${editing ? "save" : "approve"}`
                  : `${editing ? "Save" : "Approve"} · ${dollars(d.priceCents)}`}
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
  progressTrack: { height: 4, marginHorizontal: 16, borderRadius: 2, backgroundColor: HAIRLINE, overflow: "hidden" },
  progressFill: { height: 4, backgroundColor: colors.brand },
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
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    top: -56,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.ink,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toastText: { fontFamily: fonts.medium, fontSize: 15, color: colors.white },
  toastUndo: { fontFamily: fonts.semibold, fontSize: 15, color: colors.tag },
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
  summaryContent: { paddingBottom: 12 },
  summaryList: { backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 12 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: HAIRLINE },
  summaryText: { flex: 1, gap: 2 },
  summaryTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  summaryMeta: { ...type.meta, color: MUTED },
  summaryPrice: { fontFamily: fonts.display, fontSize: 18, color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.error, textAlign: "center" },
});
