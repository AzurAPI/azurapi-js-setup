import { JSDOM } from "jsdom";
import path from "path";
import {
  BASE,
  camelize,
  fetch,
  galleryThumbnailUrlToActualUrl,
  keepIfInEnum,
  normalizeName,
} from "../utils";
import { GalleryItem, Skin, SkinInfo, SkinLimitedStatus } from "./ship";
import SkinPage from "./SkinPage";
import { StandardNamedSkins, SkinCategories } from "./SkinPage/SkinPage.types";

let _SkinPage: SkinPage;
const getSkinsPage = async () => {
  if (_SkinPage === undefined) {
    //@ts-ignore
    _SkinPage = SkinPage.initialize();
    return _SkinPage;
  }
  return _SkinPage;
};

const ClientSkinNameHeaders = Object.freeze<Record<string, string>>({
  enClient: "enLimited",
  cnClient: "cnLimited",
  jpClient: "jpLimited",
});

const handleLtdSkin = (
  row: Element
): { clientSkinName: string; clientSkinLtd: string | undefined } => {
  const [clientNameElement, clientLtdElement] = row.getElementsByTagName("td");

  const clientSkinName = clientNameElement.textContent.trim();
  if (clientSkinName.toLowerCase() === "skin unavailable") {
    // i.e. https://azurlane.koumakan.jp/wiki/Rodney/Gallery#One_Day_as_a_Trainee_Clerk-0
    return {
      clientSkinName,
      clientSkinLtd: SkinLimitedStatus.Unavailable, // Can't leave 'undefined' because regular skins also have this field undefined.
    };
  }
  const clientSkinLtd: string | undefined = clientLtdElement
    ? clientLtdElement.textContent.trim()
    : undefined;

  if (keepIfInEnum(clientSkinLtd, SkinLimitedStatus)) {
    return { clientSkinName, clientSkinLtd };
  }
  // Skin limit is not known to us - throw up.
  throw new Error(clientSkinName);
};

const handleSkinCategory = ({
  name,
  skinName,
  skinsPage,
}: {
  name: string;
  skinName: string;
  skinsPage: SkinPage;
}): SkinCategories => {
  // 'Default', 'Retrofit', 'Wedding', and 'Original Art' skins can be categorized from name alone.
  if (keepIfInEnum(skinName, StandardNamedSkins)) {
    // const category = !isNotGatedSkin
    // ? skinPageData.get(skinname)
    // : skinname === NonGatedSkinNames.Default
    // ? SkinCategories.Default
    // : skinname === NonGatedSkinNames.Retrofit
    // ? SkinCategories.Retrofit
    // : skinname === NonGatedSkinNames.Wedding
    // ? SkinCategories.Wedding
    // : SkinCategories.Unobtainable;

    return keepIfInEnum(skinName, SkinCategories);
  }
  const entry = skinsPage.skinPage.boatSkinMap.get(name);
  // If entry is undefined, this ship is missing a skin on the Skin page and we didnt put it
  // into `knownBad.ts`.
  if (entry === undefined) {
    throw new Error(`${name} is missing all skins on Skins page.`);
  }
  const skinCategory = entry.get(skinName);

  if (keepIfInEnum(skinCategory, SkinCategories)) {
    return skinCategory;
  }
  throw new Error(`${name} is missing skin ${skinName} on Skins page, but has skin in Gallery.`);
};

export async function fetchGallery(
  name: string,
  url: string
): Promise<{ skins: Skin[]; gallery: GalleryItem[] }> {
  name = normalizeName(name);
  const skinsPage = await getSkinsPage();
  let skins: Skin[] = [];
  let gallery: GalleryItem[] = [];
  let doc = new JSDOM(
    await fetch(
      BASE + "/" + url + "/Gallery",
      path.resolve(__dirname, "..", "..", "web/ships.gallery/" + name + ".html")
    )
  ).window.document;
  Array.from(doc.querySelectorAll(".mw-parser-output>.tabber>.tabber__section>article")).forEach(
    (node) => {
      let tab = <HTMLElement>node;

      const skinName = normalizeName(tab.getAttribute("data-title"));
      let skinCategory;
      try {
        skinCategory = handleSkinCategory({ name, skinName, skinsPage });
      } catch (e) {
        console.log(e);
      }
      let image;
      if (tab.querySelector(".tabber__panel"))
        image = {
          normal: tab.querySelector(".tabber__panel[title=Default] .shipskin-image img")?.getAttribute("src"),
          nobg: tab.querySelector('.tabber__panel[title="Without BG"] .shipskin-image img')?.getAttribute("src"),
          cn: tab.querySelector(".tabber__panel[title=CN] .shipskin-image img")?.getAttribute("src")
        };
      else
        image = tab.querySelector(".shipskin-image img")?.getAttribute("src");

      let info: SkinInfo = {
        live2dModel: false,
        obtainedFrom: "",
        category: skinCategory,
      };

      tab.querySelectorAll(".shipskin-table tr").forEach((row) => {
        let key = camelize(row.getElementsByTagName("th")[0].textContent.toLowerCase().trim());
        let value: any = row.getElementsByTagName("td")[0].textContent.trim();

        if (key === "live2dModel") value = value === "Yes";
        if (key === "cost") value = parseInt(value);

        if (ClientSkinNameHeaders[key]) {
          // Because skins have different names on different clients,
          // each skin's Gallery page has a row for their localized name.
          // Next to that is the availability in that client.
          try {
            const { clientSkinLtd, clientSkinName } = handleLtdSkin(row);
            info[key] = clientSkinName;
            info[ClientSkinNameHeaders[key]] = clientSkinLtd;
            return;
          } catch (err) {
            console.error(
              "Error finding limited-skin info for ship: %s Skin: %s",
              name,
              err.message
            );
          }
        }
        return (info[key] = value);
      });
      if (info.category === undefined) {
        console.error(`gallery.ts: MIssing skin for ${name}:${skinName}`);
      }
      skins.push({
        name: skinName,
        image: typeof image === "string" || !image ? <string>image : image.normal,
        nobg: typeof image === "string" || !image ? undefined : image.nobg,
        cn: typeof image === "string" || !image ? undefined : image.cn,
        background: tab.querySelector(".shipskin-content .shipskin-bg img")?.getAttribute("src"),
        chibi: tab.querySelector(".shipskin-content .shipskin-chibi img")?.getAttribute("src"),
        info: info,
      });
    }
  );

  if (
    doc.getElementById("Artwork") &&
    doc.getElementById("Artwork").parentElement.nextElementSibling
  )
    Array.from(doc.getElementById("Artwork").parentElement.nextElementSibling.children)
      .filter((e) => e.tagName === "DIV")
      .forEach((box) =>
        gallery.push({
          description: box.lastElementChild.textContent.trim(),
          url: galleryThumbnailUrlToActualUrl(box.querySelector("img").src),
        })
      );
  else
    Array.from(doc.getElementsByClassName("gallerybox")).forEach((box) =>
      gallery.push({
        description: box.getElementsByClassName("gallerytext")[0].textContent.trim(),
        url: galleryThumbnailUrlToActualUrl(box.getElementsByTagName("img")[0].src),
      })
    );
  Array.from(
    doc.querySelectorAll(
      ".azl-shipart-gallery .shipart-frame, .shipgirl-art-gallery .shipgirl-art-frame, .shipgirl-gallery .shipgirl-frame"
    )
  ).forEach((box) =>
    gallery.push({
      description: box
        .querySelector(".shipart-caption, .shipgirl-art-caption, .shipgirl-caption")
        .textContent.trim(),
      url: galleryThumbnailUrlToActualUrl(box.getElementsByTagName("img")[0].src),
    })
  );
  return {
    skins: skins,
    gallery: gallery,
  };
}
