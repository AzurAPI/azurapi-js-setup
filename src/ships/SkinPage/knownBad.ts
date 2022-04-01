import { normalizeName } from "../../utils";
import { SkinCategories } from "./SkinPage.types";
export const knownBad = [
  {
    boatName: normalizeName("Javelin"),
    skins: [
      {
        skinName: normalizeName("Beach Picnic!"),
        category: SkinCategories.Swimsuits,
      },
      {
        skinName: normalizeName("Operation: Pillow Fight!"),
        category: SkinCategories.Bluray,
      },
    ],
  },
  {
    boatName: "Southampton",
    skins: [
      {
        skinName: normalizeName("Afternoon Impromptu"),
        category: SkinCategories.Maid,
      },
    ],
  },
  {
    boatName: "Fubuki",
    skins: [
      {
        skinName: normalizeName("Mascot Bucky"),
        category: SkinCategories.Event,
      },
    ],
  },
  {
    boatName: "Nagara",
    skins: [
      {
        skinName: normalizeName("Spring Breeze Leisure"),
        category: SkinCategories.Event,
      },
    ],
  },
  {
    boatName: "Yamashiro",
    skins: [
      {
        skinName: normalizeName("Sales Clerk Offensive?!"),
        category: SkinCategories.Event,
      },
    ],
  },
  {
    boatName: "Uzuki",
    skins: [
      {
        skinName: normalizeName("Sleepy Uzuki"),
        category: SkinCategories.Event,
      },
    ],
  },
  {
    boatName: "Ōkami Mio",
    skins: [{ skinName: normalizeName("Summer Vacation"), category: SkinCategories.Collab }],
  },
  {
    boatName: "Nakiri Ayame",
    skins: [{ skinName: normalizeName("Summertime Nakiri"), category: SkinCategories.Collab }],
  },
  {
    boatName: "Minato Aqua",
    skins: [{ skinName: normalizeName("Marine Maid"), category: SkinCategories.Collab }],
  },
  {
    boatName: "Tokino Sora",
    skins: [{ skinName: normalizeName("Under the Clear Sky"), category: SkinCategories.Collab }],
  },
  {
    boatName: "Shirakami Fubuki",
    skins: [{ skinName: normalizeName("Beachside Fox"), category: SkinCategories.Collab }],
  },
  {
    boatName: "Long Island",
    skins: [
      {
        skinName: normalizeName("Long Island - Indoor Slacker"),
        category: SkinCategories.Miscellaneous,
      },
    ],
  },
  {
    boatName: "Hornet",
    skins: [
      { skinName: normalizeName("Freshly-Baked Bonding!"), category: SkinCategories.Miscellaneous },
    ],
  },
];
