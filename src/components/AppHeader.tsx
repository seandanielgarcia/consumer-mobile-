import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";
import { api } from "../../convex/_generated/api";
import { guardedLeave } from "../lib/headerBack";
import { requireUser, signOut, useCurrentUser } from "../lib/useCurrentUser";
import { pinFor } from "../buyer/pins";
import { colors, fonts, spacing } from "../theme";

function PersonCircleIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Circle cx={12} cy={12} r={10} />
      <Circle cx={12} cy={10} r={3.5} />
      <Path d="M5.5 18.5c1.5-2.4 3.8-3.5 6.5-3.5s5 1.1 6.5 3.5" />
    </Svg>
  );
}

// Rendered as each screen's own header, so it moves with the screen during push, pop and swipe-back.
export function AppHeader({ landing = false, onBack }: { landing?: boolean; onBack?: () => void }) {
  const insets = useSafeAreaInsets();
  const user = useCurrentUser();
  const garage = useQuery(api.garages.mine, user ? { ownerId: user.userId } : "skip");
  const [open, setOpen] = useState(false);
  const pin = user ? pinFor(user.userId) : null;

  const press = () => {
    if (user) return setOpen(true);
    requireUser("Sign in or create an account").catch(() => {});
  };
  const leave = (then: () => void) => {
    setOpen(false);
    guardedLeave(then);
  };
  const goYard = () => leave(() => router.dismissTo("/"));
  const doSignOut = () =>
    leave(async () => {
      await signOut();
      router.dismissTo("/");
    });

  return (
    <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: colors.cream }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        {!landing && !onBack && (
          <View style={[styles.wordmarkSlot, styles.wordmarkLeft]} pointerEvents="box-none">
            <Pressable onPress={() => guardedLeave(() => router.dismissTo("/"))} hitSlop={8} accessibilityRole="link" accessibilityLabel="yardsale, Home">
              <Text style={styles.wordmark}>yardsale</Text>
            </Pressable>
          </View>
        )}
        <Pressable onPress={press} style={styles.account} accessibilityRole="button" accessibilityLabel={user ? "Account" : "Sign in"}>
          {user ? (
            <View style={[styles.avatar, { backgroundColor: pin?.bg ?? colors.tag }]}>
              <Text style={[styles.initial, { color: pin?.fg ?? colors.ink }]}>{(user.name ?? "?").charAt(0).toUpperCase()}</Text>
            </View>
          ) : (
            <PersonCircleIcon size={32} color={colors.ink} />
          )}
        </Pressable>
      </View>
      <Modal visible={open && !!user} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setOpen(false)} hitSlop={12} style={styles.close} accessibilityRole="button">
              <Text style={styles.closeText}>Close</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>Account</Text>
            <View style={styles.close} />
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{user?.name || "—"}</Text>
            <View style={styles.divider} />
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{user?.phone || "—"}</Text>
          </View>
          <Pressable onPress={goYard} style={styles.row} accessibilityRole="button">
            <Text style={styles.value}>{garage ? "Your yard" : "Home"}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable onPress={() => leave(() => router.push("/buyer/purchases"))} style={styles.row} accessibilityRole="button">
            <Text style={styles.value}>My purchases</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          {garage && (
            <Pressable onPress={() => leave(() => router.push(`/buyer/garage/${garage.garage._id}`))} style={styles.row} accessibilityRole="button">
              <Text style={styles.value}>View as buyer</Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          <View style={styles.flex} />
          <Pressable onPress={doSignOut} hitSlop={8} style={styles.signOut} accessibilityRole="button">
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { paddingHorizontal: spacing.sidePad - 4 },
  row: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordmark: { ...fonts.wordmark, fontSize: 22, letterSpacing: -0.6, color: colors.ink },
  wordmarkSlot: { position: "absolute", top: 0, bottom: 0, justifyContent: "center" },
  wordmarkLeft: { left: 0 },
  back: { minHeight: 44, justifyContent: "center", paddingRight: 12 },
  backText: { ...fonts.semibold, fontSize: 17, color: colors.brand },
  account: { width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" },
  avatar: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.white, alignItems: "center", justifyContent: "center", shadowColor: colors.shadow, shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  initial: { fontSize: 15, fontWeight: "800", color: colors.ink },
  sheet: { flex: 1, backgroundColor: colors.cream, paddingHorizontal: spacing.sidePad, paddingBottom: 40, gap: 12 },
  sheetHeader: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { minWidth: 56, minHeight: 44, justifyContent: "center" },
  closeText: { ...fonts.semibold, fontSize: 17, color: colors.brand },
  sheetTitle: { ...fonts.semibold, fontSize: 17, color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: spacing.card, padding: 16, gap: 4, shadowColor: colors.shadow, shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 8 } },
  label: { ...fonts.medium, fontSize: 13, color: colors.muted },
  value: { ...fonts.body, fontSize: 17, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 10 },
  chevron: { fontSize: 22, color: colors.muted },
  flex: { flex: 1 },
  signOut: { alignSelf: "center", minHeight: 44, justifyContent: "center" },
  signOutText: { ...fonts.semibold, fontSize: 17, color: colors.destructive },
});
