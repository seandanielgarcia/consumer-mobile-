import { ActivityIndicator, Pressable, Text } from "react-native";
import { colors, fonts, type } from "../theme";

export function PrimaryButton({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={{ height: 56, borderRadius: 999, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.4 : 1 }}
    >
      {loading ? <ActivityIndicator color={colors.cream} /> : <Text style={{ fontFamily: fonts.semibold, fontSize: type.sentence, color: colors.cream }}>{label}</Text>}
    </Pressable>
  );
}
