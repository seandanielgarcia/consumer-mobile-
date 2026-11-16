import { Pressable, Text, View } from "react-native";
import { colors, secondaryButton, secondaryButtonText, surfaces, sys } from "../theme";

export function EmptyState({ headline, line, action, onAction }: { headline: string; line?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ ...surfaces.card, padding: 20, marginVertical: 16, gap: 8 }}>
      <Text style={sys.header}>{headline}</Text>
      {!!line && <Text style={{ ...sys.body, color: colors.muted }}>{line}</Text>}
      {action && onAction && (
        <Pressable onPress={onAction} accessibilityRole="button" style={{ ...secondaryButton, marginTop: 12 }}>
          <Text style={secondaryButtonText}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
