exports.parseMemory = parseMemory;

function parseMemory(doc, name, icon, url) {
    return fuse({
        names: parseNames(doc.querySelector("div[title='Chinese Story']"), doc.querySelector("div[title='Japanese Story']"), doc.querySelector("div[title='English Story']")),
        thumbnail: icon,
        wikiUrl: url,
        cn: parseStory(doc.querySelector("div[title='Chinese Story']")),
        jp: parseStory(doc.querySelector("div[title='Japanese Story']")),
        en: parseStory(doc.querySelector("div[title='English Story']"))
    }, name);
}

function fuse(obj, name) {
    let {
        cn,
        jp,
        en
    } = obj;
    let chapters = [];
    for (let i = 0; i < Math.max(cn.length, jp.length, en.length); i++) { // Looping through chapters
        let length = Math.max(cn[i] ? cn[i].lines.length : 0, jp[i] ? jp[i].lines.length : 0, en[i] ? en[i].lines.length : 0);
        let names = {};
        let lines = [];
        if (cn[i]) names.cn = cn[i].name;
        if (jp[i]) names.jp = jp[i].name;
        if (en[i]) names.en = en[i].name;
        for (let j = 0; j < length; j++) {
            lines.push({
                names: {
                    cn: cn[i] && cn[i].lines[j] ? cn[i].lines[j].name : null,
                    jp: jp[i] && jp[i].lines[j] ? jp[i].lines[j].name : null,
                    en: en[i] && en[i].lines[j] ? en[i].lines[j].name : null,
                },
                bannerSrc: (cn[i] && cn[i].lines[j] ? cn[i].lines[j].bannerSrc : null) || (jp[i] && jp[i].lines[j] ? jp[i].lines[j].bannerSrc : null) || (en[i] && en[i].lines[j] ? en[i].lines[j].bannerSrc : null),
                bgm: (cn[i] && cn[i].lines[j] ? cn[i].lines[j].bgm : null) || (jp[i] && jp[i].lines[j] ? jp[i].lines[j].bgm : null) || (en[i] && en[i].lines[j] ? en[i].lines[j].bgm : null),
                background: (cn[i] && cn[i].lines[j] ? cn[i].lines[j].background : null) || (jp[i] && jp[i].lines[j] ? jp[i].lines[j].background : null) || (en[i] && en[i].lines[j] ? en[i].lines[j].background : null),
                content: {
                    cn: cn[i] && cn[i].lines[j] ? cn[i].lines[j].content : null,
                    jp: jp[i] && jp[i].lines[j] ? jp[i].lines[j].content : null,
                    en: en[i] && en[i].lines[j] ? en[i].lines[j].content : null,
                },
            })
        }
        chapters.push({
            names: names,
            lines: lines
        })
    }
    return {
        names: {
            cn: obj.names.cn,
            jp: obj.names.jp,
            en: obj.names.en || name,
        },
        thumbnail: obj.thumbnail,
        wikiUrl: obj.wikiUrl,
        chapters: chapters
    };
}

function parseStory(div) {
    let chapters = [];
    if (!div) return [];
    for (let i = 1; div.querySelector("div[title='Chapter " + i + "']"); i++) {
        chapters.push(parseChapter(div.querySelector("div[title='Chapter " + i + "']")));
    }
    return chapters;
}

function parseChapter(div) {
    let rows = div.querySelectorAll("table tbody tr");
    let chapterName = rows[0].firstElementChild.firstChild.textContent;
    let lines = [];
    for (let i = 2; i < rows.length; i++) {
        let row = rows[i];
        let line = {};
        line.bannerSrc = "https://azurlane.koumakan.jp" + (row.firstElementChild.firstElementChild && row.firstElementChild.firstElementChild.tagName === "IMG" ? galleryThumbnailUrlToActualUrl(row.firstElementChild.firstElementChild.src) : null);
        line.name = row.firstElementChild ? row.firstElementChild.textContent.trim() : null;
        if (row.children[1]) line.content = row.children[1].textContent;
        else console.log(row.textContent);
        if (row.lastElementChild && row.lastElementChild.childNodes.length > 0) { // Notes
            if (row.lastElementChild.querySelector("img")) line.background = "https://azurlane.koumakan.jp" + galleryThumbnailUrlToActualUrl(row.lastElementChild.querySelector("img").src);
            else line.bgm = row.lastElementChild.textContent;
            if (row.lastElementChild.childNodes.length > 1) line.bgm = row.lastElementChild.childNodes[1].textContent.replace('BGM:', '').trim();
        }
        lines.push(line);
    }
    return {
        name: chapterName,
        lines: lines
    };
}

function parseNames(cn, jp, en) {
    return {
        cn: cn && cn.querySelector(".mw-headline") ? cn.querySelector(".mw-headline").textContent : null,
        jp: jp && jp.querySelector(".mw-headline") ? jp.querySelector(".mw-headline").textContent : null,
        en: en && en.querySelector(".mw-headline") ? en.querySelector(".mw-headline").textContent : null
    };
}

// Its only a prediction
function galleryThumbnailUrlToActualUrl(tdir) {
    return tdir.replace(/\/w\/images\/thumb\/(.\/..)\/([^\/]+)\/.+/g, '/w/images/$1/$2');
}
