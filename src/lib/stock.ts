// The one list of stock photos in assets/stock/. Each file is used exactly once:
// on the Landing polaroid stack, as a "Use sample photos" pick, or as a seed yard listing.
export type StockPhoto = {
  file: string;
  use: "landing" | "sample" | "seed";
  seller?: "Hailey" | "Maya" | "Jon";
  title: string;
  priceCents: number;
  size?: string;
  description: string;
};

export const STOCK: StockPhoto[] = [
  { file: "levis-501.jpg", use: "landing", title: "Levi's 501 jeans", priceCents: 3000, size: "32", description: "Light wash straight leg 501s, button fly, broken in." },
  { file: "lamp.jpg", use: "landing", title: "Black floor lamp", priceCents: 2500, description: "Matte black arc floor lamp with a dome shade." },
  { file: "white-sneakers.jpg", use: "landing", title: "Nike Killshot sneakers", priceCents: 4000, size: "10", description: "White leather low tops with a gum sole, lightly worn." },
  { file: "tote.jpg", use: "landing", title: "Canvas tote bag", priceCents: 1800, description: "Natural canvas tote with leather handles." },

  { file: "jacket.jpg", use: "sample", title: "Denim jacket", priceCents: 3500, size: "M", description: "Faded blue trucker jacket." },
  { file: "jeans.jpg", use: "sample", title: "Light wash jeans", priceCents: 2500, size: "30", description: "Straight leg light wash jeans." },
  { file: "sneakers.jpg", use: "sample", title: "White sneakers", priceCents: 3000, size: "9", description: "Clean white leather sneakers." },
  { file: "field-jacket.jpg", use: "sample", title: "Field jacket", priceCents: 4500, size: "M", description: "Olive cotton field jacket with four snap pockets." },
  { file: "silk-top.jpg", use: "sample", title: "Silk cami top", priceCents: 1500, size: "S", description: "Ivory silk camisole with adjustable straps." },

  { file: "black-skinny-jeans.jpg", use: "seed", seller: "Hailey", title: "Black skinny jeans", priceCents: 2200, size: "28", description: "Washed black skinny jeans with a mid rise and plenty of stretch." },
  { file: "knit-sweater.jpg", use: "seed", seller: "Hailey", title: "Cable knit sweater", priceCents: 2800, size: "M", description: "Chunky oatmeal wool cable knit sweater, cozy and warm." },
  { file: "wide-leg-jeans.jpg", use: "seed", seller: "Maya", title: "Wide leg jeans", priceCents: 2500, size: "27", description: "Medium wash high waisted wide leg jeans, cropped at the ankle." },
  { file: "flannel-shirt.jpg", use: "seed", seller: "Maya", title: "Plaid flannel shirt", priceCents: 2000, size: "L", description: "Red and black buffalo plaid flannel button up shirt." },
  { file: "mom-jeans.jpg", use: "seed", seller: "Jon", title: "Mom jeans", priceCents: 1800, size: "28", description: "Light blue vintage mom jeans with a paper bag waist and tie belt." },
  { file: "denim-jacket.jpg", use: "seed", seller: "Jon", title: "Denim trucker jacket", priceCents: 3500, size: "L", description: "Classic medium blue denim trucker jacket, nicely faded." },
];
