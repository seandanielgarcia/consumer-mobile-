import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { formatPlace } from "../lib/place";
import { colors, spacing, surfaces, sys } from "../theme";
import { aboutMiles, detailLine, formatPrice } from "./format";

export type CardItem = {
  title: string;
  photoUrl: string;
  description?: string;
  priceCents: number;
  size?: string;
  condition?: string;
  distanceMi?: number;
  ownerName?: string;
  neighborhood?: string;
  city?: string;
};

export function ItemCard({ item, width, onPress, selected }: { item: CardItem; width: number; onPress?: () => void; selected?: boolean }) {
  const details = detailLine([item.size, item.condition]);
  const distance = item.distanceMi !== undefined ? aboutMiles(item.distanceMi) : undefined;
  const place = item.neighborhood ? formatPlace({ neighborhood: item.neighborhood, city: item.city }) : undefined;
  const photo = width - 16;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ width, ...surfaces.card, padding: 8, paddingBottom: 12, gap: 2, borderWidth: 2, borderColor: selected ? colors.lime : colors.white, transform: [{ scale: pressed ? 0.98 : 1 }] })}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityHint={onPress ? "Opens item details" : undefined}
      accessibilityLabel={detailLine([formatPrice(item.priceCents), item.title, details, item.ownerName && `${item.ownerName}'s yard`, distance, place])}
    >
      <View style={{ marginBottom: 10 }}>
        <Image source={{ uri: item.photoUrl }} style={{ width: photo, height: photo, borderRadius: spacing.photo, backgroundColor: colors.line }} contentFit="cover" transition={150} />
        <View style={{ position: "absolute", left: 6, bottom: 6, ...surfaces.sticker }}>
          <Text style={{ fontSize: 15, fontWeight: "800", color: colors.ink }}>{formatPrice(item.priceCents)}</Text>
        </View>

      </View>
      <Text numberOfLines={1} style={{ ...sys.row, fontWeight: "600", paddingHorizontal: 4 }}>
        {item.title}
      </Text>
      {details !== "" && (
        <Text numberOfLines={1} style={{ ...sys.label, paddingHorizontal: 4 }}>
          {details}
        </Text>
      )}
      {!!item.description?.trim() && (
        <Text numberOfLines={2} style={{ ...sys.label, paddingHorizontal: 4, marginTop: 3 }}>{item.description.trim()}</Text>
      )}
      {(item.ownerName || distance) && (
        <View style={{ flexDirection: "row", paddingHorizontal: 4 }}>
          {item.ownerName && (
            <Text numberOfLines={1} style={{ ...sys.label, flexShrink: 1 }}>
              {item.ownerName}'s yard{distance ? " · " : ""}
            </Text>
          )}
          {distance && <Text style={sys.label}>{distance}</Text>}
        </View>
      )}
      {!!place && (
        <Text numberOfLines={1} style={{ ...sys.label, paddingHorizontal: 4, textTransform: "uppercase", letterSpacing: 1.2, fontSize: 11 }}>
          {place}
        </Text>
      )}
    </Pressable>
  );
}
