import { useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../convex/_generated/api";
import { setPickedPhotos } from "../src/lib/pickedPhotos";
import { useCurrentUser } from "../src/lib/useCurrentUser";
import { colors, fonts, spacing } from "../src/theme";

const POLAROID_POSITIONS = [
  { left: 8, top: 18, transform: [{ rotate: "-8deg" }] },
  { left: 92, top: 0, transform: [{ rotate: "4deg" }] },
  { left: 176, top: 22, transform: [{ rotate: "-3deg" }] },
  { left: 236, top: 4, transform: [{ rotate: "7deg" }] },
];

export default function Landing() {
  const user = useCurrentUser();
  const mine = useQuery(api.garages.mine, user ? { ownerId: user.userId } : "skip");
  const samples = useQuery(api.items.sampleLive) ?? [];

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
      <View style={styles.block}>
        <Text style={styles.wordmark}>garage sale</Text>
        <Text style={styles.tagline}>Share a photo and set a price, we'll take care of the rest</Text>
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
          <Pressable style={styles.button} onPress={pickPhotos} accessibilityRole="button">
            <Text style={styles.buttonText}>Sell your stuff</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => router.push("/buyer")} accessibilityRole="button">
            <Text style={styles.buttonText}>Shop near you</Text>
          </Pressable>
        </View>
        {mine && mine.items.length > 0 && (
          <Pressable
            style={styles.garageRow}
            onPress={() => router.push({ pathname: "/seller/open", params: { garageId: mine.garage._id } })}
          >
            <Text style={styles.garageRowText}>Your garage · {mine.items.length} live</Text>
            <Text style={styles.garageRowText}>→</Text>
          </Pressable>
        )}
      </View>
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
  garageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: spacing.minButton,
    paddingHorizontal: 4,
  },
  garageRowText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.cream },
  tagline: { fontFamily: fonts.body, fontSize: 17, lineHeight: 23, color: colors.cream },
  button: {
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontFamily: fonts.display, fontSize: 24, color: colors.ink },
});
