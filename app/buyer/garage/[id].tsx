import { useLocalSearchParams } from "expo-router";
import { Stub } from "../../../src/components/Stub";

export default function BuyerGarage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Stub title={`Buyer 2 · Garage ${id}`} />;
}
