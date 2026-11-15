import { useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../convex/_generated/api";
import { CameraIcon, SparkleIcon } from "../src/components/icons";
import { setPickedPhotos } from "../src/lib/pickedPhotos";
import { useCurrentUser } from "../src/lib/useCurrentUser";
import { colors, fonts, spacing } from "../src/theme";

export default function SellerHome() {
  const user = useCurrentUser();
  const mine = useQuery(api.garages.mine, user ? { ownerId: user.userId } : "skip");
  const items = mine?.items ?? [];

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 0,
      quality: 0.6,
    });
    if (result.canceled || result.assets.length === 0) return;
    setPickedPhotos(result.assets.map((asset) => asset.uri));
    router.push("/seller/price");
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.wordmark}>garage sale</Text>
      <Text style={styles.headline}>Clear your closet. Sell to people around you.</Text>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Your garage</Text>
          <Text style={styles.cardMeta}>{items.length === 0 ? "empty" : `${items.length} live`}</Text>
        </View>
        {items.length > 0 && (
          <View style={styles.items}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.itemRow}>
              {items.map((item) => (
                <View key={item._id} style={styles.thumb}>
                  <Image source={{ uri: item.photoUrl }} style={styles.thumbPhoto} contentFit="cover" />
                  <Text style={styles.thumbPrice}>${Math.round(item.priceCents / 100)}</Text>
                </View>
              ))}
            </ScrollView>
            <Pressable onPress={() => router.push("/buyer")} hitSlop={8}>
              <Text style={styles.browseNear}>Browse near you</Text>
            </Pressable>
          </View>
        )}
        <Pressable style={styles.dropZone} onPress={pickPhotos} accessibilityRole="button">
          <View style={styles.cameraCircle}>
            <CameraIcon size={30} color={colors.ink} />
          </View>
          <Text style={styles.dropTitle}>Add photos in bulk</Text>
          <Text style={styles.dropSub}>Pick 5, 20, 50 at once from your camera roll</Text>
        </Pressable>
        <View style={styles.aiStrip}>
          <SparkleIcon size={22} color={colors.tag} />
          <Text style={styles.aiStripText}>
            Share a photo and set a price, <Text style={styles.aiStripStrong}>we'll take care of the rest.</Text>
          </Text>
        </View>
      </View>
      <Pressable style={styles.footer} onPress={() => router.push("/buyer")}>
        <Text style={styles.footerText}>Just looking? Shop near you</Text>
        <Text style={styles.footerLink}>Browse</Text>
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
    gap: 22,
  },
  wordmark: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.5, color: colors.cream },
  headline: { fontFamily: fonts.display, fontSize: 44, lineHeight: 43, letterSpacing: -1.5, color: colors.cream },
  card: { flex: 1, backgroundColor: colors.cream, borderRadius: 24, padding: 20, gap: 14 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  cardMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  items: { gap: 8 },
  itemRow: { gap: 8 },
  thumb: { width: 64, backgroundColor: colors.white, padding: 4, paddingBottom: 6, gap: 4 },
  thumbPhoto: { width: 56, height: 64 },
  thumbPrice: { fontFamily: fonts.display, fontSize: 13, color: colors.ink },
  browseNear: { fontFamily: fonts.semibold, fontSize: 14, color: colors.brand, textDecorationLine: "underline" },
  dropZone: {
    flex: 1,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.line,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
  },
  cameraCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.tag,
    alignItems: "center",
    justifyContent: "center",
  },
  dropTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink, textAlign: "center" },
  dropSub: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, textAlign: "center" },
  aiStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.ink,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  aiStripText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 19, color: colors.cream },
  aiStripStrong: { fontFamily: fonts.semibold },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: spacing.minButton },
  footerText: { fontFamily: fonts.body, fontSize: 15, color: colors.cream },
  footerLink: { fontFamily: fonts.semibold, fontSize: 15, color: colors.cream, textDecorationLine: "underline" },
});
