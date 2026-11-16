import { useQuery } from "convex/react";
import { Tabs } from "expo-router";
import { ActionSheetIOS } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { api } from "../../convex/_generated/api";
import { useEntered } from "../../src/lib/entered";
import { pickFromCamera, pickFromLibrary } from "../../src/lib/sell";
import { useCurrentUser } from "../../src/lib/useCurrentUser";
import { colors } from "../../src/theme";

function HouseIcon({ color }: { color: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinejoin="round">
      <Path d="M3.5 10.5 12 3.5l8.5 7" />
      <Path d="M5.5 9v11h13V9" />
      <Path d="M10 20v-5.5h4V20" />
    </Svg>
  );
}

function PlusIcon({ color }: { color: string }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9}>
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 7.5v9M7.5 12h9" />
    </Svg>
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

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: firstOpen ? { display: "none" } : { backgroundColor: colors.white, borderTopColor: colors.hairline },
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "My yard", tabBarIcon: ({ color }) => <HouseIcon color={color as string} /> }} />
      <Tabs.Screen
        name="sell"
        options={{ title: "Sell", tabBarIcon: ({ color }) => <PlusIcon color={color as string} />, tabBarAccessibilityLabel: "Sell: add photos" }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            ActionSheetIOS.showActionSheetWithOptions(
              { options: ["Choose from library", "Take photo", "Cancel"], cancelButtonIndex: 2 },
              (index) => {
                if (index === 0) pickFromLibrary();
                if (index === 1) pickFromCamera();
              },
            );
          },
        }}
      />
      <Tabs.Screen name="buyer" options={{ title: "Search", tabBarIcon: ({ color }) => <SearchIcon color={color as string} /> }} />
    </Tabs>
  );
}
