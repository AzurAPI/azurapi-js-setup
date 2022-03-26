import { JSDOM } from "jsdom";
import path from "path";
import { BASE, camelize, fetch, galleryThumbnailUrlToActualUrl, keepIfInEnum } from "../utils";
import { GalleryItem, Skin, SkinInfo, SkinLimitedStatus } from "./ship";

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
  if (clientSkinName === "skin unavailable") {
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

export async function fetchGallery(
  name: string,
  url: string
): Promise<{ skins: Skin[]; gallery: GalleryItem[] }> {
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
      let image;
      let tab = <HTMLElement>node;
      if (tab.querySelector(".tabber__panel"))
        image = {
          normal: tab.querySelector(".tabber__panel[title=Default] .shipskin-image img")
            ? (<HTMLImageElement>(
                tab.querySelector(".tabber__panel[title=Default] .shipskin-image img")
              )).src
            : null,
          nobg: tab.querySelector('.tabber__panel[title="Without BG"] .shipskin-image img')
            ? (<HTMLImageElement>(
                tab.querySelector('.tabber__panel[title="Without BG"] .shipskin-image img')
              )).src
            : null,
          cn: tab.querySelector(".tabber__panel[title=CN] .shipskin-image img")
            ? (<HTMLImageElement>tab.querySelector(".tabber__panel[title=CN] .shipskin-image img"))
                .src
            : null,
        };
      else
        image = tab.querySelector(".shipskin-image img")
          ? (<HTMLImageElement>tab.querySelector(".shipskin-image img")).src
          : null;
      let info: SkinInfo = { live2dModel: false, obtainedFrom: "" };
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
      skins.push({
        name: tab.title,
        image: typeof image === "string" || !image ? <string>image : image.normal,
        nobg: typeof image === "string" || !image ? undefined : image.nobg,
        cn: typeof image === "string" || !image ? undefined : image.cn,
        background: tab.querySelector(".res img")
          ? tab.querySelector(".res img").getAttribute("src")
          : null,
        chibi: tab.querySelector(".shipskin-content .shipskin-chibi img")
          ? tab.querySelector(".shipskin-content .shipskin-chibi img").getAttribute("src")
          : null,
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
      ".azl-shipart-gallery .shipart-frame, .shipgirl-art-gallery .shipgirl-art-frame"
    )
  ).forEach((box) =>
    gallery.push({
      description: box.querySelector(".shipart-caption, .shipgirl-art-caption").textContent.trim(),
      url: galleryThumbnailUrlToActualUrl(box.getElementsByTagName("img")[0].src),
    })
  );
  return {
    skins: skins,
    gallery: gallery,
  };
}
