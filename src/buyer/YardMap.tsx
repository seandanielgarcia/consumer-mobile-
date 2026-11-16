import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import MapView, { Circle, Marker, type Region } from "react-native-maps";
import type { Id } from "../../convex/_generated/dataModel";
import { formatPlace } from "../lib/place";
import { colors, shadows, sys } from "../theme";
import { pinFor } from "./pins";
import { aboutMiles, formatPrice } from "./format";

export type MapYard = {
  garageId: Id<"garages">;
  ownerName: string;
  neighborhood: string;
  city?: string;
  lat: number;
  lng: number;
  distanceMi: number;
  liveCount: number;
  minPriceCents: number;
  photoUrls: string[];
};

const MILE_M = 1609.344;
const DEG_PER_MILE = 1 / 69;

export function regionFor(lat: number, lng: number, radiusMiles: number): Region {
  const span = radiusMiles * 2 * DEG_PER_MILE * 1.25;
  return { latitude: lat, longitude: lng, latitudeDelta: span, longitudeDelta: span / Math.cos((lat * Math.PI) / 180) };
}

export function YardMap({
  yards,
  center,
  radiusMiles,
  topInset,
  bottomInset,
}: {
  yards: MapYard[];
  center: { lat: number; lng: number };
  radiusMiles: number;
  topInset: number;
  bottomInset: number;
}) {
  const [selected, setSelected] = useState<Id<"garages"> | null>(null);
  const map = useRef<MapView>(null);
  const carousel = useRef<ComponentRef<typeof ScrollView>>(null);
  const { width } = useWindowDimensions();
  const cardWidth = width - 56;

  useEffect(() => {
    map.current?.animateToRegion(regionFor(center.lat, center.lng, radiusMiles), 450);
  }, [center.lat, center.lng, radiusMiles]);

  const ordered = useMemo(() => {
    if (!selected) return yards;
    const i = yards.findIndex((y) => y.garageId === selected);
    return i < 0 ? yards : [...yards.slice(i), ...yards.slice(0, i)];
  }, [yards, selected]);

  const pick = (yard: MapYard) => {
    setSelected(yard.garageId);
    carousel.current?.scrollTo({ x: 0, animated: true });
    map.current?.animateCamera({ center: { latitude: yard.lat, longitude: yard.lng } }, { duration: 350 });
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        ref={map}
        style={{ flex: 1 }}
        initialRegion={regionFor(center.lat, center.lng, radiusMiles)}
        mapType="mutedStandard"
        showsPointsOfInterests={false}
        showsBuildings={false}
        showsTraffic={false}
        showsCompass={false}
        pitchEnabled={false}
        rotateEnabled={false}
        onPress={() => setSelected(null)}
        mapPadding={{ top: topInset, right: 0, bottom: bottomInset, left: 0 }}
        accessibilityLabel={`Map of ${yards.length} yards within ${radiusMiles} miles`}
      >
        <Circle center={{ latitude: center.lat, longitude: center.lng }} radius={radiusMiles * MILE_M} fillColor={colors.mapRadiusFill} strokeColor={colors.mapRadiusLine} strokeWidth={1} />
        <Marker coordinate={{ latitude: center.lat, longitude: center.lng }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false} accessibilityLabel="Your search spot">
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.mapBlue, borderWidth: 4, borderColor: colors.white }} />
        </Marker>
        {yards.map((yard) => {
          const on = yard.garageId === selected;
          const pin = pinFor(yard.garageId);
          const size = on ? 58 : 44;
          return (
            <Marker
              key={yard.garageId}
              coordinate={{ latitude: yard.lat, longitude: yard.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={(e) => {
                e.stopPropagation();
                pick(yard);
              }}
              zIndex={on ? 2 : 1}
              tracksViewChanges={on}
              accessibilityLabel={`${yard.ownerName}'s yard, ${yard.liveCount} items, ${aboutMiles(yard.distanceMi)}`}
            >
              <View
                style={{
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  backgroundColor: pin.bg,
                  borderWidth: on ? 5 : 3,
                  borderColor: on ? colors.mapInk : colors.white,
                  alignItems: "center",
                  justifyContent: "center",
                  ...shadows.pin,
                }}
              >
                <Text style={{ fontSize: on ? 24 : 18, fontWeight: "800", color: pin.fg }}>{yard.ownerName.charAt(0).toUpperCase()}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: colors.mapWash }} />

      {yards.length > 0 && (
        <ScrollView
          ref={carousel}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 12}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
          style={{ position: "absolute", left: 0, right: 0, bottom: bottomInset + 12 }}
        >
          {ordered.map((yard) => {
            const pin = pinFor(yard.garageId);
            const on = yard.garageId === selected;
            return (
              <Pressable
                key={yard.garageId}
                onPress={() => router.push({ pathname: "/buyer/garage/[id]", params: { id: yard.garageId } })}
                accessibilityRole="button"
                accessibilityLabel={`Open ${yard.ownerName}'s yard`}
                style={({ pressed }) => ({
                  width: cardWidth,
                  minHeight: 76,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 22,
                  backgroundColor: colors.white,
                  borderWidth: 2,
                  borderColor: on ? colors.mapBlue : colors.white,
                  ...shadows.float,
                })}
              >
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: pin.bg, alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 20, fontWeight: "800", color: pin.fg }}>{yard.ownerName.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ ...sys.row, fontWeight: "700" }}>
                    {yard.ownerName}'s yard
                  </Text>
                  <Text numberOfLines={1} style={sys.label}>
                    {formatPlace(yard)} · {aboutMiles(yard.distanceMi)} · {yard.liveCount} {yard.liveCount === 1 ? "item" : "items"} from {formatPrice(yard.minPriceCents)}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 4 }}>
                  {yard.photoUrls.slice(0, 2).map((uri) => (
                    <Image key={uri} source={{ uri }} style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: colors.line }} contentFit="cover" />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
