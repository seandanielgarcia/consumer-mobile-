import { useMutation, useQuery } from "convex/react";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors, fonts, spacing } from "../../src/theme";

export default function SellerPickups() {
  const user = useCurrentUser();
  const items = useQuery(api.items.reservedByOwner, user ? { ownerId: user.userId } : "skip");
  const resolvePickup = useMutation(api.items.resolvePickup);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const resolve = async (itemId: Id<"items">, status: "sold" | "live") => {
    if (!user || busy) return;
    setBusy(true);
    setError(false);
    try {
      await resolvePickup({ ownerId: user.userId, itemId, status });
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" style={styles.button} onPress={() => router.replace("/")}>
        <Text style={styles.link}>← Your garage</Text>
      </Pressable>
      <Text style={styles.heading}>Pickups</Text>
      {!user && <Text style={styles.body}>Sign in to see your pickups.</Text>}
      {user && !items && <ActivityIndicator color={colors.brand} />}
      {items?.length === 0 && <Text style={styles.body}>No items are awaiting pickup.</Text>}
      {error && <Text accessibilityRole="alert" style={styles.body}>Couldn't update the item. Check its status and try again.</Text>}
      {items?.map((item) => (
        <View key={item._id} style={styles.card}>
          <View style={styles.detail}>
            <Image source={{ uri: item.photoUrl }} style={styles.photo} contentFit="cover" />
            <Text style={styles.title}>{item.title}</Text>
          </View>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => void resolve(item._id, "sold")}>
              <Text style={styles.link}>Mark sold</Text>
            </Pressable>
            <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => {
              Alert.alert("Put back for sale?", "Confirm that the pickup and any payment have been resolved before relisting.", [
                { text: "Cancel", style: "cancel" },
                { text: "Relist", onPress: () => void resolve(item._id, "live") },
              ]);
            }}>
              <Text style={styles.link}>Put back for sale</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.cream },
  content: { paddingTop: 56, paddingBottom: 34, paddingHorizontal: spacing.sidePad, gap: 16 },
  heading: { fontFamily: fonts.display, fontSize: 44, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 16, color: colors.muted },
  card: { backgroundColor: colors.white, borderRadius: 18, padding: 16, gap: 8 },
  detail: { flexDirection: "row", alignItems: "center", gap: 12 },
  photo: { width: 56, height: 64, borderRadius: 8, backgroundColor: colors.line },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 20, color: colors.ink },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  button: { minHeight: spacing.minButton, justifyContent: "center", alignSelf: "flex-start" },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: colors.brand },
});
