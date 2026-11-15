import { Share } from "react-native";

const SITE_URL = process.env.EXPO_PUBLIC_CONVEX_URL!.replace(/\.convex\.cloud\/?$/, ".convex.site");

// Opens the iOS share sheet with a link to the yard; convex/share.ts serves the page and hands off to the app.
export function shareYard(garageId: string, ownerName?: string) {
  const url = `${SITE_URL}/yard/${garageId}`;
  return Share.share({ message: `Come shop ${ownerName ? `${ownerName}'s` : "my"} yard on yardsale: ${url}` });
}
