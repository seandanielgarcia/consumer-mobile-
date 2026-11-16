import { useEffect, useState } from "react";
import { Dimensions, Keyboard, LayoutAnimation } from "react-native";

// How much of the screen the keyboard covers, for a view that reaches the bottom of the screen.
// KeyboardAvoidingView measures inside an iOS page sheet's own coordinates, so it under-pads by the sheet's top offset.
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardWillChangeFrame", ({ endCoordinates, duration }) => {
      if (duration) LayoutAnimation.configureNext({ duration, update: { type: LayoutAnimation.Types.keyboard } });
      setInset(Math.max(0, Dimensions.get("screen").height - endCoordinates.screenY));
    });
    return () => subscription.remove();
  }, []);
  return inset;
}
