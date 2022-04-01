import { JSDOM } from "jsdom";
import fs from "fs/promises";
import { fetch, BASE } from "../../utils";
import SkinPage from "./SkinPage";
const SKINS_PAGE = BASE + "/" + "/wiki/Skins";

type SkinPageReaderProps = {
  doc: Document;
};
class SkinPageReader {
  skinPage: SkinPage;

  /**
   * No point of one of these bad boys without a page of skins and a list of ships.
   * Run this function to get an instance.
   * @returns ShipSkinUpdater
   */
  static async initialize() {
    const page = await fetch(SKINS_PAGE, "web/skins.html");

    return new SkinPageReader({
      doc: new JSDOM(page).window.document,
    });
  }

  constructor(props: SkinPageReaderProps) {
    const skinPage = new SkinPage({
      doc: props.doc,
      notJustLimited: true,
    });
    this.skinPage = skinPage;
    console.info("[SkinPage] Loaded!");
  }
}

export default SkinPageReader;
