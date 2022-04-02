import { normalizeName } from "../../utils";
import { SkinCategories } from "./SkinPage.types";
/**
 * Some skins are missing or aren't named the same
 * between the Skins page and the ship's gallery.
 *
 * For Example:
 * @link
 * https://azurlane.koumakan.jp/wiki/Uzuki/Gallery#Sleepy_Uzuki-0
 *
 * as compared to
 *
 * https://azurlane.koumakan.jp/wiki/Skins#Miscellaneous-0
 *
 *  Ctrl+f for Uzuki to find her easier
 */
export const knownInconsistent = [
  {
    boatName: "Javelin",
    skins: [
      {
        skinName: "Beach Picnic!",
        category: SkinCategories.Swimsuits,
      },
      {
        skinName: "Operation: Pillow Fight!",
        category: SkinCategories.Bluray,
      },
    ],
  },
  {
    boatName: "Southampton",
    skins: [
      {
        skinName: "Afternoon Impromptu",
        category: SkinCategories.Maid,
      },
    ],
  },
  {
    boatName: "Fubuki",
    skins: [
      {
        skinName: "Mascot Bucky",
        category: SkinCategories.Event,
      },
    ],
  },
  {
    boatName: "Nagara",
    skins: [
      {
        skinName: "Spring Breeze Leisure",
        category: SkinCategories.Event,
      },
    ],
  },
  {
    boatName: "Yamashiro",
    skins: [
      {
        skinName: "Sales Clerk Offensive?!",
        category: SkinCategories.Event,
      },
    ],
  },
  {
    boatName: "Uzuki",
    skins: [
      {
        skinName: "Sleepy Uzuki",
        category: SkinCategories.Event,
      },
    ],
  },
  {
    boatName: "Ōkami Mio",
    skins: [{ skinName: "Summer Vacation", category: SkinCategories.Collab }],
  },
  {
    boatName: "Nakiri Ayame",
    skins: [{ skinName: "Summertime Nakiri", category: SkinCategories.Collab }],
  },
  {
    boatName: "Minato Aqua",
    skins: [{ skinName: "Marine Maid", category: SkinCategories.Collab }],
  },
  {
    boatName: "Tokino Sora",
    skins: [{ skinName: "Under the Clear Sky", category: SkinCategories.Collab }],
  },
  {
    boatName: "Shirakami Fubuki",
    skins: [{ skinName: "Beachside Fox", category: SkinCategories.Collab }],
  },
  {
    boatName: "Long Island",
    skins: [
      {
        skinName: "Long Island - Indoor Slacker",
        category: SkinCategories.Miscellaneous,
      },
    ],
  },
  {
    boatName: "Hornet",
    skins: [{ skinName: "Freshly-Baked Bonding!", category: SkinCategories.Miscellaneous }],
  },
].map((skin) => ({
  boatName: normalizeName(skin.boatName),
  skins: skin.skins.map((s) => ({
    skinName: normalizeName(s.skinName),
    category: s.category,
  })),
}));
