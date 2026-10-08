export type TreeStatus = "Available" | "Reserved" | "Sold" | "Exported";

export interface Tree {
  name: string;
  latin: string;
  origin: string;
  size: "Shito" | "Mame" | "Shohin" | "Medium" | "Large" | "XL";
  style:
    | "Informal Upright"
    | "Cascade"
    | "Semi-Cascade"
    | "Twin Trunk"
    | "Bunjin"
    | "On The Rock"
    | "Clump"
    | "Broom"
    | "Natural Style";
  status: TreeStatus;
  image: string;
  story: string;
}

export const trees: Tree[] = [
  {
    name: "Santigi",
    latin: "Pemphis acidula",
    origin: "Indonesia",
    size: "Medium",
    style: "Semi-Cascade",
    status: "Sold",
    image: "tree-santigi",
    story:
      "A coastal soul shaped by wind. Silvery deadwood flows like water over stone, carrying a crown of dense emerald foliage — the tree that introduced Indonesian bonsai to the world.",
  },
  {
    name: "Sancang",
    latin: "Premna microphylla",
    origin: "Indonesia",
    size: "Large",
    style: "Informal Upright",
    status: "Available",
    image: "tree-sancang",
    story:
      "Power held in stillness. A powerfully tapered trunk rises from exposed roots into a broad, confident canopy — a commanding presence for any collection.",
  },
  {
    name: "Ficus",
    latin: "Ficus microcarpa",
    origin: "Indonesia",
    size: "XL",
    style: "Clump",
    status: "Available",
    image: "tree-ficus",
    story:
      "The banyan's patience, miniaturized. Aerial roots descend like temple pillars around a massive base — decades of tropical vigor in a single composition.",
  },
  {
    name: "Anting Putri",
    latin: "Wrightia religiosa",
    origin: "Indonesia",
    size: "Shohin",
    style: "Natural Style",
    status: "Reserved",
    image: "tree-anting-putri",
    story:
      "Delicacy as discipline. Fine branching, tiny leaves, and fragrant white blossoms — the feminine ideal of Southeast Asian bonsai, refined over years.",
  },
  {
    name: "Cemara",
    latin: "Juniperus chinensis",
    origin: "Indonesia",
    size: "Large",
    style: "Bunjin",
    status: "Available",
    image: "tree-cemara",
    story:
      "A literati's meditation. Twisted living vein against bleached deadwood, foliage drifting like mountain mist — poetry written in wood and needle.",
  },
  {
    name: "Ulmus",
    latin: "Ulmus parvifolia",
    origin: "China",
    size: "Medium",
    style: "Broom",
    status: "Exported",
    image: "tree-ulmus",
    story:
      "Now rooted in a collection abroad. A classic broom of finely ramified branches — proof that great trees from D'Uma travel well and thrive anew.",
  },
];

export const species = [...new Set(trees.map((t) => t.name))];
export const sizes = ["Shito", "Mame", "Shohin", "Medium", "Large", "XL"];
export const styles = [...new Set(trees.map((t) => t.style))];
export const statuses: TreeStatus[] = ["Available", "Reserved", "Sold", "Exported"];
