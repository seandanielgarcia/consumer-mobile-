import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { formatPlace } from "../lib/place";
import { colors, sys } from "../theme";
import { aboutMiles, detailLine, formatPrice } from "./format";

export type CardItem = {
  title: string;
  photoUrl: string;
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
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ width, gap: 2 }}
      accessibilityRole={!onPress ? undefined : selected === undefined ? "button" : "checkbox"}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={detailLine([formatPrice(item.priceCents), item.title, details, item.ownerName && `${item.ownerName}'s yard`, distance, place])}
    >
      <View style={{ marginBottom: 8 }}>
        <Image
          source={{ uri: item.photoUrl }}
          style={{ width, height: width, borderRadius: 16, backgroundColor: colors.line, borderWidth: selected ? 3 : 0, borderColor: colors.brand }}
          contentFit="cover"
          transition={150}
        />
        {selected && (
          <View style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.white, fontSize: 14, fontWeight: "600" }}>✓</Text>
          </View>
        )}
      </View>
      <Text style={sys.price}>{formatPrice(item.priceCents)}</Text>
      <Text numberOfLines={1} style={sys.row}>
        {item.title}
      </Text>
      {details !== "" && (
        <Text numberOfLines={1} style={sys.label}>
          {details}
        </Text>
      )}
      {(item.ownerName || distance) && (
        <View style={{ flexDirection: "row" }}>
          {item.ownerName && (
            <Text numberOfLines={1} style={{ ...sys.label, flexShrink: 1 }}>
              {item.ownerName}'s yard{distance ? " · " : ""}
            </Text>
          )}
          {distance && <Text style={sys.label}>{distance}</Text>}
        </View>
      )}
      {!!place && (
        <Text numberOfLines={1} style={sys.label}>
          {place}
        </Text>
      )}
    </Pressable>
  );
}
