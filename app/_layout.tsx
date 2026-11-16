import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SplashScreen, Stack, type NativeStackHeaderProps } from "expo-router";
import { useEffect } from "react";
import { AppHeader } from "../src/components/AppHeader";
import { headerBackHandler } from "../src/lib/headerBack";
import { loadCurrentUser, useCurrentUserLoaded } from "../src/lib/useCurrentUser";
import { colors } from "../src/theme";

export const unstable_settings = { initialRouteName: "(tabs)" };

SplashScreen.preventAutoHideAsync();

const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

const BRAND_ROUTES = new Set(["buyer/garage/[id]", "seller/open"]);

function StackHeader({ navigation, route, back, options }: NativeStackHeaderProps) {
  const showBack = !!back && options.headerBackVisible !== false;
  return (
    <AppHeader
      onBrand={BRAND_ROUTES.has(route.name)}
      onBack={showBack ? () => (headerBackHandler(route.key) ?? navigation.goBack)() : undefined}
    />
  );
}

export default function RootLayout() {
  const userLoaded = useCurrentUserLoaded();
  useEffect(() => {
    loadCurrentUser();
  }, []);
  useEffect(() => {
    if (userLoaded) SplashScreen.hideAsync();
  }, [userLoaded]);
  if (!userLoaded) return null;
  return (
    <ConvexProvider client={convex}>
      <Stack
        screenOptions={{
          header: (props) => <StackHeader {...props} />,
          fullScreenGestureEnabled: true,
          statusBarStyle: "dark",
          contentStyle: { backgroundColor: colors.cream },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="signin" options={{ presentation: "modal", headerShown: false }} />
        <Stack.Screen name="buyer/paid" options={{ gestureEnabled: false, headerBackVisible: false }} />
        <Stack.Screen name="seller/price" options={{ gestureEnabled: false }} />
        <Stack.Screen name="seller/open" options={{ gestureEnabled: false, headerBackVisible: false, statusBarStyle: "light" }} />
        <Stack.Screen name="buyer/garage/[id]" options={{ statusBarStyle: "light" }} />
      </Stack>
    </ConvexProvider>
  );
}
