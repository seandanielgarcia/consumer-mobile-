import { Pressable, Text } from "react-native";
import { colors, primaryButton, sys } from "../theme";

export function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={{ ...primaryButton, backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.ink, opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={{ ...sys.button, color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}
