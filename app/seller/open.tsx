import { useQuery } from "convex/react";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { textKeiki } from "../../src/lib/keiki";
import { formatPlace } from "../../src/lib/place";
import { colors, fonts, spacing } from "../../src/theme";

const ROTATIONS = ["-5deg", "2deg", "-1deg"];

export default function SellerOpen() {
  const { garageId, picked, first } = useLocalSearchParams<{ garageId: Id<"garages">; picked?: string; first?: string }>();
  const garage = useQuery(api.garages.get, { garageId });
  const all = useQuery(api.items.byGarage, { garageId }) ?? [];

  const live = all.filter((item) => item.status === "live");
  const pickedIds = picked ? picked.split(",") : [];
  const added = pickedIds.flatMap((id) => all.filter((item) => item._id === id));
  const extra = added.length - 3;
  const firstOpen = first === "1";

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.headline}>{firstOpen ? "Your yard is open." : "Added to your yard."}</Text>
        <Text style={styles.meta}>
          {firstOpen
            ? garage
              ? formatPlace(garage)
              : " "
            : `${pickedIds.length} new · ${live.length} ${live.length === 1 ? "item" : "items"} for sale`}
        </Text>
        <View style={styles.polaroids}>
          {added.slice(0, 3).map((item, index) => (
            <View key={item._id} style={[styles.polaroid, { transform: [{ rotate: ROTATIONS[index] }] }]}>
              <Image source={{ uri: item.photoUrl }} style={styles.polaroidPhoto} contentFit="cover" />
              <View style={styles.sticker}>
                <Text style={styles.stickerText}>${Math.round(item.priceCents / 100)}</Text>
              </View>
            </View>
          ))}
        </View>
        {extra > 0 && <Text style={styles.moreLine}>+{extra} more in your yard</Text>}
      </View>
      <Pressable style={styles.donePill} accessibilityRole="button" onPress={() => router.dismissTo("/")}>
        <Text style={styles.donePillText}>Done</Text>
      </Pressable>
      <Pressable onPress={textKeiki} accessibilityRole="button" style={styles.keiki}>
        <Text style={styles.keikiText}>More later? Text Keiki a pic and a price.</Text>
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
    gap: 12,
  },
  content: { flex: 1, justifyContent: "center", gap: 20 },
  headline: { fontFamily: fonts.display, fontSize: 44, lineHeight: 43, letterSpacing: -1.5, color: colors.cream },
  meta: { fontFamily: fonts.body, fontSize: 17, color: colors.cream, marginTop: -8 },
  polaroids: { flexDirection: "row", justifyContent: "center", gap: 10, paddingVertical: 12 },
  polaroid: { width: 108, backgroundColor: colors.white, padding: 6, paddingBottom: 20 },
  polaroidPhoto: { height: 132, backgroundColor: colors.line },
  sticker: {
    position: "absolute",
    left: -4,
    bottom: 8,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.tag,
    justifyContent: "center",
  },
  stickerText: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },
  moreLine: { fontFamily: fonts.body, fontSize: 15, color: colors.cream, textAlign: "center" },
  donePill: {
    height: 56,
    borderRadius: spacing.radius,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  donePillText: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  keiki: { minHeight: spacing.minButton, alignItems: "center", justifyContent: "center" },
  keikiText: { fontFamily: fonts.medium, fontSize: 15, color: colors.cream, textDecorationLine: "underline" },
});
