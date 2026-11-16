// The one list of stock photos in assets/stock/. Each file is used exactly once:
// on the Landing polaroid stack, as a "Use sample photos" pick, or as a seed yard listing.
export type StockPhoto = {
  file: string;
  use: "landing" | "sample" | "seed";
  seller?: "Hailey" | "Maya" | "Jon" | "Priya" | "Marcus" | "Sofia" | "Wen" | "Amara" | "Diego" | "Noor" | "Kenji" | "Fatima" | "Luca" | "Tomás" | "Aisha" | "Hana" | "Ravi" | "Elena" | "Jamal";
  title: string;
  priceCents: number;
  size?: string;
  description: string;
};

export const STOCK: StockPhoto[] = [
  { file: "north-face-fleece.jpg", use: "landing", title: "North Face fleece jacket", priceCents: 3500, size: "M", description: "Black Denali-style fleece with zip pockets, warm and lightly worn." },
  { file: "gisou-hair-perfume.jpg", use: "landing", title: "Gisou hair perfume", priceCents: 3000, description: "Honey infused hair perfume, 50 ml, mostly full." },
  { file: "sunkissed-morning-candle.jpg", use: "landing", title: "Sunkissed Morning candle", priceCents: 1200, description: "Large jar candle, barely burned." },
  { file: "fixx-setting-spray.jpg", use: "landing", title: "FIXX setting spray", priceCents: 1000, description: "All-day makeup setting spray, nearly full." },

  { file: "la-all-star-hoodie.jpg", use: "sample", title: "Los Angeles All-Star hoodie", priceCents: 1800, size: "M", description: "Heather gray pullover hoodie with an embroidered Los Angeles All-Star logo." },
  { file: "john-galt-striped-shirt.jpg", use: "sample", title: "John Galt striped button-down", priceCents: 1600, size: "One size", description: "Soft blue and white pinstripe button-down with a chest pocket." },
  { file: "aperire-berry-tint.jpg", use: "sample", title: "Aperire berry tint", priceCents: 800, description: "Berry lip and cheek tint, swatched once." },
  { file: "cinnamoroll-tin.jpg", use: "sample", title: "Cinnamoroll mint tin", priceCents: 600, description: "Sanrio Cinnamoroll tin, great for small things." },
  { file: "after-sun-eau-de-toilette.jpg", use: "sample", title: "After Sun eau de toilette", priceCents: 1400, description: "Fresh summery eau de toilette, most of the bottle left." },

  { file: "black-skinny-jeans.jpg", use: "seed", seller: "Hailey", title: "Black skinny jeans", priceCents: 2200, size: "28", description: "Washed black skinny jeans with a mid rise and plenty of stretch." },
  { file: "knit-sweater.jpg", use: "seed", seller: "Hailey", title: "Cable knit sweater", priceCents: 2800, size: "M", description: "Chunky oatmeal wool cable knit sweater, cozy and warm." },
  { file: "wide-leg-jeans.jpg", use: "seed", seller: "Maya", title: "Wide leg jeans", priceCents: 2500, size: "27", description: "Medium wash high waisted wide leg jeans, cropped at the ankle." },
  { file: "flannel-shirt.jpg", use: "seed", seller: "Maya", title: "Plaid flannel shirt", priceCents: 2000, size: "L", description: "Red and black buffalo plaid flannel button up shirt." },
  { file: "mom-jeans.jpg", use: "seed", seller: "Jon", title: "Mom jeans", priceCents: 1800, size: "28", description: "Light blue vintage mom jeans with a paper bag waist and tie belt." },
  { file: "denim-jacket.jpg", use: "seed", seller: "Jon", title: "Denim trucker jacket", priceCents: 3500, size: "L", description: "Classic medium blue denim trucker jacket, nicely faded." },

  // Priya, Inner Mission
  { file: "monstera-plant.jpg", use: "seed", seller: "Priya", title: "Monstera houseplant", priceCents: 1800, description: "Big healthy monstera in a terracotta pot, about 3 ft tall." },
  { file: "ceramic-vases.jpg", use: "seed", seller: "Priya", title: "Ceramic vase set", priceCents: 1500, description: "Three handmade stoneware vases in cream and sage." },
  { file: "yoga-mat.jpg", use: "seed", seller: "Priya", title: "Yoga mat", priceCents: 1200, description: "6 mm cork yoga mat with carry strap, barely used." },
  { file: "linen-dress.jpg", use: "seed", seller: "Priya", title: "Linen midi dress", priceCents: 2800, size: "M", description: "Oatmeal linen midi dress with pockets." },

  // Marcus, Potrero Hill
  { file: "road-bike.jpg", use: "seed", seller: "Marcus", title: "Vintage road bike", priceCents: 12000, description: "Steel frame road bike, 56 cm, new tires and tuned up." },
  { file: "skateboard.jpg", use: "seed", seller: "Marcus", title: "Skateboard", priceCents: 3500, description: "8.25 deck with soft wheels, good for cruising." },
  { file: "film-camera.jpg", use: "seed", seller: "Marcus", title: "35mm film camera", priceCents: 6000, description: "Manual SLR with a 50 mm lens, light meter works." },
  { file: "bike-helmet.jpg", use: "seed", seller: "Marcus", title: "Bike helmet", priceCents: 2000, size: "M", description: "Matte black commuter helmet, no crashes." },

  // Sofia, Castro
  { file: "record-player.jpg", use: "seed", seller: "Sofia", title: "Record player", priceCents: 7500, description: "Belt drive turntable with built-in preamp." },
  { file: "vinyl-records.jpg", use: "seed", seller: "Sofia", title: "Crate of vinyl records", priceCents: 2500, description: "About 30 LPs, mostly soul and 80s pop." },
  { file: "wool-blanket.jpg", use: "seed", seller: "Sofia", title: "Wool throw blanket", priceCents: 2000, description: "Heavy cream wool throw, no pilling." },
  { file: "leather-boots.jpg", use: "seed", seller: "Sofia", title: "Leather ankle boots", priceCents: 4500, size: "8", description: "Brown leather Chelsea boots, resoled once." },

  // Wen, SoMa
  { file: "mechanical-keyboard.jpg", use: "seed", seller: "Wen", title: "Mechanical keyboard", priceCents: 4500, description: "75% layout, brown switches, USB-C." },
  { file: "desk-chair.jpg", use: "seed", seller: "Wen", title: "Desk chair", priceCents: 5000, description: "Mesh back office chair with adjustable arms." },
  { file: "espresso-maker.jpg", use: "seed", seller: "Wen", title: "Espresso maker", priceCents: 3000, description: "Single boiler espresso machine with steam wand." },
  { file: "monitor.jpg", use: "seed", seller: "Wen", title: "27 inch monitor", priceCents: 9000, description: "27 inch 1440p monitor, no dead pixels, with stand." },

  // Amara, Eureka Valley
  { file: "wooden-toys.jpg", use: "seed", seller: "Amara", title: "Wooden toy set", priceCents: 1500, description: "Stacking rings, blocks and a pull-along duck." },
  { file: "acoustic-guitar.jpg", use: "seed", seller: "Amara", title: "Acoustic guitar", priceCents: 9000, description: "Dreadnought acoustic with a soft case and new strings." },
  { file: "stack-of-books.jpg", use: "seed", seller: "Amara", title: "Stack of novels", priceCents: 1000, description: "Eight paperbacks, recent fiction, read once." },
  { file: "kids-rain-jacket.jpg", use: "seed", seller: "Amara", title: "Kids rain jacket", priceCents: 1200, size: "5T", description: "Yellow kids rain jacket, zips and snaps." },

  // Diego, Lower Haight
  { file: "vintage-armchair.jpg", use: "seed", seller: "Diego", title: "Vintage armchair", priceCents: 8000, description: "Mid-century armchair, walnut arms, green upholstery." },
  { file: "floor-rug.jpg", use: "seed", seller: "Diego", title: "Wool area rug", priceCents: 6000, description: "5 by 8 flatweave rug in rust and navy." },
  { file: "table-lamp.jpg", use: "seed", seller: "Diego", title: "Brass table lamp", priceCents: 2200, description: "Brass table lamp with a linen shade." },
  { file: "wall-mirror.jpg", use: "seed", seller: "Diego", title: "Round wall mirror", priceCents: 3000, description: "24 inch round mirror with a thin black frame." },

  // Noor, Western Addition
  { file: "cast-iron-pan.jpg", use: "seed", seller: "Noor", title: "Cast iron skillet", priceCents: 2500, description: "12 inch cast iron skillet, seasoned." },
  { file: "stand-mixer.jpg", use: "seed", seller: "Noor", title: "Stand mixer", priceCents: 12000, description: "5 quart stand mixer with bowl and three attachments." },
  { file: "dutch-oven.jpg", use: "seed", seller: "Noor", title: "Enameled dutch oven", priceCents: 4500, description: "6 quart enameled dutch oven, red." },
  { file: "knife-set.jpg", use: "seed", seller: "Noor", title: "Kitchen knife set", priceCents: 3500, description: "Chef, bread and paring knives in a block." },

  // Kenji, Haight-Ashbury
  { file: "surfboard.jpg", use: "seed", seller: "Kenji", title: "Surfboard", priceCents: 25000, description: "7 ft 6 funboard with fins and a leash." },
  { file: "wetsuit.jpg", use: "seed", seller: "Kenji", title: "Wetsuit", priceCents: 8000, size: "L", description: "4/3 wetsuit, a few seasons of use." },
  { file: "camping-tent.jpg", use: "seed", seller: "Kenji", title: "Two person tent", priceCents: 6000, description: "Lightweight two person tent with footprint." },
  { file: "hiking-boots.jpg", use: "seed", seller: "Kenji", title: "Hiking boots", priceCents: 5000, size: "10", description: "Waterproof leather hiking boots, broken in." },

  // Fatima, Alamo Square
  { file: "sewing-machine.jpg", use: "seed", seller: "Fatima", title: "Sewing machine", priceCents: 7000, description: "Computerized sewing machine with pedal and case." },
  { file: "fabric-bolts.jpg", use: "seed", seller: "Fatima", title: "Fabric bundle", priceCents: 1500, description: "Assorted cotton prints, about 6 yards total." },
  { file: "knitting-yarn.jpg", use: "seed", seller: "Fatima", title: "Yarn lot", priceCents: 1200, description: "Twelve skeins of wool blend yarn, mixed colors." },
  { file: "wool-coat.jpg", use: "seed", seller: "Fatima", title: "Camel wool coat", priceCents: 6500, size: "S", description: "Camel wool overcoat, dry cleaned." },

  // Luca, Union Square
  { file: "pasta-maker.jpg", use: "seed", seller: "Luca", title: "Pasta maker", priceCents: 2500, description: "Hand crank pasta roller with two cutters." },
  { file: "wine-glasses.jpg", use: "seed", seller: "Luca", title: "Wine glasses", priceCents: 1800, description: "Set of six stemmed wine glasses." },
  { file: "coffee-grinder.jpg", use: "seed", seller: "Luca", title: "Burr coffee grinder", priceCents: 4000, description: "Conical burr grinder, 40 settings." },
  { file: "bar-stools.jpg", use: "seed", seller: "Luca", title: "Pair of bar stools", priceCents: 7000, description: "Two counter height oak bar stools." },

  // Tomás, Lower Nob Hill
  { file: "suit-jacket.jpg", use: "seed", seller: "Tomás", title: "Navy blazer", priceCents: 5500, size: "40R", description: "Navy wool blazer, tailored, two button." },
  { file: "dress-shoes.jpg", use: "seed", seller: "Tomás", title: "Leather oxfords", priceCents: 6000, size: "10.5", description: "Black cap toe oxfords, resoled." },
  { file: "leather-briefcase.jpg", use: "seed", seller: "Tomás", title: "Leather briefcase", priceCents: 8000, description: "Brown leather briefcase with brass hardware." },
  { file: "wristwatch.jpg", use: "seed", seller: "Tomás", title: "Field watch", priceCents: 9000, description: "Automatic field watch on a canvas strap." },

  // Aisha, Mission Dolores
  { file: "stroller.jpg", use: "seed", seller: "Aisha", title: "Jogging stroller", priceCents: 9000, description: "Three wheel jogging stroller, folds flat." },
  { file: "high-chair.jpg", use: "seed", seller: "Aisha", title: "Wooden high chair", priceCents: 4000, description: "Adjustable wooden high chair with tray." },
  { file: "kids-bike.jpg", use: "seed", seller: "Aisha", title: "Kids bike", priceCents: 6000, description: "16 inch kids bike with training wheels." },
  { file: "board-games.jpg", use: "seed", seller: "Aisha", title: "Board game bundle", priceCents: 2500, description: "Five family board games, all pieces present." },

  // Hana, Duboce Triangle
  { file: "garden-tools.jpg", use: "seed", seller: "Hana", title: "Garden tool set", priceCents: 2000, description: "Trowel, pruners, fork and gloves." },
  { file: "terracotta-pots.jpg", use: "seed", seller: "Hana", title: "Terracotta pots", priceCents: 1500, description: "Eight terracotta pots, assorted sizes." },
  { file: "patio-chairs.jpg", use: "seed", seller: "Hana", title: "Patio chairs", priceCents: 6000, description: "Two folding teak patio chairs." },
  { file: "bird-feeder.jpg", use: "seed", seller: "Hana", title: "Bird feeder", priceCents: 1000, description: "Cedar bird feeder with a hanging chain." },

  // Ravi, Japantown
  { file: "tennis-racket.jpg", use: "seed", seller: "Ravi", title: "Tennis racket", priceCents: 4000, description: "Graphite racket, grip 4 3/8, freshly strung." },
  { file: "golf-clubs.jpg", use: "seed", seller: "Ravi", title: "Golf club set", priceCents: 15000, description: "Full set of irons and a driver with bag." },
  { file: "running-shoes.jpg", use: "seed", seller: "Ravi", title: "Running shoes", priceCents: 5000, size: "11", description: "Lightly used road running shoes, 60 miles." },
  { file: "dumbbells.jpg", use: "seed", seller: "Ravi", title: "Dumbbell pair", priceCents: 3000, description: "Pair of 20 lb rubber hex dumbbells." },

  // Elena, Mission Bay
  { file: "bookshelf.jpg", use: "seed", seller: "Elena", title: "Oak bookshelf", priceCents: 9000, description: "Solid oak five shelf bookcase." },
  { file: "dining-table.jpg", use: "seed", seller: "Elena", title: "Dining table", priceCents: 15000, description: "Round walnut dining table, seats four." },
  { file: "floor-lamp.jpg", use: "seed", seller: "Elena", title: "Tripod floor lamp", priceCents: 4500, description: "Wood tripod floor lamp with a drum shade." },
  { file: "framed-print.jpg", use: "seed", seller: "Elena", title: "Framed art print", priceCents: 3500, description: "Large framed botanical print, 24 by 36." },

  // Jamal, Civic Center
  { file: "electric-guitar.jpg", use: "seed", seller: "Jamal", title: "Electric guitar", priceCents: 22000, description: "Solid body electric guitar with gig bag." },
  { file: "guitar-amp.jpg", use: "seed", seller: "Jamal", title: "Guitar amp", priceCents: 12000, description: "20 watt tube combo amp, one owner." },
  { file: "headphones.jpg", use: "seed", seller: "Jamal", title: "Over-ear headphones", priceCents: 7000, description: "Closed back studio headphones, new pads." },
  { file: "keyboard-piano.jpg", use: "seed", seller: "Jamal", title: "Digital piano", priceCents: 25000, description: "88 key weighted digital piano with stand." },
];
