import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { api } from "../../convex/_generated/api";
import { requireUser, signOut, useCurrentUser } from "../lib/useCurrentUser";
import { colors, fonts, spacing } from "../theme";

export const ACCOUNT_BUTTON_INSET = 56;

function PersonCircleIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8}>
      <Circle cx={12} cy={12} r={10} />
      <Circle cx={12} cy={10} r={3.5} />
      <Path d="M5.5 18.5c1.5-2.4 3.8-3.5 6.5-3.5s5 1.1 6.5 3.5" />
    </Svg>
  );
}

export function AccountButton() {
  const user = useCurrentUser();
  const garage = useQuery(api.garages.mine, user ? { ownerId: user.userId } : "skip");
  const [open, setOpen] = useState(false);

  const press = () => {
    if (user) return setOpen(true);
    requireUser("Sign in or create an account").catch(() => {});
  };
  const goYard = () => {
    setOpen(false);
    router.dismissTo("/");
  };
  const doSignOut = async () => {
    setOpen(false);
    await signOut();
    router.dismissTo("/");
  };

  return (
    <>
      <Pressable onPress={press} style={styles.button} accessibilityRole="button" accessibilityLabel={user ? "Account" : "Sign in"}>
        <View style={styles.badge}>
          <PersonCircleIcon size={26} color={colors.ink} />
        </View>
      </Pressable>
      <Modal visible={open && !!user} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheet}>
          <Pressable onPress={() => setOpen(false)} hitSlop={12} style={styles.close} accessibilityRole="button">
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Account</Text>
          <View style={styles.card}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{user?.name || "—"}</Text>
            <View style={styles.divider} />
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{user?.phone || "—"}</Text>
          </View>
          <Pressable onPress={goYard} style={styles.primary} accessibilityRole="button">
            <Text style={styles.primaryText}>{garage ? "Your yard" : "Home"}</Text>
          </Pressable>
          <Pressable onPress={doSignOut} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.secondaryText}>Sign out</Text>
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { position: "absolute", top: ACCOUNT_BUTTON_INSET, right: 8, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  badge: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.cream, alignItems: "center", justifyContent: "center" },
  sheet: { flex: 1, backgroundColor: colors.cream, padding: spacing.sidePad, gap: 16 },
  close: { alignSelf: "flex-end", minHeight: 44, justifyContent: "center" },
  closeText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.brand },
  title: { fontFamily: fonts.display, fontSize: 32, letterSpacing: -1, color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, gap: 4 },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  value: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  divider: { height: 1, backgroundColor: colors.hairline, marginVertical: 10 },
  primary: { height: 60, borderRadius: spacing.radius, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginTop: 8 },
  primaryText: { fontFamily: fonts.display, fontSize: 20, color: colors.white },
  secondary: { height: 52, borderRadius: spacing.radius, borderWidth: 2, borderColor: colors.ink, alignItems: "center", justifyContent: "center" },
  secondaryText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
});
