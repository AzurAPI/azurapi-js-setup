import fs from "fs";
import path from "path";
import {JSDOM} from "jsdom";

import {camelize, clone, fetch, fetchImage, galleryThumbnailUrlToActualUrl, getHash} from "../utils";
import {Equipment, Fits, Misc, Stat, Tier} from "./equipment";

export const ROOT = path.join(__dirname, '..', '..');
export const EQUIPMENTS_PATH = path.join(ROOT, 'dist', 'equipments.json');
export const INTERNAL_EQUIPMENTS_PATH = path.join(ROOT, 'dist', 'equipments.internal.json');
export const VERSION_PATH = path.join(ROOT, 'dist', 'version.json');

const IMAGE_REPO_URL = 'https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/'

export let EQUIPMENTS: Equipment[] = [];
export let EQUIPMENTS_INTERNAL: { [s: string]: Equipment } = fs.existsSync(INTERNAL_EQUIPMENTS_PATH) ? JSON.parse(fs.readFileSync(INTERNAL_EQUIPMENTS_PATH).toString()) : {};
export let VERSION_INFO = JSON.parse(fs.readFileSync(VERSION_PATH).toString())

export async function refreshEQImages() {
    console.log("Equipments...");
    for (let key of Object.keys(EQUIPMENTS_INTERNAL)) {
        let eq = EQUIPMENTS_INTERNAL[key];
        let cleanName = key.replace(/[\s\/]+/g, "_");
        if (eq.image) await fetchImage(eq.image, path.resolve(ROOT, "images/equipments/" + cleanName + ".png"));
        else console.log("Missing image " + key);
        if (eq.misc && eq.misc.animation) await fetchImage(eq.misc.animation, path.resolve(ROOT, "images/equipments.animation/" + cleanName + ".gif"));
    }
    console.log("\nDone");
}

export async function refreshEquipments() {
    process.stdout.write("Refreshing Equipments");
    let data = await fetch('https://azurlane.koumakan.jp/Equipment_List', path.resolve(ROOT, 'web/equipments/index.html'));
    process.stdout.write("EQ Menu Loaded\n");
    for (let equipment_type of new JSDOM(data).window.document.querySelectorAll("ul:nth-child(7) li")) { // Equipments types layer
        let category = equipment_type.textContent;
        console.log("Refreshing Equipments type= " + category + "...");
        if (!fs.existsSync(path.resolve(ROOT, 'web/equipments/' + category))) fs.mkdirSync(path.resolve(ROOT, 'web/equipments/' + category));
        let doc = new JSDOM(await fetch("https://azurlane.koumakan.jp" + equipment_type.firstElementChild.getAttribute("href"), path.resolve(ROOT, 'web/equipments/' + category + '.html'))).window.document;
        console.log("List Done");

        let rows = doc.querySelectorAll("div[title = 'Max Rarity'] > table > tbody tr");
        if (category === "Anti-Submarine Equipment") rows = doc.querySelectorAll("div[title = 'Max Stats'] > table > tbody tr"); // TODO Remove this diry fix
        for (let equipment_row of rows) { // Equipments layer, using the max rarity tab to prevent dupes
            if (!equipment_row.firstElementChild || !equipment_row.firstElementChild.firstElementChild) continue; // some how jsdom's query selector is flaud, so dirty fix here, ignore it
            let href = `https://azurlane.koumakan.jp${equipment_row.firstElementChild.firstElementChild.getAttribute("href")}`;
            let name = equipment_row.firstElementChild.firstElementChild.getAttribute("title");
            process.stdout.write("Fetching \"" + name + "\" calling => ");
            EQUIPMENTS_INTERNAL[name] = parseEquipment(name, href, category, await fetch(href, path.resolve(ROOT, 'web/equipments/' + category + '/' + name.replace(/\//g, "_") + '.html')));
            fs.writeFileSync(INTERNAL_EQUIPMENTS_PATH, JSON.stringify(EQUIPMENTS_INTERNAL, null, '\t'));
            console.log(" Done");
        }
        console.log(category + " Done");
    }
}

function parseEquipment(id: string, href: string, category: string, body: string): Equipment {
    const doc = new JSDOM(body).window.document;
    let tabs = doc.getElementsByClassName("eq-box");
    process.stdout.write("tab count = " + tabs.length + " .");
    if (!doc || !tabs[0]) return {
        fits: undefined,
        id: id,
        image: undefined,
        misc: undefined,
        names: {cn: id, en: id, jp: id, kr: id},
        nationality: "",
        tiers: [],
        type: {focus: "", name: ""},
        wikiUrl: href,
        category: category
    };
    let eq: Equipment = {
        fits: undefined,
        image: "",
        misc: undefined,
        nationality: "",
        tiers: [],
        type: {focus: "", name: ""},
        id: id,
        wikiUrl: href,
        category: category,
        names: {
            en: doc.querySelector('[lang="en"]') ? doc.querySelector('[lang="en"]').childNodes[1].textContent.trim() : tabs[0].querySelector(".eq-title").childNodes[0].textContent.trim(),
            cn: doc.querySelector('[lang="zh"]') ? doc.querySelector('[lang="zh"]').childNodes[1].textContent.trim() : null,
            jp: doc.querySelector('[lang="ja"]') ? doc.querySelector('[lang="ja"]').childNodes[1].textContent.trim() : null,
            kr: doc.querySelector('[lang="ko"]') ? doc.querySelector('[lang="ko"]').childNodes[1].textContent.trim() : null
        }
    };
    let tiers: Tier[] = [];
    for (let tab of tabs) {
        let t = parseEquipmentInfo(tab);
        process.stdout.write("tier = " + t[0].tier + " .");
        eq.type = t[1].type;
        eq.nationality = t[1].nationality;
        if (t[1].image) eq.image = t[1].image;
        else console.log(eq.names.en);
        eq.fits = t[1].fits;
        eq.misc = t[1].misc;
        tiers[t[0].tier] = t[0];
    }
    process.stdout.write("");
    eq.tiers = tiers;
    return eq;
}

function parseEquipmentInfo(eqbox: Element): [Tier, any] {
    let primaryRows = eqbox.querySelectorAll(".eq-info:nth-child(2) td");
    let stars = primaryRows[1].firstElementChild.lastElementChild.innerHTML.split("<br>")[1];
    let image = galleryThumbnailUrlToActualUrl(eqbox.getElementsByTagName("img")[0].src);
    if (!image || image === "null") image = eqbox.getElementsByTagName("img")[0].src;
    return [{
        tier: parseInt(eqbox.getElementsByClassName("eqtech")[0].textContent.replace(/[^\d]/g, '')),
        rarity: primaryRows[1].firstElementChild.firstElementChild.getAttribute("title"),
        stars: {
            stars: stars,
            value: stars.split("★").length - 1
        },
        stats: parseEquipmentStats(eqbox.getElementsByClassName("eq-stats")[0]),
    }, {
        type: {
            focus: primaryRows[0].firstElementChild.getAttribute("title"),
            name: primaryRows[0].textContent.trim()
        },
        nationality: primaryRows[2].firstElementChild.getAttribute("title"),
        image: image,
        fits: parseEquipmentFit(eqbox.getElementsByClassName("eq-fits")[0]),
        misc: parseEquipmentMisc(eqbox.getElementsByClassName("eq-misc")[0])
    }];
}

function parseEquipmentStats(eqstats: Element): {
    [key: string]: Stat
} {
    let stats: {
        [key: string]: Stat
    } = {};
    let rows = eqstats.getElementsByTagName("tr");
    for (let i = 1; i < rows.length; i++) {
        stats[camelize((rows[i].firstElementChild.firstElementChild.getAttribute("title") ? rows[i].firstElementChild.firstElementChild.getAttribute("title") : rows[i].firstElementChild.textContent.trim()).replace(/[^\w ]/g, ''))] = parseEquipmentStatsSlot(rows[i].lastElementChild);
    }
    return stats;
}

function parseEquipmentStatsSlot(valueNode: Element): Stat {
    if (valueNode.childNodes.length === 6) {
        let data: Stat = {
            type: "range",
            firing: parseInt(valueNode.childNodes[2].textContent.trim()),
            shell: parseInt(valueNode.childNodes[5].textContent.trim()),
            formatted: ""
        };
        if (data.type === "range") data.formatted = "Firing: " + data.firing + "\n" + "Shell: " + data.shell;
        return data;
    } else if (valueNode.children.length > 0) {
        let statValue: Stat[] = [];
        for (let i = 0; i < valueNode.children.length; i++)
            if (valueNode.children[i].textContent.trim()) statValue[i] = parseEquipmentStatsSlot(valueNode.children[i]);
        return {type: "more_stats", stats: statValue};
    } else {
        let value = valueNode.textContent.trim();
        let rawData;
        if (value !== (rawData = value.replace(/(.+) → (.+) per (.+)/g, "$1|$2|$3"))) { //X → X' per P
            rawData = rawData.split(/\|/);
            return {
                type: "min_max_per",
                min: rawData[0].trim(),
                max: rawData[1].trim(),
                per: rawData[2].trim(),
                formatted: value
            };
        } else if (value !== (rawData = value.replace(/([^×]+) × ([^×]+) → ([^×]+) × ([^×]+)/g, "$1|$2|$3|$4"))) { //X × C → X' × C
            rawData = rawData.split(/\|/);
            if (rawData[1].trim() === rawData[3].trim()) return {
                type: "min_max_multiplier",
                min: rawData[0].trim(),
                max: rawData[2].trim(),
                multiplier: rawData[1].trim(),
                formatted: value
            }; else return {
                type: "min_max_min_max_multiplier",
                min: rawData[0].trim(),
                max: rawData[2].trim(),
                minMultiplier: rawData[1].trim(),
                maxMultiplier: rawData[3].trim(),
                formatted: value
            };
        } else if (value !== (rawData = value.replace(/([^×]+) × ([0-9]+)([^×→]+)/g, "$1|$2|$3"))) { // X × C U
            rawData = rawData.split(/\|/);
            return {
                type: "multiplier_count_unit",
                multiplier: rawData[0].trim(),
                count: rawData[1].trim(),
                unit: rawData[2].trim(),
                formatted: value
            };
        } else if (value !== (rawData = value.replace(/([0-9]+) [×x] ([^×→\n]+)/g, "$1|$2"))) { // X × U
            rawData = rawData.split(/\|/);
            return {
                type: "count_unit",
                count: rawData[0].trim(),
                unit: rawData[1].trim(),
                formatted: value
            };
        } else if (value !== (rawData = value.replace(/([^→]+)→([^→\n]+)→([^→\n]+)/g, "$1|$2|$3"))) { // X → X'
            rawData = rawData.split(/\|/);
            return {
                type: "min_mid_max",
                min: rawData[0].trim(),
                mid: rawData[1].trim(),
                max: rawData[2].trim(),
                formatted: value
            };
        } else if (value !== (rawData = value.replace(/([^→]+)→([^→\n]+)/g, "$1|$2"))) { // X → X'
            rawData = rawData.split(/\|/);
            return {
                type: "min_max",
                min: rawData[0].trim(),
                max: rawData[1].trim(),
                formatted: value
            };
        } else if (value !== (rawData = value.replace(/([0-9.]+)([^0-9.]+)/g, "$1|$2"))) { // X U
            rawData = rawData.split(/\|/);
            return {
                type: "value_unit",
                value: rawData[0].trim(),
                unit: rawData[1].trim(),
                formatted: value
            };
        } else return { // ¯\_(ツ)_/¯
            type: "value",
            formatted: value
        }
    }
}

function parseEquipmentFit(eqfits: Element): Fits {
    let fits: Fits = {};
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

function parseEquipmentMisc(eqmisc: Element): any {
    let rows = eqmisc.getElementsByTagName("tr");
    let misc: Misc = {blueprints: "", madeFrom: [], notes: "", usedFor: [], animation: "", obtainedFrom: ""};
    for (let i = 1; i < rows.length; i++) {
        let row = rows[i];
        if (row.classList.contains('mw-empty-elt')) continue;
        // console.log(i, row.innerHTML, Array.from(rows));
        let key = camelize(row.querySelector("th").textContent);
        let col = row.querySelector("td");
        if (key === "obtainedFrom" || key === "notes") misc[key] = col.textContent;
        else if (key === "patternAnimation") misc.animation = col.firstElementChild.firstElementChild.getAttribute("src");
        else if (key === "usedInGearLabFor") misc.usedFor = Array.from(col.children).map(elem => (<HTMLElement>(elem.querySelector('a') || elem)).title.replace(/\s+\(page does not exist\)/, ''));
        else if (key === "createdInGearLabFrom") misc.madeFrom = Array.from(col.children).map(elem => (<HTMLElement>(elem.querySelector('a') || elem)).title.replace(/\s+\(page does not exist\)/, ''));
        else if (key === "blueprintsUsedInE-Research") misc.blueprints = col.textContent.trim();
        else console.log("\n\nKey not handled", key, '\n\n');
    }
    return misc;
}

export function publishEQ() {
    EQUIPMENTS = [];
    for (let key of Object.keys(EQUIPMENTS_INTERNAL)) {
        if (!EQUIPMENTS_INTERNAL[key].names) continue;
        let eq = clone(EQUIPMENTS_INTERNAL[key]);
        let cleanName = key.replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, '');
        eq.image = IMAGE_REPO_URL + "images/equipments/" + cleanName + ".png";
        eq.misc.animation = IMAGE_REPO_URL + "images/equipments.animation/" + cleanName + ".gif";
        EQUIPMENTS.push(eq);
        process.stdout.write('.');
    }
    let equipments_value = JSON.stringify(EQUIPMENTS);
    fs.writeFileSync(EQUIPMENTS_PATH, equipments_value);
    VERSION_INFO.equipments.hash = getHash(equipments_value);
    VERSION_INFO.equipments["version-number"] += 1;
    VERSION_INFO.equipments["last-data-refresh-date"] = Date.now();
    fs.writeFileSync(VERSION_PATH, JSON.stringify(VERSION_INFO));
}