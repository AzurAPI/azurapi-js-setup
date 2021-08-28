import {init, parseShip} from "./parser";
import {Ship, Skill} from "./ship";
import fs from "fs";
import path from "path";
import {JSDOM} from "jsdom";
import cliProgress, {SingleBar} from "cli-progress";
import {clone, fetch, fetchImage, getHash, timeout} from "../utils";
import {fetchGallery} from "./gallery";

export const ROOT = path.join(__dirname, '..', '..');
export const SHIPS_PATH = path.join(ROOT, 'dist', 'ships.json');
export const INTERNAL_SHIPS_PATH = path.join(ROOT, 'dist', 'ships.internal.json');
export const FORMATTED_SHIPS_PATH = path.join(ROOT, 'dist', 'ships.formatted.json');
export const SHIP_LIST_PATH = path.join(ROOT, 'dist', 'ship-list.json');
export const VERSION_PATH = path.join(ROOT, 'dist', 'version.json');

export let SHIPS: Ship[] = [];
export let SHIPS_INTERNAL: { [s: string]: Ship } = fs.existsSync(INTERNAL_SHIPS_PATH) ? JSON.parse(fs.readFileSync(INTERNAL_SHIPS_PATH).toString()) : {};
export let SHIP_LIST = fs.existsSync(SHIP_LIST_PATH) ? JSON.parse(fs.readFileSync(SHIP_LIST_PATH).toString()) : [];
export let VERSION_INFO = JSON.parse(fs.readFileSync(VERSION_PATH).toString())
const IMAGE_REPO_URL = 'https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/'

const progress = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: false
}, cliProgress.Presets.shades_classic);

export async function refreshShips() {
    SHIP_LIST = await fetchShipList();
    if (!fs.existsSync(path.join(ROOT, 'dist'))) fs.mkdirSync(path.join(ROOT, 'dist'));
    if (!fs.existsSync(path.join(ROOT, 'web'))) fs.mkdirSync(path.join(ROOT, 'web'));
    if (!fs.existsSync(path.join(ROOT, 'images'))) fs.mkdirSync(path.join(ROOT, 'images'));
    if (!fs.existsSync(path.join(ROOT, 'web', 'ships'))) fs.mkdirSync(path.join(ROOT, 'web', 'ships'));
    if (!fs.existsSync(path.join(ROOT, 'web', 'ships.gallery'))) fs.mkdirSync(path.join(ROOT, 'web', 'ships.gallery'));
    fs.writeFileSync(path.join(ROOT, 'dist', 'ship-list.json'), JSON.stringify(SHIP_LIST));
    let keys = Object.keys(SHIP_LIST);
    const bar = progress.create(keys.length, 0);
    await init();
    for (let key of keys) {
        bar.increment();
        bar.render();
        if (key.length === 4 && key.startsWith("3")) continue;
        try {
            let ship = await fetchShip(key, SHIP_LIST[key].name);
            if (!ship) continue;
            SHIPS_INTERNAL[key] = ship;
            const used = process.memoryUsage().heapUsed;
            fs.writeFileSync(INTERNAL_SHIPS_PATH, JSON.stringify(SHIPS_INTERNAL, null, '\t'));
            if (used > 1048576000) await timeout(1000);
        } catch (e) {
            console.log("Error", key, e);
        }
    }
    bar.stop();
}

async function fetchShip(id: string, name: string): Promise<Ship> {
    // if (SHIPS_INTERNAL[id]) return SHIPS_INTERNAL[id];
    let data = await fetch(`https://azurlane.koumakan.jp/${encodeURIComponent(name)}`, path.join(ROOT, `web/ships/${name}.html`));
    let ship = await parseShip(id, name, data);
    let gallery = await fetchGallery(name);
    ship.skins = gallery.skins;
    ship.gallery = gallery.gallery;
    return ship;
}

async function fetchShipList() {
    const bar = progress.create(0, 0);
    let LIST: any = {};
    let rows = new JSDOM(await fetch("https://azurlane.koumakan.jp/List_of_Ships", path.join(ROOT, 'web/ships.index.html'))).window.document.querySelectorAll("#mw-content-text .mw-parser-output table tbody tr");
    bar.setTotal(rows.length);
    rows.forEach(table_ship => {
        let columns = table_ship.childNodes;
        let id = columns[0].textContent;
        if ((<HTMLElement>columns[0]).tagName === "TD") LIST[id] = {
            id: id,
            name: columns[1].textContent,
            rarity: columns[2].textContent,
            type: columns[3].textContent,
            nationality: columns[4].textContent
        };
        bar.increment();
    });
    bar.stop();
    return LIST;
}

export async function refreshShipImages() {
    let shipCounter = 0;
    let keys = Object.keys(SHIPS_INTERNAL);
    const bar = progress.create(keys.length, 0);
    const secondbar = progress.create(0, 0);
    const thirdbar = progress.create(0, 0);
    for (let key of keys) {
        let ship = SHIPS_INTERNAL[key];
        let root_folder = path.join(ROOT, `images/skins/${ship.id}`) + "/";
        if (!fs.existsSync(root_folder)) fs.mkdirSync(root_folder);
        await fetchImage(ship.thumbnail, root_folder + "thumbnail.png", thirdbar);
        bar.increment();
        secondbar.setTotal(ship.skins.length);
        secondbar.update(0);
        for (let skin of ship.skins) {
            let skin_folder = skin.name.replace(/[^\w\s]/gi, '').trim().replace(/ +/g, "_") + "/";
            if (!fs.existsSync(root_folder + skin_folder)) fs.mkdirSync(root_folder + skin_folder);
            if (skin.image) await fetchImage(skin.image, root_folder + skin_folder + 'image.png', thirdbar);
            if (skin.cn) await fetchImage(skin.cn, root_folder + skin_folder + 'image.cn.png', thirdbar);
            if (skin.nobg) await fetchImage(skin.nobg, root_folder + skin_folder + 'image.nobg.png', thirdbar);
            if (skin.chibi) await fetchImage(skin.chibi, root_folder + skin_folder + 'chibi.png', thirdbar);
            else if (skin.name !== "Original Art" && !ship.unreleased) console.log(`${ship.names.en} is missing a chibi for ${skin.name}`);
            if (skin.background) await fetchImage(skin.background, path.join(ROOT, `images/backgrounds/${skin.background.substring(skin.background.lastIndexOf('/') + 1)}`), thirdbar);
            secondbar.increment();
        }
        if (ship.unreleased) continue;
        await Promise.all(ship.gallery.filter(item => !(!item.url)).map(item => fetchImage(item.url, path.join(ROOT, `images/gallery/${item.url.substring(item.url.lastIndexOf('/') + 1)}`), thirdbar)));
        if (!fs.existsSync(path.resolve(ROOT, "images/skills", key))) fs.mkdirSync(path.join(ROOT, "images/skills", key));
        for (let skill of ship.skills) await getSkillIcon(key, skill, ship.skills, ship.skills.map(s => transformSkillName(s.names.en)), thirdbar);
        shipCounter++;
    }
    bar.stop();
    secondbar.stop();
    thirdbar.stop();
    console.log("\nDone");
}

export function publishShips() {
    SHIPS = [];
    let keys = Object.keys(SHIPS_INTERNAL);
    const bar = progress.create(keys.length, 0);
    for (let key of keys) {
        let ship = clone(SHIPS_INTERNAL[key]); //simple clone!
        let root_folder = `images/skins/${ship.id}/`;
        ship.thumbnail = IMAGE_REPO_URL + root_folder + "thumbnail.png";
        let newSkins = [];
        for (let skin of ship.skins) {
            let skin_folder = skin.name.replace(/[^\w\s]/gi, '').trim().replace(/ +/g, "_") + "/";
            if (skin.image) skin.image = IMAGE_REPO_URL + root_folder + skin_folder + 'image.png'; else skin.image = undefined;
            if (skin.cn) skin.cn = IMAGE_REPO_URL + root_folder + skin_folder + 'image.cn.png'; else skin.cn = undefined;
            if (skin.nobg) {
                skin.bg = skin.image;
                skin.image = IMAGE_REPO_URL + root_folder + skin_folder + 'image.nobg.png';
            }
            skin.nobg = undefined;
            skin.chibi = IMAGE_REPO_URL + root_folder + skin_folder + 'chibi.png';
            skin.background = skin.background ? IMAGE_REPO_URL + "images/backgrounds/" + skin.background.substring(skin.background.lastIndexOf('/') + 1) : null;
            newSkins.push(skin); //not sure why but this feels safer
        }
        ship.skins = newSkins;
        if (ship.unreleased) continue;
        let newGallery = [];
        for (let item of ship.gallery) {
            item.url = IMAGE_REPO_URL + "images/gallery/" + item.url.substring(item.url.lastIndexOf('/') + 1).replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, '');
            newGallery.push(item);
        }
        ship.gallery = newGallery;
        ship.skills = ship.skills.map((skill: Skill) => publishSkill(ship.id, skill, ship.skills, ship.skills.map((skill: Skill) => transformSkillName(skill.names.en))));
        bar.increment({filename: ship.names.code})
        SHIPS.push(ship);
    }
    bar.stop();
    SHIPS.sort((a, b) => a.names.en < b.names.en ? -1 : a.names.en > b.names.en ? 1 : 0);
    let ships_value = JSON.stringify(SHIPS);
    fs.writeFileSync(SHIPS_PATH, ships_value);
    fs.writeFileSync(FORMATTED_SHIPS_PATH, JSON.stringify(SHIPS, null, 4));
    VERSION_INFO.ships.hash = getHash(ships_value);
    VERSION_INFO.ships["version-number"] += 1;
    VERSION_INFO.ships["last-data-refresh-date"] = Date.now();
    VERSION_INFO["version-number"] = (VERSION_INFO["version-number"] ?? 0) + 1;
    fs.writeFileSync(VERSION_PATH, JSON.stringify(VERSION_INFO));
    console.log("Done Publishing");
    process.exit();
}

function publishSkill(id: string, skill: Skill, skills: Skill[], names: string[]) {
    let name = transformSkillName(skill.names.en);
    if (names.filter(n => n === name).length > 1) skill.icon = IMAGE_REPO_URL + "images/skills/" + id + "/" + skill.color + "." + name + ".png";
    else skill.icon = IMAGE_REPO_URL + "images/skills/" + id + "/" + name + ".png";
    return skill;
}

async function getSkillIcon(key: string, skill: Skill, skills: Skill[], names: string[], bar?: SingleBar) {
    if (!skill) return;
    let skillName = transformSkillName(skill.names.en);
    let spath;
    if (names.filter(n => n === skillName).length > 1) spath = path.resolve(ROOT, "images/skills/" + key + "/" + skill.color + "." + skillName + ".png");
    else spath = path.resolve(ROOT, "images/skills/" + key + "/" + skillName + ".png");
    if (skill.icon !== null) await fetchImage(skill.icon, spath, bar);
}

function transformSkillName(name: String) {
    name = name.toLowerCase();
    if (name.includes('(retrofit)')) name = name.replace('(retrofit)', '') + ".kai";
    return name.trim().replace(/[\s-]+/g, '_').replace(/[^a-zA-Z0-9-_]/g, '');
    ;
}