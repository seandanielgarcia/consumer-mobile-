import { Image } from "expo-image";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentRef } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import MapView, { Circle, Marker, type Region } from "react-native-maps";
import type { Id } from "../../convex/_generated/dataModel";
import { formatPlace } from "../lib/place";
import { colors, sys } from "../theme";
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

// Pin palette: saturated, each pair passes 4.5:1 for the initial. Stable per yard.
const PINS = [
  { bg: colors.mapBlue, fg: colors.white },
  { bg: colors.mapLime, fg: colors.mapInk },
  { bg: colors.mapOrange, fg: colors.mapInk },
  { bg: colors.mapPink, fg: colors.white },
  { bg: colors.mapInk, fg: colors.white },
];
const pinFor = (id: string) => PINS[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PINS.length];

const MILE_M = 1609.344;
const DEG_PER_MILE = 1 / 69;

export function spreadYards<T extends { garageId: string; lat: number; lng: number }>(yards: T[], radiusMiles: number): (T & { pinLat: number; pinLng: number })[] {
  const groups = new Map<string, T[]>();
  for (const yard of yards) {
    const key = `${yard.lat},${yard.lng}`;
    groups.set(key, [...(groups.get(key) ?? []), yard]);
  }
  return yards.map((yard) => {
    const group = groups.get(`${yard.lat},${yard.lng}`)!;
    if (group.length < 2) return { ...yard, pinLat: yard.lat, pinLng: yard.lng };
    const i = [...group].sort((a, b) => a.garageId.localeCompare(b.garageId)).indexOf(yard);
    const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
    const fan = regionFor(yard.lat, yard.lng, radiusMiles).latitudeDelta / 13;
    return {
      ...yard,
      pinLat: yard.lat + fan * Math.sin(angle),
      pinLng: yard.lng + (fan * Math.cos(angle)) / Math.cos((yard.lat * Math.PI) / 180),
    };
  });
}

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

  const pins = useMemo(() => spreadYards(yards, radiusMiles), [yards, radiusMiles]);

  const ordered = useMemo(() => {
    if (!selected) return yards;
    const i = yards.findIndex((y) => y.garageId === selected);
    return i < 0 ? yards : [...yards.slice(i), ...yards.slice(0, i)];
  }, [yards, selected]);

  const pick = (yard: MapYard & { pinLat: number; pinLng: number }) => {
    setSelected(yard.garageId);
    carousel.current?.scrollTo({ x: 0, animated: true });
    map.current?.animateCamera({ center: { latitude: yard.pinLat, longitude: yard.pinLng } }, { duration: 350 });
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
        {pins.map((yard) => {
          const on = yard.garageId === selected;
          const pin = pinFor(yard.garageId);
          const size = on ? 58 : 44;
          return (
            <Marker
              key={yard.garageId}
              coordinate={{ latitude: yard.pinLat, longitude: yard.pinLng }}
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
                  shadowColor: colors.mapInk,
                  shadowOpacity: 0.22,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 4 },
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
                style={{
                  width: cardWidth,
                  minHeight: 76,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 22,
                  backgroundColor: colors.white,
                  borderWidth: 2,
                  borderColor: on ? colors.mapBlue : colors.white,
                  shadowColor: colors.mapInk,
                  shadowOpacity: 0.14,
                  shadowRadius: 14,
                  shadowOffset: { width: 0, height: 8 },
                }}
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
