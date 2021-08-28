import {JSDOM} from "jsdom";
import path from "path";
import {BASE, camelize, fetch, galleryThumbnailUrlToActualUrl} from "../utils";
import {GalleryItem, Skin, SkinInfo} from "./ship";

export async function fetchGallery(name: string): Promise<{ skins: Skin[], gallery: GalleryItem[] }> {
    let skins: Skin[] = [];
    let gallery: GalleryItem[] = [];
    let doc = new JSDOM(await fetch(BASE + "/" + encodeURIComponent(name) + "/Gallery", path.resolve(__dirname, '..', '..', 'web/ships.gallery/' + name + '.html'))).window.document;
    Array.from(doc.querySelectorAll(".mw-parser-output>.tabber>.tabbertab")).forEach(node => {
        let image;
        let tab = <HTMLElement>node;
        if (tab.querySelector(".tabbertab")) image = {
            normal: tab.querySelector(".tabbertab[title=Default] .shipskin-image img") ? (<HTMLImageElement>tab.querySelector(".tabbertab[title=Default] .shipskin-image img")).src : null,
            nobg: tab.querySelector('.tabbertab[title="Without BG"] .shipskin-image img') ? (<HTMLImageElement>tab.querySelector('.tabbertab[title="Without BG"] .shipskin-image img')).src : null,
            cn: tab.querySelector(".tabbertab[title=CN] .shipskin-image img") ? (<HTMLImageElement>tab.querySelector(".tabbertab[title=CN] .shipskin-image img")).src : null
        };
        else image = tab.querySelector(".shipskin-image img") ? (<HTMLImageElement>tab.querySelector(".shipskin-image img")).src : null;
        let info: SkinInfo = {live2dModel: false, obtainedFrom: ""};
        tab.querySelectorAll(".shipskin-table tr").forEach(row => {
            let key = camelize(row.getElementsByTagName("th")[0].textContent.toLowerCase().trim());
            let value: any = row.getElementsByTagName("td")[0].textContent.trim();
            if (key === "live2dModel") value = (value === "Yes");
            if (key === "cost") value = parseInt(value);
            // @ts-ignore
            return info[key] = value;
        });
        skins.push({
            name: tab.title,
            image: typeof (image) === "string" || (!image) ? <string>image : image.normal,
            nobg: typeof (image) === "string" || (!image) ? undefined : image.nobg,
            cn: typeof (image) === "string" || (!image) ? undefined : image.cn,
            background: tab.querySelector(".res img") ? tab.querySelector(".res img").getAttribute("src") : null,
            chibi: tab.querySelector(".shipskin-content .shipskin-chibi img") ? tab.querySelector(".shipskin-content .shipskin-chibi img").getAttribute("src") : null,
            info: info
        });
    });

    if (doc.getElementById("Artwork"))
        Array.from(doc.getElementById("Artwork").parentElement.nextElementSibling.children).filter(e => e.tagName === "DIV").forEach(box => gallery.push({
            description: box.lastElementChild.textContent.trim(),
            url: galleryThumbnailUrlToActualUrl(box.querySelector("img").src)
        }));
    else Array.from(doc.getElementsByClassName("gallerybox")).forEach(box => gallery.push({
        description: box.getElementsByClassName("gallerytext")[0].textContent.trim(),
        url: galleryThumbnailUrlToActualUrl(box.getElementsByTagName("img")[0].src)
    }));
    return {
        skins: skins,
        gallery: gallery
    };
}