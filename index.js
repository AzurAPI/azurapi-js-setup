// This file is for fetching data from wiki
const crypto = require('crypto');
const fs = require('fs');
const request = require('request');
const JSDOM = require('jsdom').JSDOM;

const chapter = require('./chapter.js');
const memory = require('./memory.js');

const IMAGE_REPO_URL = 'https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/'


let EQUIPMENTS = require("./equipments.internal.json");
let EQUIPMENTS_PUBLIC = require("./equipments.json");
let CHAPTERS = require("./chapters.json");
let MEMORIES = require("./memories.json");
let IMAGE_PROGRESS = require("./image-progress.json");

const HEADERS = {
    'user-agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'cookie': 'VEE=wikitext'
};

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function refreshEQImages() {
    if (IMAGE_PROGRESS.inProgress) {
        console.log("Program Last Stopped at \"" + IMAGE_PROGRESS.inProgress + "\"");
        if (fs.existsSync(IMAGE_PROGRESS.inProgress)) fs.unlinkSync(IMAGE_PROGRESS.inProgress);
        console.log("Done")
    }
    console.log("Equipments...");
    for (let key in EQUIPMENTS) {
        let eq = EQUIPMENTS[key];
        let cleanName = key.replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, '');
        IMAGE_PROGRESS.inProgress = cleanName;
        fs.writeFileSync('./image-progress.json', JSON.stringify(IMAGE_PROGRESS));
        await fetchImage(eq.image, "./images/equipments/" + cleanName + ".png");
        if (eq.misc && eq.misc.animation)
            await fetchImage(eq.misc.animation, "./images/equipments.animation/" + cleanName + ".gif");
    }
    IMAGE_PROGRESS.inProgress = null;
    fs.writeFileSync('./image-progress.json', JSON.stringify(IMAGE_PROGRESS));
    console.log("\nDone");
}

async function refreshEquipments(online) {
    let data;
    process.stdout.write("Refreshing Equipments");
    if (!fs.existsSync('./web/equipments/index.html') || online) fs.writeFileSync('./web/equipments/index.html', data = await fetch("https://azurlane.koumakan.jp/Equipment_List"));
    else data = fs.readFileSync('./web/equipments/index.html', 'utf8');
    process.stdout.write("EQ Menu Loaded\n");
    for (let equipment_type of new JSDOM(data).window.document.querySelectorAll("ul:nth-child(7) li")) { // Equipments types layer
        let category = equipment_type.textContent;
        console.log("Refreshing Equipments type= " + category + "...");
        if (!fs.existsSync('./web/equipments/' + category + '.html') || online) {
            process.stdout.write("Getting List...");
            data = await fetch("https://azurlane.koumakan.jp" + equipment_type.firstElementChild.getAttribute("href"))
            fs.writeFileSync('./web/equipments/' + category + '.html', data);
            process.stdout.write("Done\n");
        } else data = fs.readFileSync('./web/equipments/' + category + '.html', 'utf8');
        if (!fs.existsSync('./web/equipments/' + category)) fs.mkdirSync('./web/equipments/' + category);
        let doc = new JSDOM(data).window.document;
        console.log("List Done");
        let rows = doc.querySelectorAll("div[title = 'Max Rarity'] > table > tbody tr");
        if (category === "Anti-Submarine Equipment") rows = doc.querySelectorAll("div[title = 'Max Stats'] > table > tbody tr"); // TODO Remove this diry fix
        for (let equipment_row of rows) { // Equipments layer, using the max rarity tab to prevent dupes
            if (!equipment_row.firstElementChild || !equipment_row.firstElementChild.firstElementChild) continue; // some how jsdom's query selector is flaud, so dirty fix here, ignore it
            let href = "https://azurlane.koumakan.jp" + equipment_row.firstElementChild.firstElementChild.href;
            let name = equipment_row.firstElementChild.firstElementChild.title;
            process.stdout.write("Fetching \"" + name + "\" calling => ");
            EQUIPMENTS[name] = await refreshEquipment(href, name, category, online);
            fs.writeFileSync('./equipments.internal.json', JSON.stringify(EQUIPMENTS, null, '\t'));
            console.log(" Done");
        }
        console.log(category + " Done");
    }
}

async function refreshChapter(online) {
    let namesHTML;
    process.stdout.write("Refreshing Chapter Names");
    if (!fs.existsSync('./web/chapters/names.html') || online) fs.writeFileSync('./web/chapters/names.html', namesHTML = await fetch("https://azurlane.koumakan.jp/Campaign"));
    else namesHTML = fs.readFileSync('./web/chapters/names.html', 'utf8');
    let names = parseChaptersNames(namesHTML);
    process.stdout.write("  Done\n");
    console.log(JSON.stringify(names));
    for (let i = 1; i <= 13; i++) {
        let data;
        process.stdout.write("Refreshing Chapter " + i + " Details");
        if (!fs.existsSync('./web/chapters/' + i + '.html') || online) fs.writeFileSync('./web/chapters/' + i + '.html', data = await fetch("https://azurlane.koumakan.jp/Chapter_" + i));
        else data = fs.readFileSync('./web/chapters/' + i + '.html', 'utf8');
        CHAPTERS[i] = chapter.parseChapter(new JSDOM(data).window.document, i, names);
        fs.writeFileSync('./chapters.json', JSON.stringify(CHAPTERS, null, '\t'));
        console.log("\nDone");
    }
    fs.writeFileSync('./chapters.min.json', JSON.stringify(CHAPTERS));
}

async function refreshMemory(online) {
    let data;
    console.log("Recalling Memories");
    if (!fs.existsSync('./web/memories/index.html') || online) fs.writeFileSync('./web/memories/index.html', data = await fetch("https://azurlane.koumakan.jp/Memories"));
    else data = fs.readFileSync('./web/memories/index.html', 'utf8');
    for (let galleryPack of new JSDOM(data).window.document.querySelectorAll(".gallery.mw-gallery-packed")) {
        let category = camelize(galleryPack.previousElementSibling.textContent.trim());
        for (let galleryBox of galleryPack.children) {
            let icon = "https://azurlane.koumakan.jp" + galleryThumbnailUrlToActualUrl(galleryBox.querySelector('.thumb img').src);
            let name = galleryBox.querySelector(".gallerytext a").textContent;
            let simple_name = camelize(name.replace(/[^\w\s]/g, ''));
            let url = "https://azurlane.koumakan.jp" + galleryBox.querySelector(".gallerytext a").href;
            process.stdout.write(("Recalling \"" + name + "\"...").padEnd(80, ' '));
            if (!fs.existsSync('./web/memories/' + simple_name + '.html') || online) fs.writeFileSync('./web/memories/' + simple_name + '.html', data = await fetch(url));
            else data = fs.readFileSync('./web/memories/' + simple_name + '.html', 'utf8');
            process.stdout.write(" .");
            MEMORIES[simple_name] = memory.parseMemory(new JSDOM(data).window.document, name, icon, url);
            const used = process.memoryUsage().heapUsed / 1024 / 1024;
            process.stdout.write(` done. ${Math.round(used * 100) / 100}MB used\n`);
            fs.writeFileSync('./memories.internal.json', JSON.stringify(MEMORIES, null, '\t'));
            if (used > 1000) await timeout(1000);
        }
    }
    fs.writeFileSync('./memories.internal.json', JSON.stringify(MEMORIES, null, '\t'));
    console.log("\nDone");
}



function publishEQ() {
    EQUIPMENTS_PUBLIC = {};
    for (let key in EQUIPMENTS) {
        if (!EQUIPMENTS[key].names) continue;
        EQUIPMENTS_PUBLIC[key] = clone(EQUIPMENTS[key]);
        let cleanName = key.replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, '');
        EQUIPMENTS_PUBLIC[key].image = IMAGE_REPO_URL + "images/equipments/" + cleanName + ".png";
        EQUIPMENTS_PUBLIC[key].misc.animation = IMAGE_REPO_URL + "images/equipments.animation/" + cleanName + ".gif";
        process.stdout.write('.');
    }
    let equipments_value = JSON.stringify(EQUIPMENTS_PUBLIC);
    fs.writeFileSync('./equipments.json', equipments_value);
    VERSION_INFO.equipments.hash = getHash(equipments_value);
    VERSION_INFO.equipments["version-number"] += 1;
    VERSION_INFO.equipments["last-data-refresh-date"] = Date.now();
    fs.writeFileSync('./version-info.json', JSON.stringify(VERSION_INFO));
}

async function publishMemoriesAndImages() {
    for (let key of Object.keys(MEMORIES)) {
        let memory = MEMORIES[key];
        let thumbnailFile = "./images/memoryThumbnails/" + memory.thumbnail.substring(memory.thumbnail.lastIndexOf('/') + 1);
        await fetchImage(memory.thumbnail, thumbnailFile);
    }
}

async function refreshEquipment(href, name, category, online) {
    if (!EQUIPMENTS.hasOwnProperty(name) || online) {
        process.stdout.write("not-done ");
        return await fetchEquipment(href, name, category, online);
    } else {
        process.stdout.write("pre-done ");
        return EQUIPMENTS[name];
    }
}

// Get the updated list of ships



async function fetchEquipment(href, name, category, online) {
    if (online) { // Fetch from the wiki directly
        process.stdout.write("online, loading..");
        const body = await fetch(href);
        process.stdout.write(".| ");
        fs.writeFileSync('./web/equipments/' + category + '/' + name.replace(/\//g, "_") + '.html', body);
        return parseEquipment(href, category, body);
    } else {
        if (!fs.existsSync('./web/equipments/' + category + '/' + name.replace(/\//g, "_") + '.html')) return fetchEquipment(href, name, category, true); // Enforcing
        process.stdout.write("local ");
        // Read from local cache
        return parseEquipment(href, category, fs.readFileSync('./web/equipments/' + category + '/' + name.replace(/\//g, "_") + '.html', 'utf8'));
    }
}

// Parse ship page html body, need a name


function parseEquipment(href, category, body) {
    const doc = new JSDOM(body).window.document;
    let tabs = doc.getElementsByClassName("eq-box");
    process.stdout.write("tab count = " + tabs.length + " .");
    if (!doc || !tabs[0]) return {
        wikiUrl: href,
        category: category
    };
    let eq = {
        wikiUrl: href,
        category: category,
        names: {
            en: doc.querySelector('[lang="en"]') ? doc.querySelector('[lang="en"]').childNodes[1].textContent.trim() : tabs[0].querySelector(".eq-title").childNodes[0].textContent.trim(),
            cn: doc.querySelector('[lang="zh"]') ? doc.querySelector('[lang="zh"]').childNodes[1].textContent.trim() : null,
            jp: doc.querySelector('[lang="ja"]') ? doc.querySelector('[lang="ja"]').childNodes[1].textContent.trim() : null,
            kr: doc.querySelector('[lang="ko"]') ? doc.querySelector('[lang="ko"]').childNodes[1].textContent.trim() : null
        }
    };
    let tiers = {};
    for (let tab of tabs) {
        let t = parseEquipmentInfo(tab);
        process.stdout.write("tier = " + t.tier + " .");
        eq.type = t.type;
        eq.nationality = t.nationality;
        eq.image = "https://azurlane.koumakan.jp" + t.image;
        eq.fits = t.fits;
        eq.misc = t.misc;
        delete t.type;
        delete t.nationality;
        delete t.image;
        delete t.fits;
        delete t.misc;
        tiers[t.tier] = t;
    }
    process.stdout.write("");
    eq.tiers = tiers;
    return eq;
}

function parseEquipmentInfo(eqbox) {
    let primaryRows = eqbox.querySelectorAll(".eq-info:nth-child(2) td");
    let stars = primaryRows[1].firstElementChild.lastChild.innerHTML.split("<br>")[1];
    let image = galleryThumbnailUrlToActualUrl(eqbox.getElementsByTagName("img")[0].src);
    if (!image || image == null || image === "null") image = eqbox.getElementsByTagName("img")[0].src;
    return {
        tier: eqbox.getElementsByClassName("eqtech")[0].textContent,
        type: {
            focus: primaryRows[0].firstElementChild.title,
            name: primaryRows[0].textContent.trim()
        },
        nationality: primaryRows[2].firstElementChild.title,
        image: image,
        rarity: primaryRows[1].firstElementChild.firstElementChild.title,
        stars: {
            stars: stars,
            value: stars.split("★").length - 1
        },
        stats: parseEquipmentStats(eqbox.getElementsByClassName("eq-stats")[0]),
        fits: parseEquipmentFit(eqbox.getElementsByClassName("eq-fits")[0]),
        misc: parseEquipmentMisc(eqbox.getElementsByClassName("eq-misc")[0])
    };
}

function parseEquipmentStats(eqstats) {
    let stats = {};
    let rows = eqstats.getElementsByTagName("tr");
    for (let i = 1; i < rows.length; i++) {
        stats[camelize((rows[i].firstElementChild.firstElementChild.title ? rows[i].firstElementChild.firstElementChild.title : rows[i].firstElementChild.textContent.trim()).replace(/[^\w ]/g, ''))] = parseEquipmentStatsSlot(rows[i].lastElementChild);
    }
    return stats;
}

function parseEquipmentStatsSlot(valueNode) {
    if (valueNode.childNodes.length === 6) {
        let data = {
            type: "range",
            firing: parseInt(valueNode.childNodes[2].textContent.trim()),
            shell: parseInt(valueNode.childNodes[5].textContent.trim())
        };
        data.formatted = "Firing: " + data.firing + "\n" + "Shell: " + data.shell;
        return data;
    } else if (valueNode.children.length > 0) {
        let statValue = [];
        for (let i = 0; i < valueNode.children.length; i++)
            if (valueNode.children[i].textContent.trim()) statValue[i] = parseEquipmentStatsSlot(valueNode.children[i]);
        return statValue;
    } else {
        let value = valueNode.textContent.trim();
        let data;
        let rawData;
        if (value !== (rawData = value.replace(/(.+) → (.+) per (.+)/g, "$1|$2|$3"))) { //X → X' per P
            rawData = rawData.split(/\|/);
            data = {
                type: "min_max_per",
                min: rawData[0].trim(),
                max: rawData[1].trim(),
                per: rawData[2].trim()
            };
        } else if (value !== (rawData = value.replace(/([^×]+) × ([^×]+) → ([^×]+) × ([^×]+)/g, "$1|$2|$3|$4"))) { //X × C → X' × C
            rawData = rawData.split(/\|/);
            data = {
                type: "min_max_multiplier",
                min: rawData[0].trim(),
                max: rawData[2].trim()
            };
            if (rawData[1].trim() === rawData[3].trim()) data.multiplier = rawData[1].trim(); // Why? coz I do not trust the source
            else {
                data.type = "min_max_min_max_multiplier";
                data.minMultiplier = rawData[1].trim();
                data.maxMultiplier = rawData[3].trim();
            }
        } else if (value !== (rawData = value.replace(/([^×]+) × ([0-9]+)([^×→]+)/g, "$1|$2|$3"))) { // X × C U
            rawData = rawData.split(/\|/);
            data = {
                type: "multiplier_count_unit",
                multiplier: rawData[0].trim(),
                count: rawData[1].trim(),
                unit: rawData[2].trim()
            };
        } else if (value !== (rawData = value.replace(/([0-9]+) [×x] ([^×→\n]+)/g, "$1|$2"))) { // X × U
            rawData = rawData.split(/\|/);
            data = {
                type: "count_unit",
                count: rawData[0].trim(),
                unit: rawData[1].trim()
            };
        } else if (value !== (rawData = value.replace(/([^→]+)→([^→\n]+)/g, "$1|$2"))) { // X → X'
            rawData = rawData.split(/\|/);
            data = {
                type: "min_max",
                min: rawData[0].trim(),
                max: rawData[1].trim()
            };
        } else if (value !== (rawData = value.replace(/([0-9\.]+)([^0-9\.]+)/g, "$1|$2"))) { // X U
            rawData = rawData.split(/\|/);
            data = {
                type: "value_unit",
                value: rawData[0].trim(),
                unit: rawData[1].trim()
            };
        } else data = { // ¯\_(ツ)_/¯
            type: "value",
            value: value
        }
        data.formatted = value;
        return data;
    }
}

function parseEquipmentFit(eqfits) {
    let fits = {};
    for (row of eqfits.getElementsByTagName("tr")) { // GRR, it was an one liner, unlucky me had to debug it
        let name = camelize(row.children[0].textContent.trim());
        if (row.children[1].textContent.trim() === "✘") fits[name] = null;
        else if (row.children[1].textContent.trim() === "✔") fits[name] = "primary";
        else fits[name] = row.children[1].getElementsByClassName("tooltiptext")[0] ? row.children[1].getElementsByClassName("tooltiptext")[0].textContent.trim() : "unspecified";
        if (fits[name] !== null && /^(.+) Only$/.test(fits[name])) fits[name] = fits[name].replace(/^(.+) Only$/, '\"$1\" only'); // XXX Only,
        if (fits[name] === "Secondary gun") fits[name] = "secondary";
    }
    return fits;
}

function parseEquipmentMisc(eqmisc) {
    let datas = eqmisc.getElementsByTagName("td");
    return {
        obtainedFrom: datas[0].textContent,
        notes: datas[1].textContent,
        animation: datas.length > 2 ? ("https://azurlane.koumakan.jp" + datas[2].firstElementChild.firstElementChild.src) : null
    };
}

function parseChaptersNames(body) {
    let names = {};
    const doc = new JSDOM(body).window.document;
    let rows = doc.querySelector(".wikitable tbody").children;
    for (let i = 0; i < 13; i++) {
        names[i + 1] = {
            en: rows[i * 5 + 1].children[1].textContent.trim(),
            cn: rows[i * 5 + 1].children[2].textContent.trim(),
            jp: rows[i * 5 + 1].children[3].textContent.trim()
        };
        for (let j = 1; j <= 4; j++) names[rows[i * 5 + j + 1].children[0].textContent.trim()] = {
            en: rows[i * 5 + j + 1].children[1].textContent.trim(),
            cn: rows[i * 5 + j + 1].children[2].textContent.trim(),
            jp: rows[i * 5 + j + 1].children[3].textContent.trim()
        };
    }
    return names;
}

// Promise Wrapper for request, I dont trust their own promise support


