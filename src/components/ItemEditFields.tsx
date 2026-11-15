import { StyleSheet, TextInput, View } from "react-native";
import { colors, fonts } from "../theme";

// The editable listing fields, shared by the review queue (app/seller/price.tsx) and the yard grid (app/index.tsx).
export type ItemFields = {
  title: string;
  category: string;
  size: string;
  brand: string;
  condition: string;
  color: string;
  description: string;
};

export type ChipField = "size" | "brand" | "condition" | "color";

export const CHIP_LABELS: Record<ChipField, string> = { size: "Size", brand: "Brand", condition: "Condition", color: "Color" };

export const sizeRelevant = (d: Pick<ItemFields, "size" | "category">) =>
  d.size.trim() !== "" || /cloth|shoe|apparel|wear/i.test(d.category);

export const chipFields = (d: Pick<ItemFields, "size" | "category">): ChipField[] =>
  sizeRelevant(d) ? ["size", "brand", "condition", "color"] : ["brand", "condition", "color"];

export const chipLabel = (d: ItemFields, field: ChipField) => {
  const value = d[field].trim();
  if (!value) return `+ ${CHIP_LABELS[field].toLowerCase()}`;
  return field === "size" ? `Size ${value}` : value;
};

export function ItemEditFields({
  value,
  onChange,
  autoFocus = true,
}: {
  value: ItemFields;
  onChange: (patch: Partial<ItemFields>) => void;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.fields}>
      <TextInput
        value={value.title}
        onChangeText={(title) => onChange({ title })}
        placeholder="Title"
        placeholderTextColor={colors.muted}
        style={styles.fieldInput}
        autoFocus={autoFocus}
      />
      <View style={styles.chips}>
        {chipFields(value).map((field) => (
          <TextInput
            key={field}
            value={value[field]}
            onChangeText={(text) => onChange({ [field]: text })}
            placeholder={CHIP_LABELS[field]}
            placeholderTextColor={colors.muted}
            style={[styles.chip, styles.chipInput]}
          />
        ))}
      </View>
      <TextInput
        value={value.description}
        onChangeText={(description) => onChange({ description })}
        placeholder="Description"
        placeholderTextColor={colors.muted}
        multiline
        numberOfLines={3}
        style={[styles.fieldInput, styles.descriptionInput]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: 10 },
  fieldInput: {
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    ...fonts.body,
    fontSize: 16,
    color: colors.ink,
  },
  descriptionInput: { height: 76, paddingTop: 10, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: colors.white, justifyContent: "center" },
  chipInput: { width: 120, borderWidth: 2, borderColor: colors.ink, ...fonts.medium, fontSize: 14, color: colors.ink },
});
