export const isDiv = (e: Element | null): e is HTMLDivElement => {
  return e !== null && e.tagName === "DIV";
};

/**
 * Using a fancy-pants strategy because
 *  we could extend this if we get imaginative.
 * If all cards or just limited, or maybe even non-limited in the future
 */
export abstract class BaseSkinCardStrategy {
  constructor() {}

  /**
   * This function should traverse the skins page and return shipcards.
   * Like the whole element. <div class="azl-shipcard".../> yada yda
   * @param doc The Skins page
   */
  abstract findCards(doc: Document): HTMLDivElement[];
}
