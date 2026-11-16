import { useQuery } from "convex/react";
import * as Haptics from "expo-haptics";
import { Tabs } from "expo-router";
import { View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { api } from "../../convex/_generated/api";
import { AppHeader } from "../../src/components/AppHeader";
import { useEntered } from "../../src/lib/entered";
import { openSellSheet } from "../../src/lib/sell";
import { useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors, shadows } from "../../src/theme";

function HouseIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinejoin="round">
      <Path d="M3.5 10.5 12 3.5l8.5 7" />
      <Path d="M5.5 9v11h13V9" />
      <Path d="M10 20v-5.5h4V20" />
    </Svg>
  );
}

// The Sell tab is a raised lime pin: it is the one action the whole app points at.
function SellPin() {
  return (
    <View
      style={{
        width: 56,
        height: 56,
        borderRadius: 28,
        marginTop: -22,
        backgroundColor: colors.lime,
        borderWidth: 3,
        borderColor: colors.white,
        alignItems: "center",
        justifyContent: "center",
        ...shadows.pin,
      }}
    >
      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2.8} strokeLinecap="round">
        <Path d="M12 5v14M5 12h14" />
      </Svg>
    </View>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9}>
      <Circle cx={11} cy={11} r={7} />
      <Path d="M20 20l-4-4" />
    </Svg>
  );
}

export default function TabsLayout() {
  const user = useCurrentUser();
  const garage = useQuery(api.garages.mine, user ? { ownerId: user.userId } : "skip");
  const entered = useEntered();
  const firstOpen = !entered && !user && !garage;
  const landing = !user || garage === null;

  return (
    <Tabs
      screenListeners={{ tabPress: () => Haptics.selectionAsync() }}
      screenOptions={{
        header: ({ route }) => <AppHeader landing={route.name === "index" && landing} />,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: firstOpen
          ? { display: "none" }
          : {
              backgroundColor: colors.white,
              borderTopWidth: 0,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              height: 88,
              paddingTop: 8,
              ...shadows.float,
              shadowOffset: { width: 0, height: -6 },
            },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "My yard", tabBarIcon: ({ color }) => <HouseIcon color={color as string} /> }} />
      <Tabs.Screen
        name="sell"
        options={{ title: "Sell", tabBarIcon: () => <SellPin />, tabBarAccessibilityLabel: "Sell: add photos" }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            openSellSheet();
          },
        }}
      />
      <Tabs.Screen name="buyer" options={{ title: "Search", tabBarIcon: ({ color }) => <SearchIcon color={color as string} /> }} />
    </Tabs>
  );
}
