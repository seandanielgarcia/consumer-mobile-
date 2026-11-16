import { Text, View } from "react-native";
import { colors, fonts, spacing } from "../theme";

export function Stub({ title }: { title: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.cream,
        paddingHorizontal: spacing.sidePad,
        paddingTop: 8,
      }}
    >
      <Text style={{ ...fonts.display, fontSize: 32, color: colors.ink }}>{title}</Text>
    </View>
  );
}
