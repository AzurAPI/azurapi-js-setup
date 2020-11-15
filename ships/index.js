let SHIP_LIST = require("../ship-list.json");
let SHIPS = require("../ships.json") || [];
let SHIPS_INTERNAL = require("../ships.internal.json") || {};
let VERSION_INFO = require("../version-info.json");

const fs = require('fs');
const path = require("path");
const JSDOM = require('jsdom').JSDOM;
const cliProgress = require('cli-progress');

const SKIN_PATH = 'images/skins/${id}/';
const SKIN_NAME_PATH = '${name}/';
const SKIN_FILE_NAME = '${type}.png';

const IMAGE_REPO_URL = 'https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/'

const {parseShip} = require('./parser');
const {fetchGallery} = require('./gallery');
const {fetch, fetchImage, timeout, clone, getHash} = require('../utils');

const progress = new cliProgress.MultiBar({
    clearOnComplete: false,
    hideCursor: false
}, cliProgress.Presets.shades_classic);

async function refreshShips() {
    SHIP_LIST = await fetchShipList();
    fs.writeFileSync(path.resolve(__dirname, '../ship-list.json'), JSON.stringify(SHIP_LIST));
    let keys = Object.keys(SHIP_LIST);
    const bar = progress.create(keys.length, 0);
    for (let key of keys) {
        bar.increment();
        if (key.length === 4 && key.startsWith("3")) continue;
        let ship = await fetchShip(key, SHIP_LIST[key].name);
        if (!ship) continue;
        SHIPS_INTERNAL[key] = ship;
        const used = process.memoryUsage().heapUsed;
        fs.writeFileSync(path.resolve(__dirname, '../ships.internal.json'), JSON.stringify(SHIPS_INTERNAL, null, '\t'));
        if (used > 1048576000) await timeout(1000);
    }
}

async function fetchShip(id, name) {
    if (SHIPS_INTERNAL[id]) return SHIPS_INTERNAL[id];
    let data = await fetch(`https://azurlane.koumakan.jp/${encodeURIComponent(name)}`, path.resolve(__dirname, `../web/ships/${name}.html`));
    let ship = parseShip(id, name, data);
    let gallery = await fetchGallery(name);
    ship.skins = gallery.skins;
    ship.gallery = gallery.gallery;
    return ship;
}

async function fetchShipList() {
    if (Object.keys(SHIP_LIST).length > 0) return SHIP_LIST;
    const bar = progress.create(0, 0);
    let LIST = {};
    let rows = new JSDOM(await fetch("https://azurlane.koumakan.jp/List_of_Ships", path.resolve(__dirname, '../web/ships.index.html'))).window.document.querySelectorAll("#mw-content-text .mw-parser-output table tbody tr");
    bar.setTotal(rows.length);
    rows.forEach(table_ship => {
        let columns = table_ship.childNodes;
        let id = columns[0].textContent;
        if (columns[0].tagName === "TD") LIST[id] = {
            id: id,
            name: columns[1].textContent,
            rarity: columns[2].textContent,
            type: columns[3].textContent,
            nationality: columns[4].textContent
        };
        bar.increment();
    });
    return LIST;
}

async function refreshShipImages() {
    let shipCounter = 0;
    let keys = Object.keys(SHIPS_INTERNAL);
    const bar = progress.create(keys.length, 0);
    const secondbar = progress.create(0, 0);
    for (let key of keys) {
        let ship = SHIPS_INTERNAL[key];
        let root_folder = path.resolve(__dirname, '../' + SKIN_PATH.replace('${id}', ship.id)) + '/';
        if (!fs.existsSync(root_folder)) fs.mkdirSync(root_folder);
        await fetchImage(ship.thumbnail, root_folder + "thumbnail.png");
        bar.increment();
        secondbar.setTotal(ship.skins.length);
        secondbar.update(0);
        for (let skin of ship.skins) {
            let skin_folder = SKIN_NAME_PATH.replace('${name}', skin.name.replace(/[^\w\s]/gi, '').trim().replace(/ +/g, "_"));
            if (!fs.existsSync(root_folder + skin_folder)) fs.mkdirSync(root_folder + skin_folder);
            let image_path = root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image').replace(/ +/g, "_");
            let image_path_cn = root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image.cn').replace(/ +/g, "_");
            let image_path_nobg = root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image.nobg').replace(/ +/g, "_");
            let chibi_path = root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'chibi').replace(/ +/g, "_");
            if (skin.image) await fetchImage(skin.image, image_path);
            if (skin.cn) await fetchImage(skin.cn, image_path_cn);
            if (skin.nobg) await fetchImage(skin.nobg, image_path_nobg);
            if (skin.chibi) await fetchImage(skin.chibi, chibi_path);
            else if (skin.name !== "Original Art" && !ship.unreleased) console.log(`${ship.names.en} is missing a chibi for ${skin.name}`);
            if (skin.background) await fetchImage(skin.background, path.resolve(__dirname, `../images/backgrounds/${skin.background.substring(skin.background.lastIndexOf('/') + 1)}`));
            secondbar.increment();
        }
        if (ship.unreleased) continue;
        await Promise.all(ship.gallery.filter(item => !(!item.url)).map(item => fetchImage(item.url, path.resolve(__dirname, `../images/gallery/${item.url.substring(item.url.lastIndexOf('/') + 1)}`))));
        let getSkillIcon = async (skill) => {
            if (!skill) return;
            let skillName = skill.names.en.toLowerCase();
            if (skillName.includes('(retrofit)')) skillName = skillName.replace('(retrofit)', '') + ".kai";
            skillName = skillName.trim().replace(/\s+/g, '_');
            let spath = path.resolve(__dirname, "../images/skills/" + key + "/" + skillName + ".png");
            if (skill.icon !== null) await fetchImage(skill.icon, spath);
        };
        if (!fs.existsSync(path.resolve(__dirname, "../images/skills/" + key))) fs.mkdirSync(path.resolve(__dirname, "../images/skills/" + key));
        for (let skill of ship.skills) await getSkillIcon(skill);
        shipCounter++;
    }
    console.log("\nDone");
}

function publishShips() {
    SHIPS = [];
    let keys = Object.keys(SHIPS_INTERNAL);
    const bar = progress.create(keys.length, 0);
    for (let key of keys) {
        let ship = clone(SHIPS_INTERNAL[key]); //simple clone!
        let root_folder = SKIN_PATH.replace('${id}', ship.id);
        ship.thumbnail = IMAGE_REPO_URL + root_folder + "thumbnail.png";
        let newSkins = [];
        for (let skin of ship.skins) {
            let skin_folder = SKIN_NAME_PATH.replace('${name}', skin.name.replace(/[^\w\s]/gi, '').trim().replace(/ +/g, "_"));
            if (skin.image) skin.image = IMAGE_REPO_URL + root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image').replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, ''); else skin.image = undefined;
            if (skin.cn) skin.cn = IMAGE_REPO_URL + root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image.cn').replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, ''); else skin.cn = undefined;
            if (skin.nobg) {
                skin.bg = skin.image;
                skin.image = IMAGE_REPO_URL + root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image.nobg').replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, '');
            }
            skin.nobg = undefined;
            skin.chibi = IMAGE_REPO_URL + root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'chibi').replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, '');
            skin.background = skin.background ? IMAGE_REPO_URL + "images/backgrounds/" + skin.background.substring(skin.background.lastIndexOf('/') + 1) : null;
            skin.info.live2dModel = skin.info.live2dModel === "Yes" // true if and only if "Yes"
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
        ship.skills = ship.skills.map(publishSkill);
        bar.increment({filename: ship.names.code})
        SHIPS.push(ship);
    }
    SHIPS.sort((a, b) => a.names.en < b.names.en ? -1 : a.names.en > b.names.en ? 1 : 0);
    let ships_value = JSON.stringify(SHIPS);
    fs.writeFileSync(path.resolve(__dirname, '../ships.json'), ships_value);
    fs.writeFileSync(path.resolve(__dirname, '../ships.formatted.json'), JSON.stringify(SHIPS, null, 4));
    VERSION_INFO.ships.hash = getHash(ships_value);
    VERSION_INFO.ships["version-number"] += 1;
    VERSION_INFO.ships["last-data-refresh-date"] = Date.now();
    VERSION_INFO.ships["number-of-ships"] = Object.keys(SHIP_LIST).length;
    fs.writeFileSync(path.resolve(__dirname, '../version-info.json'), JSON.stringify(VERSION_INFO));
    console.log("Done");
}

function publishSkill(skill) {
    skill.icon = IMAGE_REPO_URL + "images/skills/" + skill.names.en.replace(/\s+/g, '_').toLowerCase() + ".png";
    return skill;
}

module.exports = {
    refreshShipImages, refreshShips, publishShips
}