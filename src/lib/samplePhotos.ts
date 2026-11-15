import { Asset } from "expo-asset";

const SAMPLES = [
  require("../../assets/samples/jeans.jpg"),
  require("../../assets/samples/sneakers.jpg"),
  require("../../assets/samples/jacket.jpg"),
  require("../../assets/samples/lamp.jpg"),
  require("../../assets/samples/tote.jpg"),
];

export async function loadSamplePhotos(): Promise<string[]> {
  const assets = await Asset.loadAsync(SAMPLES);
  return assets.map((asset) => asset.localUri ?? asset.uri);
}
