import { type ComponentRef, useEffect, useRef, useState } from "react";
import { Keyboard, LayoutAnimation, View } from "react-native";

// How far the keyboard covers this view, measured in window coordinates so it also holds inside iOS page sheets,
// which float above the bottom of the screen.
export function useKeyboardInset() {
  const ref = useRef<ComponentRef<typeof View>>(null);
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const subscription = Keyboard.addListener("keyboardWillChangeFrame", ({ endCoordinates, duration }) => {
      ref.current?.measureInWindow((_x, y, _width, height) => {
        if (duration) LayoutAnimation.configureNext({ duration, update: { type: LayoutAnimation.Types.keyboard } });
        setInset(Math.max(0, y + height - endCoordinates.screenY));
      });
    });
    return () => subscription.remove();
  }, []);
  return { ref, inset };
}
