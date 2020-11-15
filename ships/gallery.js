const JSDOM = require('jsdom').JSDOM;
const path = require("path");
const {fetch, BASE, galleryThumbnailUrlToActualUrl, camelize} = require('../utils');

async function fetchGallery(name) {
    let skins = [];
    let gallery = [];
    let doc = new JSDOM(await fetch(BASE + "/" + encodeURIComponent(name) + "/Gallery", path.resolve(__dirname, '../web/ships.gallery/' + name + '.html'))).window.document;
    Array.from(doc.querySelectorAll(".mw-parser-output>.tabber>.tabbertab")).forEach(tab => {
        let image;
        if (tab.querySelector(".tabbertab")) image = {
            normal: tab.querySelector(".tabbertab[title=Normal] .shipskin-image img") ? BASE + tab.querySelector(".tabbertab[title=Normal] .shipskin-image img").src : null,
            nobg: tab.querySelector('.tabbertab[title="Without Background"] .shipskin-image img') ? BASE + tab.querySelector('.tabbertab[title="Without Background"] .shipskin-image img').src : null,
            cn: tab.querySelector(".tabbertab[title=CN] .shipskin-image img") ? BASE + tab.querySelector(".tabbertab[title=CN] .shipskin-image img").src : null
        };
        else image = tab.querySelector(".shipskin-image img") ? BASE + tab.querySelector(".shipskin-image img").src : null;
        let info = {};
        tab.querySelectorAll(".shipskin-table tr").forEach(row => info[camelize(row.getElementsByTagName("th")[0].textContent.toLowerCase().trim())] = row.getElementsByTagName("td")[0].textContent.trim());
        skins.push({
            name: tab.title,
            image: typeof (image) === "string" || (!image) ? image : image.normal,
            nobg: typeof (image) === "string" || (!image) ? undefined : image.nobg,
            cn: typeof (image) === "string" || (!image) ? undefined : image.cn,
            background: tab.querySelector(".res img") ? BASE + tab.querySelector(".res img").getAttribute("src") : null,
            chibi: tab.querySelector(".shipskin-lower .shipskin-chibi img") ? BASE + tab.querySelector(".shipskin-lower .shipskin-chibi img").getAttribute("src") : null,
            info: info
        });
    });
    Array.from(doc.getElementsByClassName("gallerybox")).forEach(box => gallery.push({
        description: box.getElementsByClassName("gallerytext")[0].textContent.trim(),
        url: galleryThumbnailUrlToActualUrl(BASE + box.getElementsByTagName("img")[0].src)
    }));
    return {
        skins: skins,
        gallery: gallery
    };
}

module.exports = {
    fetchGallery
}