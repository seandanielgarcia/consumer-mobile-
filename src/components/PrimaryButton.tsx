import { ActivityIndicator, Pressable, Text } from "react-native";
import { colors, primaryButton, sys } from "../theme";

export function PrimaryButton({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button" style={({ pressed }) => ({ ...primaryButton, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 })}>
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={{ ...sys.button, color: colors.white }}>{label}</Text>}
    </Pressable>
  );
}

