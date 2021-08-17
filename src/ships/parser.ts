import {
    Bonus,
    DevLevel,
    FleetTech,
    isStat,
    Rarity,
    RetrofitProject,
    Ship,
    ShipExists,
    ShipNames,
    ShipStats,
    Slot,
    Stat,
    Stats
} from "./ship";

import fs from "fs";
import path from "path";
import {JSDOM} from "jsdom";
import {BASE, camelize, clone, deepToString, galleryThumbnailUrlToActualUrl, textOr} from "../utils";
import {SHIP_LIST} from "./index";

const Kuroshiro = require("kuroshiro");
const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");
const reference: { [s: string]: any } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'azurapi-data', 'dist', 'ships.json')).toString());
const types: { [s: string]: any } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'azurapi-data', 'dist', 'types.json')).toString());
let ID_PATH = path.join(__dirname, '..', '..', 'dist', 'id-map.json');
const id_map: { [s: string]: any } = JSON.parse(fs.readFileSync(ID_PATH).toString());

const NATIONALITY: { [s: string]: string } = {
    0: "Universal", 1: "Eagle Union", 2: "Royal Navy",
    3: "Sakura Empire", 4: "Iron Blood", 5: "Dragon Empery",
    6: "Sardegna Empire", 7: "Northern Parliament", 8: "Iris Libre",
    9: "Vichya Dominion", 97: "META",
    98: "Universal", 101: "Neptunia", 102: "Bilibili",
    103: "Utawarerumono", 104: "Kizuna AI", 105: "Hololive", 106: "Venus Vacation"
};
const kuroshiro = new Kuroshiro();
const UNRELEASED = ['Tone', 'Chikuma', 'Pola', 'Vittorio Veneto', 'Kirov', 'Sovetsky Soyuz'];

function findShip(id: string, name: string, nationality: string) {
    name = name
        .replace(/ ?\(Battleship\)/, '(BB)')
        .replace('\u00b5', '\u03bc')
        .replace('Pamiat Merkuria', 'Pamiat\' Merkuria')
        .replace('Ookami', 'Ōkami')
        .replace('Kasumi (DOA)', 'Kasumi')
        .trim();
    if (id_map[id]) return reference[id_map[id]];
    for (let ship of Object.values(reference)) {
        if (!ship.name) continue;
        if ((ship.name.en === name || ship.name.cn === name || ship.name.code === name) && NATIONALITY[ship.nationality] === nationality) {
            id_map[id] = ship.id;
            fs.writeFileSync(ID_PATH, JSON.stringify(id_map));
            return ship;
        }
    }
    for (let ship of Object.values(reference)) {
        if (!ship.name) continue;
        if ((ship.name.en === name || ship.name.cn === name || ship.name.code === name)) {
            id_map[id] = ship.id;
            fs.writeFileSync(ID_PATH, JSON.stringify(id_map));
            return ship;
        }
    } // repeat but ignores nationality
    console.log(name);
    if (UNRELEASED.includes(name)) {
        return {
            name: {en: name, code: name},
            type: SHIP_LIST[id].type,
            nationality: SHIP_LIST[id].nationality,
            unreleased: true
        }
    }
    console.log("Mission FAILED | Ship = " + name);
}

const toTitleCase = (str: string) => str.replace(/\w\S*/g, txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());

async function fillNames(names: ShipNames): Promise<[ShipNames, ShipExists]> {
    let fillValue = names.en || names.jp || names.cn || names.code;
    let exists: ShipExists = {en: !!names.en, cn: !!names.cn, jp: !!names.jp, kr: !!names.kr};
    names = clone(names);
    if (!names.jp) names.jp = fillValue;
    if (!names.cn) names.cn = fillValue;
    if (!names.kr) names.kr = fillValue;
    if (!names.code) names.code = fillValue;
    if (!names.en) {
        names.en = toTitleCase(await kuroshiro.convert(names.jp, {to: 'romaji'}));
        console.log(names.jp, ">", names.en);
    }
    return [names, exists];
}


export async function parseShip(id: string, name: string, body: string): Promise<Ship> {
    const doc = new JSDOM(body).window.document;
    let nationality = doc.querySelector("div:nth-child(4) > .wikitable tr:nth-child(2) a:nth-child(2)").textContent;
    let referenceShip = findShip(id, name, nationality);
    let ship = new Ship();
    ship.wikiUrl = `${BASE}/${name.replace(/ +/g, "_")}`;
    ship.id = id;
    let fillers = await fillNames(referenceShip.name);
    ship._gid = referenceShip.id;
    if (referenceShip.data) ship._sid = Object.values(referenceShip.data).map((d: { id: number; }) => d.id);
    ship._code = referenceShip.code;
    ship.names = fillers[0];
    ship.exists = fillers[1];
    ship.hexagon = referenceShip.property_hexagon;
    ship.class = textOr(doc.querySelector("div:nth-child(3) > .wikitable tr:nth-child(3) > td:nth-child(2) > a"), null);
    ship.nationality = referenceShip.unreleased ? referenceShip.nationality : NATIONALITY[referenceShip.nationality];
    referenceShip.type = doc.querySelector(".nomobile>div>div:last-child>.wikitable tr:nth-child(3) td:last-child a:last-child")?.textContent === "Munition Ship" ? 19 : referenceShip.type;
    ship.hullType = referenceShip.unreleased ? referenceShip.type : types[referenceShip.type].en;
    if (!ship.class) ship.class = ship.names.en;
    if (doc.querySelectorAll("#mw-content-text .mw-parser-output > div").length < 2) {
        let images = doc.getElementsByTagName("img");
        ship.unreleased = true;
        ship.thumbnail = BASE + images[1].getAttribute("src");
        ship.skins = [{
            name: name,
            image: BASE + images[0].src,
            background: "https://azurlane.koumakan.jp/w/images/3/3a/MainDayBG.png",
            chibi: doc.querySelector("td > div > div:nth-child(2) img") ? BASE + doc.querySelector("td > div > div:nth-child(2) img").getAttribute("src") : null,
            info: {obtainedFrom: "Default", live2dModel: false}
        }];
        ship.rarity = "Unreleased";
        return ship;
    }
    ship.thumbnail = BASE + doc.querySelector(".nomobile>div>div>a>img").getAttribute("src");
    ship.rarity = doc.querySelector("div:nth-child(3) > .wikitable td img").parentElement.title as Rarity;
    let stars = doc.querySelector("div:nth-child(1) > div:nth-child(3) > .wikitable:nth-child(1) tr:nth-child(2) > td").textContent.trim().replace(/[^★☆]/g, '');
    ship.stars = {
        stars: stars,
        value: stars.split("★").length - 1
    };
    ship.stats = parseStats(doc);
    ship.slots = [null, null, null];
    for (let i = 0; i < 3; i++) ship.slots[i] = parseShipEQSlot(doc.querySelector(`div:nth-child(2) > .wikitable:nth-child(3) tr:nth-child(${i + 3})`));
    let enhanceValues = doc.querySelector(".wikitable:nth-child(5) td:nth-child(1)").childNodes;
    if (enhanceValues.length < 7) ship.enhanceValue = null;
    else ship.enhanceValue = {
        firepower: parseInt(enhanceValues[0].textContent.trim()),
        torpedo: parseInt(enhanceValues[2].textContent.trim()),
        aviation: parseInt(enhanceValues[4].textContent.trim()),
        reload: parseInt(enhanceValues[6].textContent.trim())
    };
    let scrapValues = doc.querySelector(".wikitable:nth-child(5) td:nth-child(2)").childNodes;
    if (scrapValues.length < 5) ship.scrapValue = null;
    else ship.scrapValue = {
        coin: parseInt(scrapValues[0].textContent.trim()),
        oil: parseInt(scrapValues[2].textContent.trim()),
        medal: parseInt(scrapValues[4].textContent.trim())
    };
    ship.skills = parseSkills(doc.getElementById("Skills"));
    if (ship.rarity === "Priority" || ship.rarity === "Decisive") ship.devLevels = parseDevelopmentLevels(doc.querySelector("#Development_levels tbody"));
    else ship.limitBreaks = parseShipLimits(doc.querySelector("#Limit_breaks tbody"));
    ship.fleetTech = parseFleetTech(doc.getElementById("Fleet_technology"));
    if (doc.getElementById("Retrofit")) { // This ship can be retrofited
        ship.retrofit = true;
        ship.retrofitId = (3000 + parseInt(ship.id)) + "";
        ship.retrofitProjects = parseRetrofit(doc.getElementById("Retrofit").parentElement.nextElementSibling.nextElementSibling.lastElementChild);
        ship.retrofitHullType = doc.querySelector(".nomobile>div:nth-child(1) .wikitable tr:nth-child(3) a:nth-child(4)") ? doc.querySelector(".nomobile>div:nth-child(1) .wikitable tr:nth-child(3) a:nth-child(4)").textContent : ship.hullType;
    }
    let obtainedFrom = parseShipObtainedFrom(doc.querySelector("#Construction tbody"), ship);
    ship.construction = obtainedFrom.construction;
    ship.obtainedFrom = obtainedFrom.obtainedFrom;
    const misc_selectors = [2, 3, 4, 5, 6].map(i => doc.querySelector(`div:nth-child(2) > .wikitable:nth-child(1) tr:nth-child(${i}) > td:nth-child(2) a:not([title='Play'])`));
    ship.misc = {
        artist: misc_selectors[0] ? {
            name: misc_selectors[0].textContent.trim(),
            url: BASE + misc_selectors[0].getAttribute("href")
        } : null,
        pixiv: misc_selectors[1] ? {
            name: misc_selectors[1].textContent.trim(),
            url: misc_selectors[1].getAttribute("href")
        } : null,
        twitter: misc_selectors[2] ? {
            name: misc_selectors[2].textContent.trim(),
            url: misc_selectors[2].getAttribute("href")
        } : null,
        web: misc_selectors[3] ? {
            name: misc_selectors[3].textContent.trim(),
            url: misc_selectors[3].getAttribute("href")
        } : null,
        voice: misc_selectors[4] ? {
            name: misc_selectors[4].textContent.trim(),
            url: misc_selectors[4].getAttribute("href")
        } : null
    };
    return ship;
}

function parseShipLimits(skill_table: Element) {
    if (skill_table.childElementCount === 2 && skill_table.children[1].children[0].children[0].tagName === "I") return null;
    let rows = skill_table.getElementsByTagName("tr");
    let limits = [];
    for (let i = 1; i < 4; i++) limits.push(parseLimitBreak(rows[i]));
    return limits;
}

function parseLimitBreak(row: Element) {
    let buffs = [];
    let rows = row.children[1].children;
    for (let i = 0; i < rows.length; i++) buffs.push(rows[i].textContent.trim())
    return buffs;
}

function parseSkills(table: Element) {
    let rows = table.getElementsByTagName("tr");
    let skills = [];
    let skill;
    for (let i = 1; ; i += 4) {
        skill = parseSkill(rows[i], rows[i + 2])
        if (skill) skills.push(skill);
        else break;
    }
    return skills;
}

function parseDevelopmentLevels(table: Element): DevLevel[] {
    let rows = table.getElementsByTagName("tr");
    let levels: DevLevel[] = [];
    for (let i = 1; i < rows.length; i++) {
        let buff_rows = rows[i].lastElementChild.children;
        levels.push({
            level: rows[i].firstElementChild.textContent.trim(),
            buffs: Array.from(buff_rows).map(row => parseDevelopmentLevelBuff(row))
        });
    }
    return levels;
}

function parseDevelopmentLevelBuff(row: Element): string {
    if (row.childElementCount === 0) return row.textContent.trim(); // pure text
    else return Array.from(row.childNodes).map(node => {
        if (node.nodeType === 1) {
            let element = <HTMLElement>node;
            return element.textContent || element.title;
        } else return node.textContent;
    }).join(" ");
}

function parseSkill(title: Element, body: Element) {
    if (!title || !body) return null;
    return {
        icon: title.getElementsByTagName("img")[0] ? "https://azurlane.koumakan.jp" + galleryThumbnailUrlToActualUrl(title.getElementsByTagName("img")[0].src) : null,
        names: {
            en: title.firstElementChild.firstElementChild.lastElementChild.childNodes[0].textContent,
            cn: title.querySelector("[lang='zh']") ? title.querySelector("[lang='zh']").textContent : null,
            jp: title.querySelector("[lang='ja']") ? title.querySelector("[lang='ja']").textContent : null
        },
        description: body.textContent.trim(),
        color: title.firstElementChild.getAttribute("style").replace(/^.+background-color:([^;]+).+$/, '$1').toLowerCase() // cant use style.backgroundColor, jsdom's issue
    };
}

function parseFleetTech(table_p: Element): FleetTech {
    let cells = table_p.getElementsByTagName("td");
    return {
        statsBonus: {
            collection: parseStatsBonus(cells[0]),
            maxLevel: parseStatsBonus(cells[1])
        }, techPoints: {
            collection: parseTechPoints(cells[2]),
            maxLimitBreak: parseTechPoints(cells[4]),
            maxLevel: parseTechPoints(cells[5]),
            total: parseTechPoints(cells[3])
        }
    };
}

function parseStatsBonus(cell: Element): Bonus {
    if (!cell || cell.childElementCount === 0 || !cell.children[0] || cell.children[0].tagName === "I") return null;
    let i = 0;
    let statsBonus: Bonus = {applicable: [], bonus: "", stat: undefined};
    for (; cell.children[i] && cell.children[i].tagName === "A"; i++) statsBonus.applicable.push((<HTMLElement>cell.children[i]).title.replace(/\(\w+\)/, '').trim());
    if (!cell.children[i]) return null;
    let stat = camelize((<HTMLElement>cell.children[i]).title.replace(/[^\w ]/g, ''));
    if (!isStat(stat)) {
        console.log("Irregular Stat", cell.ownerDocument.location.href);
        throw 'stat bonus ' + stat
    }
    statsBonus.stat = <Stat>stat;
    statsBonus.bonus = cell.lastChild.textContent.trim();
    return statsBonus;
}

function parseTechPoints(cell: Element): number {
    if (!cell || cell.childElementCount === 0) return 0;
    return parseInt(cell.lastChild.textContent.trim());
}

function parseRetrofit(tbody: Element): { [s: string]: RetrofitProject } {
    let projects: { [s: string]: RetrofitProject } = {};
    let rows = tbody.children;
    for (let i = 1; i < rows.length; i++) {
        let cols = rows[i].children;
        let index = cols[0].textContent.trim();
        let split = cols[1].textContent.replace(/([^(]+)\((.+)\)/, '$1|$2').split("|");
        let split2 = cols[6].textContent.trim().split(" ");
        projects[index] = {
            id: split[0].trim(),
            grade: split[1] ? split[1].trim() : undefined,
            attributes: deepToString(cols[2]).trim().replace(/\s{2,}/g, ' ').split(/ ?and ?|, ?|\n/g).map(s => s.trim()),
            materials: deepToString(cols[3]).trim().replace(/\s{2,}/g, ' ').split(/ ?and ?|, ?|\n/g).map(s => s.trim()),
            coins: parseInt(cols[4].textContent),
            level: parseInt(cols[5].textContent),
            levelBreakLevel: parseInt(split2[0]),
            levelBreakStars: split2[1],
            recurrence: parseInt(cols[7].textContent),
            require: cols[8].textContent.trim().split(/, ?/g).filter(Boolean)
        };
        // if (projects[index].require[0] === "") projects[index].require = [];
    }
    return projects;
}

function parseShipEQSlot(slot: Element): Slot {
    let eqslot: Slot = {
        maxEfficiency: 0, minEfficiency: 0,
        type: slot.children[2].textContent.trim(),
        max: parseInt(slot.children[3].textContent.trim())
    };
    if (slot.children[1].childElementCount > 1) {
        eqslot.minEfficiency = parseInt(slot.children[1].children[0].textContent.replace('%', ''));
        eqslot.maxEfficiency = parseInt(slot.children[1].children[1].textContent.replace('%', ''));
        if (slot.children[1].children[2]) eqslot.kaiEfficiency = parseInt(slot.children[1].children[2].textContent.replace('%', ''));
    }
    return eqslot;
}

function parseStats(doc: Document): ShipStats {
    let allStats: ShipStats = {baseStats: {}, level100: {}, level120: {}};
    ["Base Stats", "Level 100", "Level 120", "Level 100 Retrofit", "Level 120 Retrofit"].map(level => {
        return doc.querySelector("[title='" + level + "'] tbody");
    }).forEach(tab => {
        if (!tab) return;
        let stats: Stats = {};
        let title = tab.parentElement.parentElement.title;
        if (!title) return;
        let names = tab.querySelectorAll("th"),
            bodies = tab.querySelectorAll("td");
        for (let j = 0; j < names.length; j++) {
            let type = (<HTMLElement>names[j].firstElementChild).title;
            if (type === "Hunting range") {
                stats.huntingRange = Array.from(doc.querySelectorAll(".tabbertab:nth-child(2) > .wikitable table tr")).map(row => {
                    return Array.from(row.querySelectorAll("td")).map(cell => cell.style.backgroundColor ? cell.style.backgroundColor === "PaleGreen" ? "S" : cell.textContent.trim() || "*" : " ").join("");
                }).join('\n');
            } else {
                let key = camelize(type.replace(/[^\w ]/g, ''));
                if (!isStat(key)) {
                    console.log("Irregular stat" + doc.location.href);
                    throw 'parseStat ' + key;
                }
                stats[<Stat>key] = bodies[j].textContent.trim();
            }
        }
        // @ts-ignore
        allStats[camelize(title.replace(/[^\w ]/g, ''))] = stats;
    });
    return allStats;
}

function parseShipObtainedFrom(construction_tbody: Element, ship: Ship): { construction: any, obtainedFrom: any } {
    if (!construction_tbody) return {
        construction: {
            constructionTime: ship.rarity === "Priority" || ship.rarity === "Decisive" ? "Research" : "Cannot Be Constructed",
            availableIn: {
                light: false,
                heavy: false,
                aviation: false,
                limited: false,
                exchange: false
            }
        },
        obtainedFrom: {
            obtainedFrom: undefined,
            fromMaps: []
        }
    };
    let construction_time = construction_tbody.children[1].firstElementChild.textContent.trim();
    let available: { [s: string]: string | boolean } = {};
    let construction_types = ["light", "heavy", "aviation", "limited", "exchange"];
    for (let i = 0; i < 5; i++) {
        let elem = construction_tbody.children[3].children[i];
        let value: string | boolean = elem.textContent.trim();
        if (elem.children.length > 0 && (<HTMLElement>elem.firstElementChild).title) value = (<HTMLElement>elem.firstElementChild).title;
        else if (elem.children.length > 0 && elem.firstElementChild.children.length > 0 && (<HTMLElement>elem.firstElementChild.firstElementChild).title) value = (<HTMLElement>elem.firstElementChild.firstElementChild).title;
        else if (elem.children.length > 0) value = elem.firstElementChild.firstElementChild.textContent.trim();
        else value = value === '✓';
        available[construction_types[i]] = value;
    }
    return {
        construction: {constructionTime: construction_time, availableIn: available},
        obtainedFrom: parseShipMapDrop(construction_tbody)
    };
}

const MAP_DROP_START_ANCHOR = ["1", "2", "3", "4 + SOS"];

function parseShipMapDrop(construction_tbody: Element) {
    let obtainedFrom: any = {};
    if (construction_tbody.children[5]) obtainedFrom.obtainedFrom = deepToString(construction_tbody.children[5].lastElementChild).trim();
    obtainedFrom.fromMaps = [];
    for (let i = 1; i <= 4; i++) {
        let j = 0;
        while (construction_tbody.children[i].children[j].textContent.trim() !== MAP_DROP_START_ANCHOR[i - 1] && j < 1000) j++;
        for (let c = 1; c <= 13; c++) if (construction_tbody.children[i].children[j + c].children.length > 0) obtainedFrom.fromMaps.push({
            name: c + "-" + i,
            note: construction_tbody.children[i].children[j + c].querySelector(".tooltiptext").textContent
        }); else if (construction_tbody.children[i].children[j + c].textContent.trim() === "✓") obtainedFrom.fromMaps.push(c + "-" + i);
    }
    return obtainedFrom;
}

export const init = () => kuroshiro.init(new KuromojiAnalyzer());