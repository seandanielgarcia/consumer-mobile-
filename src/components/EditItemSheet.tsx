import { Image } from "expo-image";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { colors, fonts, primaryButton, primaryButtonText, spacing, type } from "../theme";

// The one Edit sheet (UI-RULES.md reference), shared by the Overview (app/seller/price.tsx) and the yard grid (app/index.tsx).
export type EditableItem = {
  title: string;
  priceCents: number;
  condition: string;
  size: string;
  brand: string;
  color: string;
  category: string;
  description: string;
};

export type ChoiceField = "condition" | "size" | "brand" | "color" | "category";

const LABELS: Record<ChoiceField, string> = {
  condition: "Condition",
  size: "Size",
  brand: "Brand",
  color: "Color",
  category: "Category",
};

const OPTIONS: Partial<Record<ChoiceField, string[]>> = {
  condition: ["New", "Like new", "Good", "Fair"],
  color: ["Black", "White", "Gray", "Blue", "Red", "Green", "Brown", "Beige", "Pink", "Multi"],
  category: ["Clothing", "Shoes", "Bags", "Home", "Electronics", "Toys", "Books", "Other"],
};

const sizeRelevant = (d: EditableItem) => d.size.trim() !== "" || /cloth|shoe|apparel|wear/i.test(d.category);

export const missingField = (d: EditableItem) =>
  d.priceCents <= 0 ? "price" : !d.title.trim() ? "title" : !d.condition.trim() ? "condition" : null;

export function EditItemSheet({
  visible,
  photo,
  value,
  onChange,
  aiNote,
  busy,
  error,
  onSave,
  onRemove,
  onClose,
}: {
  visible: boolean;
  photo: string;
  value: EditableItem;
  onChange: (patch: Partial<EditableItem>) => void;
  aiNote?: boolean;
  busy?: boolean;
  error?: string | null;
  onSave: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [picker, setPicker] = useState<ChoiceField | null>(null);
  const [pickerText, setPickerText] = useState("");
  const fields: ChoiceField[] = sizeRelevant(value)
    ? ["condition", "size", "brand", "color", "category"]
    : ["condition", "brand", "color", "category"];
  const missing = missingField(value);

  const openPicker = (field: ChoiceField) => {
    setPickerText(value[field]);
    setPicker(field);
  };
  const pick = (text?: string) => {
    if (picker && text !== undefined) onChange({ [picker]: text });
    setPicker(null);
  };
  const options = picker ? OPTIONS[picker] : undefined;
  const choices = options && picker && value[picker] && !options.includes(value[picker]) ? [value[picker], ...options] : options;

  const confirmRemove = () =>
    Alert.alert("Remove this item?", undefined, [
      { text: "Keep", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: onRemove },
    ]);

  return (
    <Modal visible={visible} presentationStyle="pageSheet" animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.close} accessibilityRole="button">
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Edit item</Text>
          <View style={styles.close} />
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View>
            <Image source={{ uri: photo }} style={styles.photo} contentFit="cover" transition={0} />
            {value.priceCents > 0 && (
              <View style={styles.sticker}>
                <Text style={styles.stickerText}>${Math.round(value.priceCents / 100)}</Text>
              </View>
            )}
          </View>
          {aiNote && <Text style={styles.note}>✦ Filled in from your photo</Text>}
          <View style={styles.field}>
            <Text style={styles.label}>Price</Text>
            <View style={styles.input}>
              <Text style={styles.dollar}>$</Text>
              <TextInput
                accessibilityLabel="Price"
                value={value.priceCents > 0 ? String(Math.round(value.priceCents / 100)) : ""}
                onChangeText={(text) => {
                  const dollars = parseInt(text.replace(/\D/g, ""), 10);
                  onChange({ priceCents: Number.isNaN(dollars) ? 0 : dollars * 100 });
                }}
                placeholder="Required"
                placeholderTextColor={colors.brand}
                keyboardType="number-pad"
                returnKeyType="done"
                style={styles.inputText}
              />
            </View>
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Title</Text>
            <View style={styles.input}>
              <TextInput
                accessibilityLabel="Title"
                value={value.title}
                onChangeText={(title) => onChange({ title })}
                placeholder="Required"
                placeholderTextColor={colors.brand}
                returnKeyType="done"
                maxLength={80}
                style={styles.inputText}
              />
            </View>
          </View>
          <View style={styles.rows}>
            {fields.map((field, index) => {
              const current = value[field].trim();
              const required = field === "condition";
              return (
                <Pressable
                  key={field}
                  onPress={() => openPicker(field)}
                  style={[styles.row, index > 0 && styles.rowDivider]}
                  accessibilityRole="button"
                  accessibilityLabel={`${LABELS[field]}: ${current || (required ? "required" : "add")}`}
                >
                  <Text style={styles.rowLabel}>{LABELS[field]}</Text>
                  <Text style={current ? styles.rowValue : styles.rowEmpty} numberOfLines={1}>
                    {current || (required ? "Required" : "Add")}
                  </Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <View style={[styles.input, styles.inputTall]}>
              <TextInput
                accessibilityLabel="Description"
                value={value.description}
                onChangeText={(description) => onChange({ description })}
                placeholder="Add"
                placeholderTextColor={colors.brand}
                multiline
                style={[styles.inputText, styles.inputTallText]}
              />
            </View>
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
        </ScrollView>
        <View style={styles.footer}>
          <Pressable
            onPress={onSave}
            disabled={!!missing || busy}
            style={[styles.save, (!!missing || busy) && styles.disabled]}
            accessibilityRole="button"
          >
            <Text style={styles.saveText}>{missing ? `Add ${missing} to save` : "Save"}</Text>
          </Pressable>
          <Pressable onPress={confirmRemove} disabled={busy} hitSlop={8} style={styles.remove} accessibilityRole="button">
            <Text style={styles.removeText}>Remove item</Text>
          </Pressable>
        </View>
        <Modal visible={picker !== null} transparent animationType="slide" onRequestClose={() => pick()}>
          <Pressable style={styles.scrim} onPress={() => pick()} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.picker}>
              <Text style={styles.pickerTitle}>{picker ? LABELS[picker] : ""}</Text>
              {choices ? (
                choices.map((option) => (
                  <Pressable key={option} onPress={() => pick(option)} style={styles.option} accessibilityRole="button">
                    <Text style={styles.optionText}>{option}</Text>
                    {picker && value[picker] === option && <Text style={styles.check}>✓</Text>}
                  </Pressable>
                ))
              ) : (
                <>
                  <View style={styles.input}>
                    <TextInput
                      value={pickerText}
                      onChangeText={setPickerText}
                      placeholder={picker === "size" ? "Size, like M or 32x30" : "Brand"}
                      placeholderTextColor={colors.muted}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => pick(pickerText.trim())}
                      style={styles.inputText}
                    />
                  </View>
                  {picker === "brand" && (
                    <Pressable onPress={() => pick("")} style={styles.option} accessibilityRole="button">
                      <Text style={styles.optionText}>No brand</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => pick(pickerText.trim())} style={[styles.save, styles.pickerSave]} accessibilityRole="button">
                    <Text style={styles.saveText}>Save</Text>
                  </Pressable>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  header: { height: 56, paddingHorizontal: spacing.sidePad, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  close: { minWidth: 56, minHeight: spacing.minButton, justifyContent: "center" },
  closeText: { ...fonts.medium, fontSize: 17, color: colors.brand },
  headerTitle: { ...fonts.semibold, fontSize: 17, color: colors.ink },
  body: { paddingHorizontal: spacing.sidePad, paddingBottom: 20, gap: 12 },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: colors.hairline },
  sticker: { position: "absolute", left: 12, bottom: 12, paddingHorizontal: 10, height: 32, borderRadius: 8, backgroundColor: colors.tag, justifyContent: "center" },
  stickerText: { ...fonts.display, fontSize: 18, color: colors.ink },
  note: { ...type.meta, color: colors.muted },
  field: { gap: 6 },
  label: { ...fonts.medium, fontSize: 13, color: colors.muted },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  inputTall: { minHeight: 96, alignItems: "flex-start" },
  inputTallText: { minHeight: 96, textAlignVertical: "top" },
  dollar: { ...fonts.medium, fontSize: 17, color: colors.ink, marginRight: 4 },
  inputText: { flex: 1, ...fonts.body, fontSize: 17, color: colors.ink, paddingVertical: 12 },
  rows: { backgroundColor: colors.white, borderRadius: 16, paddingHorizontal: 16 },
  row: { height: 48, flexDirection: "row", alignItems: "center", gap: 8 },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  rowLabel: { flex: 1, ...fonts.body, fontSize: 16, color: colors.ink },
  rowValue: { ...fonts.medium, fontSize: 16, color: colors.ink, maxWidth: "60%" },
  rowEmpty: { ...fonts.medium, fontSize: 16, color: colors.brand },
  chevron: { fontSize: 20, color: colors.muted, width: 16, textAlign: "center" },
  error: { ...fonts.medium, fontSize: 14, color: colors.error },
  footer: { paddingHorizontal: spacing.sidePad, paddingTop: 8, paddingBottom: 34, gap: 4 },
  save: primaryButton,
  saveText: primaryButtonText,
  disabled: { opacity: 0.4 },
  remove: { alignSelf: "center", minHeight: spacing.minButton, justifyContent: "center" },
  removeText: { ...fonts.medium, fontSize: 16, color: "#D93025" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  picker: { backgroundColor: colors.cream, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.sidePad, paddingBottom: 34, gap: 4 },
  pickerTitle: { ...fonts.semibold, fontSize: 20, color: colors.ink, marginBottom: 8 },
  option: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.hairline },
  optionText: { ...fonts.body, fontSize: 17, color: colors.ink },
  check: { fontSize: 16, color: colors.brand },
  pickerSave: { marginTop: 12 },
});
