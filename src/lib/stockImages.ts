import { STOCK } from "./stock";

const IMAGES: Record<string, number> = {
  "black-skinny-jeans.jpg": require("../../assets/stock/black-skinny-jeans.jpg"),
  "field-jacket.jpg": require("../../assets/stock/field-jacket.jpg"),
  "flannel-shirt.jpg": require("../../assets/stock/flannel-shirt.jpg"),
  "jacket.jpg": require("../../assets/stock/jacket.jpg"),
  "jeans.jpg": require("../../assets/stock/jeans.jpg"),
  "knit-sweater.jpg": require("../../assets/stock/knit-sweater.jpg"),
  "lamp.jpg": require("../../assets/stock/lamp.jpg"),
  "levis-501.jpg": require("../../assets/stock/levis-501.jpg"),
  "mom-jeans.jpg": require("../../assets/stock/mom-jeans.jpg"),
  "silk-top.jpg": require("../../assets/stock/silk-top.jpg"),
  "sneakers.jpg": require("../../assets/stock/sneakers.jpg"),
  "tote.jpg": require("../../assets/stock/tote.jpg"),
  "white-sneakers.jpg": require("../../assets/stock/white-sneakers.jpg"),
  "wide-leg-jeans.jpg": require("../../assets/stock/wide-leg-jeans.jpg"),
};

export const stockImages = (use: "landing" | "sample") =>
  STOCK.filter((s) => s.use === use).map((s) => ({ ...s, image: IMAGES[s.file] }));
