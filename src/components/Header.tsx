import type { ReactNode } from "react";
import { ActionSheetIOS, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { requireUser, signOut, useCurrentUser } from "../lib/useCurrentUser";
import { colors, sys } from "../theme";

export function Header({ onBack, title, right, background = colors.cream }: { onBack?: () => void; title?: string; right?: ReactNode; background?: string }) {
  const top = useSafeAreaInsets().top;
  const user = useCurrentUser();

  const openAccount = () => {
    if (!user) {
      requireUser("Sign in").catch(() => undefined);
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      { title: user.name ?? "Signed in", options: ["Sign out", "Close"], destructiveButtonIndex: 0, cancelButtonIndex: 1 },
      (index) => {
        if (index === 0) void signOut();
      },
    );
  };

  return (
    <View style={{ paddingTop: top, paddingHorizontal: 20, backgroundColor: background }}>
      <View style={{ height: 56, flexDirection: "row", alignItems: "center", gap: 8 }}>
        {onBack && (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" style={{ width: 44, height: 44, marginLeft: -12, alignItems: "center", justifyContent: "center" }}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 5l-7 7 7 7" />
            </Svg>
          </Pressable>
        )}
        <Text numberOfLines={1} style={{ ...sys.header, flex: 1 }}>
          {title ?? ""}
        </Text>
        {right}
        <Pressable
          onPress={openAccount}
          accessibilityRole="button"
          accessibilityLabel={user ? `Account, ${user.name ?? ""}` : "Sign in"}
          style={{ width: 44, height: 44, marginRight: -6, alignItems: "center", justifyContent: "center" }}
        >
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: user ? colors.brand : colors.line, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ ...sys.button, fontSize: 15, color: colors.white }}>{user?.name?.trim().charAt(0).toUpperCase() ?? ""}</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}
