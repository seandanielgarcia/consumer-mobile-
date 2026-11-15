import { useAction, useQuery } from "convex/react";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../convex/_generated/api";
import { useCurrentUser } from "../src/lib/useCurrentUser";
import { colors, fonts, spacing } from "../src/theme";

export default function Premium() {
  const user = useCurrentUser();
  const premium = useQuery(api.users.isPremium, user ? { userId: user.userId } : "skip");
  const createCheckout = useAction(api.whop.createCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unlock = async () => {
    if (!user || premium !== false) return;
    setBusy(true);
    setError(null);
    try {
      const purchaseUrl = await createCheckout({ userId: user.userId });
      await WebBrowser.openBrowserAsync(purchaseUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>
      <Text style={styles.headline}>{premium ? "You're premium." : "Go premium."}</Text>
      <Text style={styles.body}>
        {premium ? "Thanks for supporting Garage Sale." : "One-time $5. Unlock everything Garage Sale has to offer."}
      </Text>
      {!user && <Text style={styles.error}>Sign in first.</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      {!premium && (
        <Pressable
          style={[styles.cta, (premium !== false || busy) && styles.ctaDisabled]}
          onPress={unlock}
          disabled={premium !== false || busy}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color={colors.cream} /> : <Text style={styles.ctaText}>Unlock premium · $5</Text>}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: spacing.sidePad,
    paddingTop: spacing.topPad,
    paddingBottom: 34,
    gap: 16,
  },
  back: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  headline: { fontFamily: fonts.display, fontSize: 34, color: colors.ink, letterSpacing: -1 },
  body: { fontFamily: fonts.body, fontSize: 16, color: colors.muted, lineHeight: 22, flexGrow: 1 },
  error: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  cta: {
    height: spacing.cta,
    borderRadius: spacing.radius,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontFamily: fonts.semibold, fontSize: 18, color: colors.cream },
});
