import { useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../convex/_generated/api";
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
      <View style={styles.block}>
        <Text style={styles.wordmark}>garage sale</Text>
        <Text style={styles.tagline}>Share a photo and set a price, we'll take care of the rest</Text>
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
  buttons: { gap: 12, marginTop: 20 },
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
