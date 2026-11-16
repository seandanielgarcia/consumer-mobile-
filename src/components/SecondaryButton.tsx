import { Pressable, Text } from "react-native";
import { secondaryButton, secondaryButtonText } from "../theme";

// The white pill with a navy outline that sits next to a PrimaryButton.
export function SecondaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => ({ ...secondaryButton, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}
    >
      <Text style={secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}
