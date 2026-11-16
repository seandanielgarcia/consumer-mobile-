import { Contact } from "expo-contacts";
import * as Linking from "expo-linking";

// Keiki's shared iMessage line and the opener that links a seller's texts to their yard (K-FERUEU).
export const KEIKI_NUMBER = "+17796251378";
export const KEIKI_INTRO = "hey keiki, i have a few things to add to my yard (K-FERUEU)";

export function textKeikiVerification(code: string) {
  return Linking.openURL(`sms:${KEIKI_NUMBER}&body=${encodeURIComponent(`K-FERUEU verify ${code}`)}`);
}

export function textKeiki() {
  return Linking.openURL(`sms:${KEIKI_NUMBER}&body=${encodeURIComponent(KEIKI_INTRO)}`);
}

export function saveKeikiToContacts() {
  return Contact.presentCreateForm({ givenName: "Keiki", company: "yardsale", phones: [{ label: "iPhone", number: KEIKI_NUMBER }] });
}
