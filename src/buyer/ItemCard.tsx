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

export function ItemCard({ item, width, onPress, selected }: { item: CardItem; width: number; onPress: () => void; selected?: boolean }) {
  const details = detailLine([item.size, item.condition]);
  const place = item.neighborhood ? formatPlace({ neighborhood: item.neighborhood, city: item.city }) : item.ownerName && `${item.ownerName}'s yard`;
  const distance = item.distanceMi !== undefined ? aboutMiles(item.distanceMi) : undefined;
  const where = detailLine([place, distance]);
  return (
    <Pressable
      onPress={onPress}
      style={{ width, gap: 2 }}
      accessibilityRole={selected === undefined ? "button" : "checkbox"}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={detailLine([formatPrice(item.priceCents), item.title, details, where])}
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
      {where !== "" && (
        <View style={{ flexDirection: "row" }}>
          {!!place && (
            <Text numberOfLines={1} style={{ ...sys.label, flexShrink: 1 }}>
              {place}
            </Text>
          )}
          {distance && <Text style={sys.label}>{place ? ` · ${distance}` : distance}</Text>}
        </View>
      )}
    </Pressable>
  );
}
