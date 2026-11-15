import { useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../convex/_generated/api";
import { CameraIcon } from "../src/components/icons";
import { setPickedPhotos } from "../src/lib/pickedPhotos";
import { useCurrentUser } from "../src/lib/useCurrentUser";
import { colors, fonts, spacing } from "../src/theme";

export default function Landing() {
  const user = useCurrentUser();
  const mine = useQuery(api.garages.mine, user ? { ownerId: user.userId } : "skip");

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
      <View style={styles.spacer} />
      {mine && mine.items.length > 0 && (
        <Pressable
          style={styles.garageRow}
          onPress={() => router.push({ pathname: "/seller/open", params: { garageId: mine.garage._id } })}
        >
          <Text style={styles.garageRowText}>Your garage · {mine.items.length} live</Text>
          <Text style={styles.garageRowText}>→</Text>
        </Pressable>
      )}
      <Pressable style={styles.sell} onPress={pickPhotos} accessibilityRole="button">
        <View style={styles.cameraCircle}>
          <CameraIcon size={30} color={colors.ink} />
        </View>
        <Text style={styles.sellText}>Sell your stuff</Text>
      </Pressable>
      <Pressable style={styles.shop} onPress={() => router.push("/buyer")} accessibilityRole="button">
        <Text style={styles.shopText}>Shop near you</Text>
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
    gap: 14,
  },
  wordmark: { fontFamily: fonts.display, fontSize: 44, letterSpacing: -1.5, color: colors.cream },
  spacer: { flex: 1 },
  garageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: spacing.minButton,
    paddingHorizontal: 4,
  },
  garageRowText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.cream },
  sell: {
    height: 180,
    borderRadius: 28,
    backgroundColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  cameraCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.tag,
    alignItems: "center",
    justifyContent: "center",
  },
  sellText: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  shop: {
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: colors.cream,
    alignItems: "center",
    justifyContent: "center",
  },
  shopText: { fontFamily: fonts.display, fontSize: 22, color: colors.cream },
});
