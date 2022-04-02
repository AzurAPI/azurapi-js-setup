import { keepIfInEnum, normalizeName } from "../../utils";
import { StandardNamedSkins, SkinCategories } from "./SkinPage.types";
import type { BaseSkinCardStrategy } from "./FindCardsStrategies/BaseStrategy";
import FindAllSkinsStrategy from "./FindCardsStrategies/FindAllSkinsStrategy";
import SkinCard from "./SkinCard";
import { knownInconsistent } from "./knownInconsistent";

type Props = {
  doc: Document;
  notJustLimited: boolean;
};
type BoatSkinMap = Map<string, SkinCategories>;
/**
 * Give me the Skins page parsed with JSDOM.
 */
class SkinPage {
  /**
   * Array of all the skins I could find on the Skins page.
   */
  private cards: SkinCard[] = [];
  findCardsStrategy: BaseSkinCardStrategy;
  categories: Set<string> = new Set();
  boatSkinMap = new Map<string, BoatSkinMap>();

  constructor({ doc }: Props) {
    this.checkCategories(doc);
    this.findCardsStrategy = new FindAllSkinsStrategy();

    this.cards = this.findCardsStrategy.findCards(doc).map(SkinCard.initialize);
    this.cards.forEach((c) => {
      const boatName = normalizeName(c.boatName);
      const category = c.skinCategory;
      let skinName = normalizeName(c.skinName);

      if (c.isRetrofit || c.isWedding || c.isOriginalArt) {
        // Can't match up by name if ^.
        // Skin page isn't supposed to have default skins...
        skinName =
          c.skinName === StandardNamedSkins.Default
            ? StandardNamedSkins.Default
            : c.isRetrofit
            ? StandardNamedSkins.Retrofit
            : c.isWedding
            ? StandardNamedSkins.Wedding
            : StandardNamedSkins.OriginalArt;
      }

      if (this.boatSkinMap.has(boatName)) {
        const bEntry = this.boatSkinMap.get(boatName);
        bEntry.set(skinName, category);
        this.boatSkinMap.set(boatName, bEntry);
      } else {
        const skinToCategory = new Map([[skinName, category]]);
        this.boatSkinMap.set(boatName, skinToCategory);
      }
      // Polyfill missing skins on Skin page (see knownBad.ts).
      for (const missingSkin of knownInconsistent) {
        if (boatName === missingSkin.boatName) {
          const bEntry = this.boatSkinMap.get(boatName);
          missingSkin.skins.forEach((missing) =>
            bEntry.set(missing.skinName, missing.category as SkinCategories)
          );
          this.boatSkinMap.set(boatName, bEntry);
        }
      }
    });
  }

  /**
   *
   * @returns LimitedSkinModel[]
   */
  findNamesInCards() {
    if (this.cards.length === 0) {
      throw new Error("Gotta load the skins first, pal.");
    }
  }

  checkCategories(doc: Document) {
    doc.querySelectorAll("article").forEach((tabber) => {
      const heading = tabber.getAttribute("title");
      if (!keepIfInEnum(heading, SkinCategories)) {
        throw new Error(`New or unknown skin category: ${heading}`);
      }
    });
  }
}

export default SkinPage;
