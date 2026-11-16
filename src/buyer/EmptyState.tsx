import { Pressable, Text, View } from "react-native";
import { colors, sys } from "../theme";

export function EmptyState({ headline, line, action, onAction }: { headline: string; line?: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ paddingVertical: 32, gap: 8 }}>
      <Text style={sys.header}>{headline}</Text>
      {!!line && <Text style={{ ...sys.body, color: colors.muted }}>{line}</Text>}
      {action && onAction && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={{ marginTop: 12, height: 56, borderRadius: 999, borderWidth: 1.5, borderColor: colors.ink, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ ...sys.button, color: colors.ink }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}
