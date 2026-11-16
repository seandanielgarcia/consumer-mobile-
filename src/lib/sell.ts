import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { setPickedPhotos } from "./pickedPhotos";
import { loadSamplePhotos } from "./samplePhotos";

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.6 };

// Photo library and Camera both feed the same review queue (/seller/price).
export async function pickFromLibrary() {
  const result = await ImagePicker.launchImageLibraryAsync({ ...PICKER_OPTIONS, allowsMultipleSelection: true, selectionLimit: 0 });
  if (result.canceled || result.assets.length === 0) return;
  setPickedPhotos(result.assets.map((asset) => asset.uri));
  router.push("/seller/price");
}

export async function pickFromCamera() {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return;
  const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
  if (result.canceled || result.assets.length === 0) return;
  setPickedPhotos(result.assets.map((asset) => asset.uri));
  router.push("/seller/price");
}

export async function pickSamplePhotos() {
  setPickedPhotos(await loadSamplePhotos());
  router.push("/seller/price");
}
