const fs = require('fs');
const path = require("path");
const JSDOM = require('jsdom').JSDOM;
const {fetch, fetchImage, galleryThumbnailUrlToActualUrl, camelize, clone, getHash} = require('../utils');
let EQUIPMENTS = require("../equipments.internal.json");
let EQUIPMENTS_PUBLIC = require("../equipments.json");
let VERSION_INFO = require("../version-info.json");

const IMAGE_REPO_URL = 'https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/'

async function refreshEQImages() {
    console.log("Equipments...");
    for (let key of Object.keys(EQUIPMENTS)) {
        let eq = EQUIPMENTS[key];
        let cleanName = key.replace(/[\s\/]+/g, "_");
        if (eq.image) await fetchImage(eq.image, path.resolve(__dirname, "../images/equipments/" + cleanName + ".png"));
        else console.log("Missing image " + key);
        if (eq.misc && eq.misc.animation) await fetchImage(eq.misc.animation, path.resolve(__dirname, "../images/equipments.animation/" + cleanName + ".gif"));
    }
    console.log("\nDone");
}

async function refreshEquipments(online) {
    process.stdout.write("Refreshing Equipments");
    let data = await fetch('https://azurlane.koumakan.jp/Equipment_List', path.resolve(__dirname, '../web/equipments/index.html'));
    process.stdout.write("EQ Menu Loaded\n");
    for (let equipment_type of new JSDOM(data).window.document.querySelectorAll("ul:nth-child(7) li")) { // Equipments types layer
        let category = equipment_type.textContent;
        console.log("Refreshing Equipments type= " + category + "...");
        if (!fs.existsSync(path.resolve(__dirname, '../web/equipments/' + category))) fs.mkdirSync(path.resolve(__dirname, '../web/equipments/' + category));
        let doc = new JSDOM(await fetch("https://azurlane.koumakan.jp" + equipment_type.firstElementChild.getAttribute("href"), path.resolve(__dirname, '../web/equipments/' + category + '.html'))).window.document;
        console.log("List Done");

        let rows = doc.querySelectorAll("div[title = 'Max Rarity'] > table > tbody tr");
        if (category === "Anti-Submarine Equipment") rows = doc.querySelectorAll("div[title = 'Max Stats'] > table > tbody tr"); // TODO Remove this diry fix
        for (let equipment_row of rows) { // Equipments layer, using the max rarity tab to prevent dupes
            if (!equipment_row.firstElementChild || !equipment_row.firstElementChild.firstElementChild) continue; // some how jsdom's query selector is flaud, so dirty fix here, ignore it
            let href = `https://azurlane.koumakan.jp${equipment_row.firstElementChild.firstElementChild.getAttribute("href")}`;
            let name = equipment_row.firstElementChild.firstElementChild.getAttribute("title");
            process.stdout.write("Fetching \"" + name + "\" calling => ");
            EQUIPMENTS[name] = parseEquipment(href, category, await fetch(href, path.resolve(__dirname, '../web/equipments/' + category + '/' + name.replace(/\//g, "_") + '.html')));
            fs.writeFileSync(path.resolve(__dirname, '../equipments.internal.json'), JSON.stringify(EQUIPMENTS, null, '\t'));
            console.log(" Done");
        }
        console.log(category + " Done");
    }
}

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
        if (t.image) eq.image = "https://azurlane.koumakan.jp" + t.image;
        else console.log(eq.names.en);
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
    let stars = primaryRows[1].firstElementChild.lastElementChild.innerHTML.split("<br>")[1];
    let image = galleryThumbnailUrlToActualUrl(eqbox.getElementsByTagName("img")[0].src);
    if (!image || image === "null") image = eqbox.getElementsByTagName("img")[0].src;
    return {
        tier: eqbox.getElementsByClassName("eqtech")[0].textContent,
        type: {
            focus: primaryRows[0].firstElementChild.getAttribute("title"),
            name: primaryRows[0].textContent.trim()
        },
        nationality: primaryRows[2].firstElementChild.getAttribute("title"),
        image: image,
        rarity: primaryRows[1].firstElementChild.firstElementChild.getAttribute("title"),
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
        stats[camelize((rows[i].firstElementChild.firstElementChild.getAttribute("title") ? rows[i].firstElementChild.firstElementChild.getAttribute("title") : rows[i].firstElementChild.textContent.trim()).replace(/[^\w ]/g, ''))] = parseEquipmentStatsSlot(rows[i].lastElementChild);
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
        } else if (value !== (rawData = value.replace(/([^→]+)→([^→\n]+)→([^→\n]+)/g, "$1|$2|$3"))) { // X → X'
            rawData = rawData.split(/\|/);
            data = {
                type: "min_mid_max",
                min: rawData[0].trim(),
                mid: rawData[1].trim(),
                max: rawData[2].trim()
            };
        } else if (value !== (rawData = value.replace(/([^→]+)→([^→\n]+)/g, "$1|$2"))) { // X → X'
            rawData = rawData.split(/\|/);
            data = {
                type: "min_max",
                min: rawData[0].trim(),
                max: rawData[1].trim()
            };
        } else if (value !== (rawData = value.replace(/([0-9.]+)([^0-9.]+)/g, "$1|$2"))) { // X U
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
    for (let row of eqfits.getElementsByTagName("tr")) { // GRR, it was an one liner, unlucky me had to debug it
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
    let rows = eqmisc.getElementsByTagName("tr");
    let misc = {};
    for (let i = 1; i < rows.length; i++) {
        let row = rows[i];
        if (row.classList.contains('mw-empty-elt')) continue;
        // console.log(i, row.innerHTML, Array.from(rows));
        let key = camelize(row.querySelector("th").textContent);
        let col = row.querySelector("td");
        if (key === "obtainedFrom" || key === "notes") misc[key] = col.textContent;
        else if (key === "patternAnimation") misc.animation = "https://azurlane.koumakan.jp" + col.firstElementChild.firstElementChild.getAttribute("src");
        else if (key === "usedInGearLabFor") misc.usedFor = Array.from(col.children).map(elem => (elem.querySelector('a') || elem).title.replace(/\s+\(page does not exist\)/, ''));
        else if (key === "createdInGearLabFrom") misc.madeFrom = Array.from(col.children).map(elem => (elem.querySelector('a') || elem).title.replace(/\s+\(page does not exist\)/, ''));
        else if (key === "blueprintsUsedInE-Research") misc.blueprints = col.textContent.trim();
        else console.log("\n\nKey not handled", key, '\n\n');
    }
    return misc;
}

function publishEQ() {
    EQUIPMENTS_PUBLIC = [];
    for (let key of Object.keys(EQUIPMENTS)) {
        if (!EQUIPMENTS[key].names) continue;
        let eq = clone(EQUIPMENTS[key]);
        let cleanName = key.replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, '');
        eq.image = IMAGE_REPO_URL + "images/equipments/" + cleanName + ".png";
        eq.misc.animation = IMAGE_REPO_URL + "images/equipments.animation/" + cleanName + ".gif";
        EQUIPMENTS_PUBLIC.push(eq);
        process.stdout.write('.');
    }
    let equipments_value = JSON.stringify(EQUIPMENTS_PUBLIC);
    fs.writeFileSync(path.resolve(__dirname, '../equipments.json'), equipments_value);
    VERSION_INFO.equipments.hash = getHash(equipments_value);
    VERSION_INFO.equipments["version-number"] += 1;
    VERSION_INFO.equipments["last-data-refresh-date"] = Date.now();
    fs.writeFileSync(path.resolve(__dirname, '../version-info.json'), JSON.stringify(VERSION_INFO));
}

module.exports = {
    refreshEQImages, refreshEquipments, publishEQ
}