import { Image } from "expo-image";
import { Pressable, Text, View } from "react-native";
import { colors, fonts, type, typeSize } from "../theme";
import { formatPlace } from "../lib/place";
import { detailLine, formatPrice } from "./format";

export type CardItem = {
  title: string;
  photoUrl: string;
  priceCents: number;
  size?: string;
  condition?: string;
  brand?: string;
  distanceMi?: number;
  ownerName?: string;
  neighborhood?: string;
  city?: string;
};

export function ItemCard({ item, width, onPress, selected }: { item: CardItem; width: number; onPress: () => void; selected?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width, gap: 4 }}
      accessibilityRole={selected === undefined ? "button" : "checkbox"}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
    >
      <View style={{ marginBottom: 4 }}>
        <Image
          source={{ uri: item.photoUrl }}
          style={{ width, height: width, borderRadius: 14, backgroundColor: colors.line, borderWidth: selected ? 3 : 0, borderColor: colors.brand }}
          contentFit="cover"
          transition={150}
        />
        {selected && (
          <View style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: colors.white, fontSize: 14, ...fonts.semibold }}>✓</Text>
          </View>
        )}
      </View>
      <Text style={{ ...fonts.display, fontSize: typeSize.listPrice, color: colors.ink }}>{formatPrice(item.priceCents)}</Text>
      <Text numberOfLines={1} style={{ ...fonts.body, fontSize: 14, color: colors.ink }}>
        {item.title}
      </Text>
      {detailLine([item.condition, item.size && `Size ${item.size}`, item.brand]) !== "" && (
        <Text numberOfLines={1} style={{ ...fonts.body, fontSize: 12, color: colors.muted }}>
          {detailLine([item.condition, item.size && `Size ${item.size}`, item.brand])}
        </Text>
      )}
      {(item.ownerName || item.distanceMi !== undefined) && (
        <View style={{ flexDirection: "row" }}>
          {item.ownerName && (
            <Text numberOfLines={1} style={{ flexShrink: 1, ...fonts.body, fontSize: 12, color: colors.muted }}>
              {item.ownerName}'s yard{item.distanceMi !== undefined ? " · " : ""}
            </Text>
          )}
          {item.distanceMi !== undefined && (
            <Text style={{ ...fonts.body, fontSize: 12, color: colors.muted }}>about {item.distanceMi} mi</Text>
          )}
        </View>
      )}
      {item.neighborhood && (
        <Text numberOfLines={1} style={{ ...fonts.body, fontSize: 12, color: colors.muted }}>
          {formatPlace({ neighborhood: item.neighborhood, city: item.city })}
        </Text>
      )}
    </Pressable>
  );
}
