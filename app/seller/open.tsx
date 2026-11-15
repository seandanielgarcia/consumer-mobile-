import { useQuery } from "convex/react";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ChatIcon } from "../../src/components/icons";
import { colors, fonts, spacing } from "../../src/theme";

const ROTATIONS = ["-5deg", "2deg", "-1deg"];

export default function SellerOpen() {
  const { garageId, picked, first } = useLocalSearchParams<{ garageId: Id<"garages">; picked?: string; first?: string }>();
  const garage = useQuery(api.garages.get, { garageId });
  const live = useQuery(api.items.liveByGarage, { garageId }) ?? [];
  const pickedIds = picked ? picked.split(",") : [];
  const items = pickedIds.length
    ? pickedIds.flatMap((id) => live.filter((item) => item._id === id))
    : live.slice(0, 3);

  return (
    <View style={styles.screen}>
      <Text style={styles.meta}>{garage ? `${garage.neighborhood} · visible within about 2 mi` : " "}</Text>
      <Text style={styles.headline}>Your garage is open.</Text>
      <View style={styles.polaroids}>
        {items.slice(0, 3).map((item, index) => (
          <View key={item._id} style={[styles.polaroid, { transform: [{ rotate: ROTATIONS[index] }] }]}>
            <Image source={{ uri: item.photoUrl }} style={styles.polaroidPhoto} contentFit="cover" />
            <Text style={styles.polaroidPrice}>${Math.round(item.priceCents / 100)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.spacer} />
      {first === "1" && (
        <View style={styles.keiki}>
          <View style={styles.keikiHeader}>
            <View style={styles.chatCircle}>
              <ChatIcon size={20} color={colors.ink} />
            </View>
            <Text style={styles.keikiTitle} numberOfLines={1}>
              More later? Text Keiki
            </Text>
          </View>
          <Pressable
            style={styles.saveButton}
            accessibilityRole="button"
            onPress={() =>
              Linking.openURL(
                `sms:+17796251378&body=${encodeURIComponent("hey keiki, i have a few things to add to my garage (K-FERUEU)")}`,
              )
            }
          >
            <Text style={styles.saveText}>Save Keiki to contacts</Text>
          </Pressable>
        </View>
      )}
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
  },
  meta: { fontFamily: fonts.body, fontSize: 15, color: colors.cream },
  headline: { fontFamily: fonts.display, fontSize: 44, lineHeight: 43, letterSpacing: -1.5, color: colors.cream },
  polaroids: { flexDirection: "row", justifyContent: "center", gap: 10, paddingVertical: 12 },
  polaroid: { width: 100, backgroundColor: colors.white, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 10, gap: 6 },
  polaroidPhoto: { height: 110, backgroundColor: colors.line },
  polaroidPrice: { fontFamily: fonts.display, fontSize: 15, color: colors.ink },
  spacer: { flex: 1 },
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
  saveButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.cream },
});
