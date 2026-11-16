import { Asset } from "expo-asset";
import { stockImages } from "./stockImages";

export async function loadSamplePhotos(): Promise<string[]> {
  const assets = await Asset.loadAsync(stockImages("sample").map((s) => s.image));
  return assets.map((asset) => asset.localUri ?? asset.uri);
}
