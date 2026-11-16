import { View } from "react-native";
import { colors } from "../theme";

export function Tape() {
  return <View pointerEvents="none" style={{ position: "absolute", top: -7, left: 14, width: 54, height: 17, backgroundColor: colors.tape, transform: [{ rotate: "-6deg" }] }} />;
}
