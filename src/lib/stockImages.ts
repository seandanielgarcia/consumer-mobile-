import { STOCK } from "./stock";

const IMAGES: Record<string, number> = {
  "after-sun-eau-de-toilette.jpg": require("../../assets/stock/after-sun-eau-de-toilette.jpg"),
  "aperire-berry-tint.jpg": require("../../assets/stock/aperire-berry-tint.jpg"),
  "cinnamoroll-tin.jpg": require("../../assets/stock/cinnamoroll-tin.jpg"),
  "fixx-setting-spray.jpg": require("../../assets/stock/fixx-setting-spray.jpg"),
  "gisou-hair-perfume.jpg": require("../../assets/stock/gisou-hair-perfume.jpg"),
  "john-galt-striped-shirt.jpg": require("../../assets/stock/john-galt-striped-shirt.jpg"),
  "la-all-star-hoodie.jpg": require("../../assets/stock/la-all-star-hoodie.jpg"),
  "north-face-fleece.jpg": require("../../assets/stock/north-face-fleece.jpg"),
  "sunkissed-morning-candle.jpg": require("../../assets/stock/sunkissed-morning-candle.jpg"),
  "black-skinny-jeans.jpg": require("../../assets/stock/black-skinny-jeans.jpg"),
  "denim-jacket.jpg": require("../../assets/stock/denim-jacket.jpg"),
  "flannel-shirt.jpg": require("../../assets/stock/flannel-shirt.jpg"),
  "knit-sweater.jpg": require("../../assets/stock/knit-sweater.jpg"),
  "mom-jeans.jpg": require("../../assets/stock/mom-jeans.jpg"),
  "wide-leg-jeans.jpg": require("../../assets/stock/wide-leg-jeans.jpg"),
};

export const stockImages = (use: "landing" | "sample") =>
  STOCK.filter((s) => s.use === use).map((s) => ({ ...s, image: IMAGES[s.file] }));
