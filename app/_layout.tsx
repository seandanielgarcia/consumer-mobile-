import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { AppHeader } from "../src/components/AppHeader";
import { loadCurrentUser, useCurrentUserLoaded } from "../src/lib/useCurrentUser";
import { colors } from "../src/theme";

export const unstable_settings = { initialRouteName: "index" };

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  const userLoaded = useCurrentUserLoaded();
  useEffect(() => {
    loadCurrentUser();
  }, []);
  if (!userLoaded) return null;
  return (
    <ConvexProvider client={convex}>
      <View style={{ flex: 1, backgroundColor: colors.cream }}>
        <AppHeader />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}>
        <Stack.Screen name="signin" options={{ presentation: "modal" }} />
        <Stack.Screen name="buyer/paid" options={{ gestureEnabled: false }} />
        <Stack.Screen name="seller/price" options={{ gestureEnabled: false }} />
        <Stack.Screen name="seller/open" options={{ gestureEnabled: false }} />
        </Stack>
      </View>
    </ConvexProvider>
  );
}
