import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Stack } from "expo-router";
import { useFonts, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { useEffect } from "react";
import { loadCurrentUser, useCurrentUserLoaded } from "../src/lib/useCurrentUser";
import { colors } from "../src/theme";

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  const [loaded] = useFonts({
    BricolageGrotesque_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const userLoaded = useCurrentUserLoaded();
  useEffect(() => {
    loadCurrentUser();
  }, []);
  if (!loaded || !userLoaded) return null;
  return (
    <ConvexProvider client={convex}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream } }}>
        <Stack.Screen name="signin" options={{ presentation: "modal" }} />
      </Stack>
    </ConvexProvider>
  );
}
