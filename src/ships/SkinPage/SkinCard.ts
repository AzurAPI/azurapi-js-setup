import { keepIfInEnum } from "../../utils";
import { SkinCategories } from "./SkinPage.types";

const UnobtainableRegex = new RegExp("Unobtainable", "m");
const RetrofitRegex = new RegExp("Retrofit", "m");

class SkinCard {
  skinName: string;
  boatName: string;
  skinCategory: SkinCategories;
  /**
   * In the NA client, at least.
   */
  limited: boolean;
  /*
   * False except for like 12 skins
   */
  isOriginalArt: boolean;
  /**
   * Also if skin category is 'Retrofit', now that I implement this...
   */
  isRetrofit: boolean;
  isWedding: boolean;
  // Initializer so you can use `.map` to make SkinCard instances.
  static initialize(card: HTMLDivElement): SkinCard {
    return new SkinCard(card);
  }

  constructor(card: HTMLDivElement) {
    const boatName = card.querySelector("div.alc-top > a");
    const skinName = card.querySelector("div.alc-bottom > a > b");
    if (!boatName || !boatName.textContent) {
      console.error(boatName);
      throw new Error("Could not find boat name on a card");
    }
    if (!skinName || !skinName.textContent) {
      throw new Error("Could not find skin name on a card");
    }

    this.boatName = boatName.textContent;
    this.skinName = skinName.textContent;

    this.limited = !!card.querySelector("img[alt='LIMITED.png']"); // If LIMITED picture on a limited skincard
    this.skinCategory = this.findClosestCategory(card);
    this.isRetrofit = RetrofitRegex.test(this.skinName);
    if (this.isRetrofit) {
      this.skinCategory = SkinCategories.Retrofit;
    }
    if (this.skinCategory === SkinCategories.Wedding) {
      this.isWedding = true;
    }
    if (this.skinCategory === SkinCategories.Unobtainable) {
      this.isOriginalArt = true;
    }
  }

  /**
   * This will break if Unobtainable skins get put into an <article/>
   */
  private findClosestCategory = (card: Element): SkinCategories | null => {
    const cat = card.closest("article");
    if (cat === null) {
      /**
       * No article title on ONLY the Unobtainable section.
       */
      const cardBottom = card.querySelector(".alc-bottom").textContent;
      if (UnobtainableRegex.test(cardBottom)) {
        return SkinCategories.Unobtainable;
      }
      console.error(card.innerHTML);
      throw "fug";
    }
    const catTitle = cat.getAttribute("data-title").trim();
    const keptCat = keepIfInEnum(catTitle, SkinCategories);
    if (keptCat === undefined) {
      throw new Error("Could not find category for ship card");
    }
    return keptCat;
  };
}

export default SkinCard;
