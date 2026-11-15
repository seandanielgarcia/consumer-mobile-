import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ActionSheetIOS, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { ChatIcon } from "../../src/components/icons";
import { textKeiki } from "../../src/lib/keiki";
import { shareYard } from "../../src/lib/shareYard";
import { useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors, fonts, spacing } from "../../src/theme";

const ROTATIONS = ["-5deg", "2deg", "-1deg"];

export default function SellerOpen() {
  const { garageId, picked, first } = useLocalSearchParams<{ garageId: Id<"garages">; picked?: string; first?: string }>();
  const user = useCurrentUser();
  const garage = useQuery(api.garages.get, { garageId });
  const all = useQuery(api.items.byGarage, { garageId }) ?? [];
  const setStatus = useMutation(api.items.setStatus);
  const [error, setError] = useState<string | null>(null);

  const sold = all.filter((item) => item.status === "sold");
  const shown = all.filter((item) => item.status !== "sold");
  const pickedIds = picked ? picked.split(",") : [];
  const items = pickedIds.length ? pickedIds.flatMap((id) => shown.filter((item) => item._id === id)) : shown;
  const extra = items.length - 3;

  const change = async (item: Doc<"items">, status: "sold" | "live") => {
    if (!user) return;
    try {
      setError(null);
      await setStatus({ itemId: item._id, ownerId: user.userId, status });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update that item.");
    }
  };

  const openActions = (item: Doc<"items">) => {
    if (item.status !== "reserved") return;
    ActionSheetIOS.showActionSheetWithOptions(
      { title: item.title, options: ["Picked up (sold)", "Put back", "Cancel"], cancelButtonIndex: 2 },
      (index) => {
        if (index === 0) change(item, "sold");
        if (index === 1) change(item, "live");
      },
    );
  };

  const relistSold = () => {
    if (sold.length === 0) return;
    ActionSheetIOS.showActionSheetWithOptions(
      { title: "Put back on sale", options: [...sold.map((item) => item.title), "Cancel"], cancelButtonIndex: sold.length },
      (index) => {
        const item = sold[index];
        if (item) change(item, "live");
      },
    );
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.headline}>Your yard is open.</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>{garage ? `${garage.neighborhood} · visible to buyers nearby` : " "}</Text>
        {sold.length > 0 && (
          <Pressable
            onPress={relistSold}
            accessibilityRole="button"
            accessibilityLabel={`${sold.length} sold. Tap to put one back on sale.`}
            style={styles.soldButton}
          >
            <Text style={styles.soldText}>{sold.length} sold</Text>
          </Pressable>
        )}
      </View>
      <View style={styles.polaroids}>
        {items.slice(0, 3).map((item, index) => {
          const reserved = item.status === "reserved";
          return (
            <Pressable
              key={item._id}
              onLongPress={() => openActions(item)}
              disabled={!reserved}
              accessibilityRole={reserved ? "button" : undefined}
              accessibilityLabel={reserved ? `${item.title}, reserved. Long press for actions.` : item.title}
              style={[styles.polaroid, { transform: [{ rotate: ROTATIONS[index] }] }]}
            >
              <Image source={{ uri: item.photoUrl }} style={styles.polaroidPhoto} contentFit="cover" />
              <View style={styles.polaroidFooter}>
                <View style={[styles.sticker, reserved ? styles.stickerReserved : styles.stickerPrice]}>
                  <Text style={[styles.stickerText, reserved && styles.stickerTextReserved]}>
                    {reserved ? "Reserved" : `$${Math.round(item.priceCents / 100)}`}
                  </Text>
                </View>
                {reserved && (
                  <Pressable
                    onPress={() => openActions(item)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={`Actions for ${item.title}`}
                    style={styles.moreButton}
                  >
                    <Text style={styles.moreButtonText}>…</Text>
                  </Pressable>
                )}
              </View>
              {index === 2 && extra > 0 && (
                <View style={styles.more}>
                  <Text style={styles.moreText}>+{extra}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      {first === "1" && (
        <View style={styles.keiki}>
          <View style={styles.keikiHeader}>
            <View style={styles.chatCircle}>
              <ChatIcon size={20} color={colors.ink} />
            </View>
            <Text style={styles.keikiTitle}>More later? Text Keiki a pic and a price.</Text>
          </View>
          <Pressable style={styles.secondaryPill} accessibilityRole="button" onPress={textKeiki}>
            <Text style={styles.secondaryPillText}>Text Keiki</Text>
          </Pressable>
        </View>
      )}
      <Pressable style={styles.sharePill} accessibilityRole="button" onPress={() => shareYard(garageId, user?.name)}>
        <Text style={styles.sharePillText}>Share my yard with a friend</Text>
      </Pressable>
      <Pressable style={styles.donePill} accessibilityRole="button" onPress={() => router.dismissTo("/")}>
        <Text style={styles.donePillText}>Done</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.brand,
    paddingTop: 60,
    paddingHorizontal: spacing.sidePad,
    paddingBottom: 34,
    gap: 20,
    justifyContent: "center",
  },
  headline: { fontFamily: fonts.display, fontSize: 44, lineHeight: 43, letterSpacing: -1.5, color: colors.cream },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", minHeight: spacing.minButton },
  meta: { fontFamily: fonts.body, fontSize: 15, color: colors.cream },
  soldButton: {
    minHeight: spacing.minButton,
    justifyContent: "center",
    marginLeft: 10,
    paddingHorizontal: 16,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.cream,
  },
  soldText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.cream },
  polaroids: { flexDirection: "row", justifyContent: "center", gap: 10, paddingVertical: 12 },
  polaroid: { width: 108, minHeight: spacing.minButton, backgroundColor: colors.white, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 8, gap: 6 },
  polaroidPhoto: { height: 132, backgroundColor: colors.line },
  polaroidFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 28 },
  sticker: { paddingHorizontal: 8, height: 28, borderRadius: 8, borderWidth: 2, borderColor: colors.ink, justifyContent: "center" },
  stickerPrice: { backgroundColor: colors.tag },
  stickerReserved: { backgroundColor: colors.ink },
  stickerText: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },
  stickerTextReserved: { color: colors.cream },
  moreButton: {
    minWidth: 32,
    minHeight: 24,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  moreButtonText: { fontFamily: fonts.display, fontSize: 16, lineHeight: 18, color: colors.ink },
  more: {
    position: "absolute",
    top: -10,
    right: -10,
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 6,
    backgroundColor: colors.tag,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  moreText: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.cream },
  keiki: { backgroundColor: colors.cream, borderRadius: 24, padding: 20, gap: 12 },
  keikiHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  chatCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.tag,
    alignItems: "center",
    justifyContent: "center",
  },
  keikiTitle: { flex: 1, fontFamily: fonts.display, fontSize: 17, color: colors.ink },
  secondaryPill: {
    height: 52,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryPillText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  sharePill: {
    height: spacing.cta,
    borderRadius: spacing.radius,
    borderWidth: 2,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  sharePillText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.cream },
  donePill: {
    height: spacing.cta,
    borderRadius: spacing.radius,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  donePillText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.ink },
});
