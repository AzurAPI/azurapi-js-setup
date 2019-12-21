// This file is for fetching data from wiki
const crypto = require('crypto');
const fs = require('fs');
const request = require('request');
const JSDOM = require('jsdom').JSDOM;
const srcset = require('srcset');

const chapter = require('./chapter.js');

const SKIN_PATH = 'images/skins/${id}/';
const SKIN_NAME_PATH = '${name}/';
const SKIN_FILE_NAME = '${type}.png';

const IMAGE_REPO_URL = 'https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/'

let SHIP_LIST = require("./ship-list.json");
let SHIPS = require("./ships.json");
let EQUIPMENTS = require("./equipments.internal.json");
let EQUIPMENTS_PUBLIC = require("./equipments.json");
let CHAPTERS = require("./chapters.json");
let SHIPS_INTERNAL = require("./ships.internal.json");
let VERSION_INFO = require("./version-info.json");
let IMAGE_PROGRESS = require("./image-progress.json");

const HEADERS = {
    'user-agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'cookie': 'VEE=wikitext'
};

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    filter: filter,
    publishShips: publishShips,
    publishEQ: publishEQ,
    refreshShips: refreshShips,
    refreshImages: refreshImages,
    refreshEquipments: refreshEquipments,
    refreshChapter: refreshChapter
}
// Filtering the ship list
function filter(callback) {
    let newShips = {};
    Object.keys(SHIPS_INTERNAL).forEach(key => {
        if (callback(SHIPS_INTERNAL[key]))
            newShips[key] = SHIPS_INTERNAL[key]
    });
    return newShips;
}

// Refresh ships
async function refreshShips(online) {
    SHIP_LIST = await fetchShipList(online);
    let shipCounter = 0;
    fs.writeFileSync('./ship-list.json', JSON.stringify(SHIP_LIST));
    console.log("Updated ship list, current ship count = " + Object.keys(SHIP_LIST).length);
    console.log("Loaded a ship list of " + Object.keys(SHIP_LIST).length + " ships.\nLoaded " + Object.keys(SHIPS).length + " ships from cache.");
    let keys = Object.keys(SHIP_LIST);
    for (key of keys) {
        let ship = await refreshShip(key, online);
        shipCounter++;
        if (shipCounter % 32 == 0) process.stdout.write(" " + shipCounter + " Done\n");
        if (!ship) continue;
        SHIPS_INTERNAL[key] = ship;
        fs.writeFileSync('./ships.internal.json', JSON.stringify(SHIPS_INTERNAL, null, '\t'));
    }
    console.log("\nDone");
}

async function refreshImages(overwrite) {
    if (IMAGE_PROGRESS.last_id) {
        console.log("Program Last Stopped at ID \"" + IMAGE_PROGRESS.last_id + "\". Deleting " + SKIN_PATH.replace('${id}', IMAGE_PROGRESS.last_id));
        //deleteAll(SKIN_PATH.replace('${id}', IMAGE_PROGRESS.last_id));
        console.log("Done")
    }
    console.log("Refreshing images...");
    let shipCounter = 0;
    console.log("Images from ships...");
    for (let key in SHIPS_INTERNAL) {
        let ship = SHIPS_INTERNAL[key];
        IMAGE_PROGRESS.last_id = key;
        fs.writeFileSync('./image-progress.json', JSON.stringify(IMAGE_PROGRESS));
        let root_folder = SKIN_PATH.replace('${id}', ship.id);
        if (!fs.existsSync(root_folder)) fs.mkdirSync(root_folder);
        process.stdout.write(`${key}`);
        if (!fs.existsSync(root_folder + "thumbnail.png") || overwrite)
            await fetchImage(ship.thumbnail, root_folder + "thumbnail.png");
        process.stdout.write("-");
        for (let skin of ship.skins) {
            let skin_folder = SKIN_NAME_PATH.replace('${name}', skin.name.replace(/[^\w\s]/gi, '').replace(/ +/g, "_"));
            if (!fs.existsSync(root_folder + skin_folder)) fs.mkdirSync(root_folder + skin_folder);
            let image_path = root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image').replace(/ +/g, "_");
            let chibi_path = root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'chibi').replace(/ +/g, "_");
            if (skin.image !== null && (!fs.existsSync(image_path) || overwrite))
                await fetchImage(skin.image, image_path);
            process.stdout.write(".");
            if (skin.chibi !== null && (!fs.existsSync(chibi_path) || overwrite))
                await fetchImage(skin.chibi, chibi_path);
            process.stdout.write("|");
            if (skin.background !== null && (!fs.existsSync("./images/backgrounds/" + skin.background.substring(skin.background.lastIndexOf('/') + 1)) || overwrite)) {
                await fetchImage(skin.background, "./images/backgrounds/" + skin.background.substring(skin.background.lastIndexOf('/') + 1));
                console.log("\nDownloaded " + skin.background);
            }
        }
        process.stdout.write("G");
        for (let item of ship.gallery) {
            if (item.url !== null && (!fs.existsSync("./images/gallery/" + item.url.substring(item.url.lastIndexOf('/') + 1)) || overwrite)) {
                IMAGE_PROGRESS.last_gallery_item = item.url.substring(item.url.lastIndexOf('/') + 1);
                fs.writeFileSync('./image-progress.json', JSON.stringify(IMAGE_PROGRESS));
                process.stdout.write("\nDownloading gallery item " + IMAGE_PROGRESS.last_gallery_item);
                await fetchImage(item.url, "./images/gallery/" + item.url.substring(item.url.lastIndexOf('/') + 1));
                console.log("Done");
            }
        }
        shipCounter++;
        if (shipCounter % 50 == 0) process.stdout.write(` ${shipCounter} Done\n|`);
    }
    IMAGE_PROGRESS.last_id = null;
    fs.writeFileSync('./image-progress.json', JSON.stringify(IMAGE_PROGRESS));
    console.log("Equipments...");
    for (let cat in EQUIPMENTS) {
        for (let key in EQUIPMENTS[cat]) {
            let eq = EQUIPMENTS[cat][key];
            process.stdout.write(key);
            let cleanName = key.replace(/[^\w\s\d]/g, '').replace(/\s+/g, '_');
            if (!fs.existsSync("./images/equipments/" + cleanName + ".png") || overwrite)
                await fetchImage(eq.image, "./images/equipments/" + cleanName + ".png");
            process.stdout.write('.');
            if (eq.misc.animation && !fs.existsSync("./images/equipments.animation/" + cleanName + ".gif") || overwrite)
                await fetchImage(eq.misc.animation, "./images/equipments.animation/" + cleanName + ".gif");
            process.stdout.write('.\n');
        }
    }
    console.log("\nDone");
}

async function refreshEquipments(online) {
    let data;
    process.stdout.write("Refreshing Equipments");
    if (!fs.existsSync('./web/equipments/equipment_list.html') || online) fs.writeFileSync('./web/equipments/equipment_list.html', data = await fetch("https://azurlane.koumakan.jp/Equipment_List"));
    else data = fs.readFileSync('./web/equipments/equipment_list.html', 'utf8');
    process.stdout.write("EQ Menu Loaded\n");
    for (let equipment_type of new JSDOM(data).window.document.querySelectorAll("ul:nth-child(7) li")) { // Equipments types layer
        let category = equipment_type.textContent;
        console.log("Refreshing Equipments type= " + category + "...");
        if (!fs.existsSync('./web/equipments/' + category + '_list.html') || online) {
            process.stdout.write("Getting List...");
            data = await fetch("https://azurlane.koumakan.jp" + equipment_type.firstElementChild.getAttribute("href"))
            fs.writeFileSync('./web/equipments/' + category + '_list.html', data);
            process.stdout.write("Done\n");
        } else data = fs.readFileSync('./web/equipments/' + category + '_list.html', 'utf8');
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
    for (let i = 1; i <= 13; i++) {
        let data;
        process.stdout.write("Refreshing Chapter " + i + " Details");
        if (!fs.existsSync('./web/chapters/' + i + '.html') || online) fs.writeFileSync('./web/chapters/' + i + '.html', data = await fetch("https://azurlane.koumakan.jp/Chapter_" + i));
        else data = fs.readFileSync('./web/chapters/' + i + '.html', 'utf8');
        CHAPTERS[i] = chapter.parseChapter(new JSDOM(data).window.document, i);
        fs.writeFileSync('./chapters.json', JSON.stringify(CHAPTERS, null, '\t'));
        console.log("\nDone");
    }
}

function publishShips() {
    SHIPS = {};
    for (let key in SHIPS_INTERNAL) {
        process.stdout.write(">");
        SHIPS[key] = clone(SHIPS_INTERNAL[key]); //simple clone!
        let root_folder = SKIN_PATH.replace('${id}', SHIPS[key].id);
        SHIPS[key].thumbnail = IMAGE_REPO_URL + root_folder + "thumbnail.png";
        process.stdout.write("-");
        let newSkins = [];
        for (let skin of SHIPS[key].skins) {
            process.stdout.write(".");
            let skin_folder = SKIN_NAME_PATH.replace('${name}', skin.name.replace(/[^\w\s]/gi, '').replace(/ +/g, "_"));
            skin.image = IMAGE_REPO_URL + root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image').replace(/ +/g, "_");
            skin.chibi = IMAGE_REPO_URL + root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'chibi').replace(/ +/g, "_");
            skin.background = IMAGE_REPO_URL + "images/backgrounds/" + skin.background.substring(skin.background.lastIndexOf('/') + 1);
            newSkins.push(skin); //not sure why but this feels safer
        }
        SHIPS[key].skins = newSkins;
        process.stdout.write("|");
        let newGallery = [];
        for (let item of SHIPS[key].gallery) {
            process.stdout.write(".");
            item.url = IMAGE_REPO_URL + "images/gallery/" + item.url.substring(item.url.lastIndexOf('/') + 1);
            newGallery.push(item);
        }
        SHIPS[key].gallery = newGallery;
        process.stdout.write("|");
    }
    let ships_value = JSON.stringify(SHIPS);
    fs.writeFileSync('./ships.json', ships_value);
    VERSION_INFO.ships.hash = getHash(ships_value);
    VERSION_INFO.ships["version-number"] += 1;
    VERSION_INFO.ships["last-data-refresh-date"] = Date.now();
    VERSION_INFO.ships["number-of-ships"] = SHIP_LIST.length;
    fs.writeFileSync('./version-info.json', JSON.stringify(VERSION_INFO));
}

function publishEQ() {
    EQUIPMENTS_PUBLIC = {};
    for (let key in EQUIPMENTS) {
        EQUIPMENTS_PUBLIC[key] = clone(EQUIPMENTS[key]);
        let cleanName = key.replace(/[^\w\s\d]/g, '').replace(/\s+/g, '_');
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

// Refresh a ship with specified id
async function refreshShip(id, online) {
    if (!SHIPS_INTERNAL.hasOwnProperty(id) || online) { // Revive Program From Crush/Forced online fetch
        process.stdout.write("+");
        return await fetchShip(SHIP_LIST[id].name, online);
    } else {
        process.stdout.write("-");
        return false;
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
async function fetchShipList(online) {
    if (!online || SHIP_LIST.length != 0) return SHIP_LIST;
    let LIST = {};
    new JSDOM(await fetch("https://azurlane.koumakan.jp/List_of_Ships")).window.document.querySelectorAll("#mw-content-text .mw-parser-output table tbody tr").forEach(table_ship => {
        let columns = table_ship.childNodes;
        if (columns[0].tagName === "TD") LIST[columns[0].textContent] = {
            id: columns[0].textContent,
            name: columns[1].textContent,
            rarity: columns[2].textContent,
            type: columns[3].textContent,
            nationality: columns[4].textContent
        };
    });
    return LIST;
}

async function fetchShip(name, online) {
    let data;
    if (online) { // Fetch from the wiki directly
        data = await fetch("https://azurlane.koumakan.jp/" + encodeURIComponent(name.replace(/ +/g, "_")) + "?useformat=desktop")
        fs.writeFileSync('./web/ships/' + name + '.html', data);
    } else {
        if (!fs.existsSync('./web/ships/' + name + '.html')) return fetchShip(name, true); // Enforcing
        data = fs.readFileSync('./web/ships/' + name + '.html', 'utf8'); // Read from local cache
    }
    let ship = parseShip(name, data);
    ship.skins = await fetchGallery(name, online)
    return ship;
}

async function fetchGallery(name, online) {
    if (online) {
        const body = await fetch("https://azurlane.koumakan.jp/" + name.replace(/ +/g, "_") + "/Gallery");
        fs.writeFileSync('./web/ships.gallery/' + name + '.html', body);
        return parseGallery(name, body);
    } else {
        if (!fs.existsSync('./web/ships.gallery/' + name + '.html')) return fetchGallery(name, true); // Enforcing
        return parseGallery(name, fs.readFileSync('./web/ships.gallery/' + name + '.html', 'utf8'));
    }
}

async function fetchEquipment(href, name, category, online) {
    if (online) { // Fetch from the wiki directly
        process.stdout.write("online, loading..");
        const body = await fetch(href);
        process.stdout.write(".| ");
        fs.writeFileSync('./web/equipments/' + category + '/' + name.replace(/\//g, "_") + '.html', body);
        let equipment = parseEquipment(href, category, body);
        return equipment;
    } else {
        if (!fs.existsSync('./web/equipments/' + category + '/' + name.replace(/\//g, "_") + '.html')) return fetchEquipment(href, name, category, true); // Enforcing
        process.stdout.write("local ");
        let equipment = parseEquipment(href, category, fs.readFileSync('./web/equipments/' + category + '/' + name.replace(/\//g, "_") + '.html', 'utf8')); // Read from local cache
        return equipment;
    }
}

// Parse ship page html body, need a name
function parseShip(name, body) {
    const doc = new JSDOM(body).window.document;
    let code;
    if (doc.querySelector(".nomobile:nth-child(3) > div > div:nth-child(1)")) {
        code = doc.querySelector(".nomobile:nth-child(3) > div > div:nth-child(1)").childNodes[0].textContent.trim();
        code = code.substring(0, code.lastIndexOf(" "))
    } else code = doc.querySelector(".nomobile:nth-child(2) > div > div:nth-child(1)").textContent;
    let ship = {
        wikiUrl: "https://azurlane.koumakan.jp/" + name.replace(/ +/g, "_"),
        id: doc.querySelector('div:nth-child(4) > .wikitable:nth-child(1) tr:nth-child(1) > td').textContent.trim(),
        names: {
            en: doc.querySelector('#firstHeading').textContent,
            code: code,
            cn: doc.querySelector('[lang="zh"]') ? doc.querySelector('[lang="zh"]').textContent : null,
            jp: doc.querySelector('[lang="ja"]') ? doc.querySelector('[lang="ja"]').textContent : null,
            kr: doc.querySelector('[lang="ko"]') ? doc.querySelector('[lang="ko"]').textContent : null
        },
        class: doc.querySelector("div:nth-child(3) > .wikitable tr:nth-child(3) > td:nth-child(2) > a") ? doc.querySelector("div:nth-child(3) > .wikitable tr:nth-child(3) > td:nth-child(2) > a").textContent : null,
        nationality: doc.querySelector("div:nth-child(4) > .wikitable tr:nth-child(2) a:nth-child(2)").textContent,
        hullType: doc.querySelector(".wikitable tr:nth-child(3) a:nth-child(2)").textContent
    }
    if (doc.querySelectorAll("#mw-content-text .mw-parser-output > div").length < 2) { // Unreleased
        let images = doc.getElementsByTagName("img");
        ship.unreleased = true;
        ship.thumbnail = "https://azurlane.koumakan.jp" + images[1].getAttribute("src");
        ship.skins = [{
            name: name,
            image: "https://azurlane.koumakan.jp" + doc.querySelector(".tabbertab .image > img").getAttribute("src"),
            background: "https://azurlane.koumakan.jp/w/images/3/3a/MainDayBG.png",
            chibi: doc.querySelector("td > div > div:nth-child(2) img") ? "https://azurlane.koumakan.jp" + doc.querySelector("td > div > div:nth-child(2) img").getAttribute("src") : null,
            "info": {
                "Obtained From": "Default",
                "Live2D Model": "No"
            }
        }];
        ship.rarity = "Unreleased";
        ship.enhance_value = {
            firepower: 0,
            torpedo: 0,
            aviation: 0,
            reload: 0
        };
        ship.slots = [{}, {}, {}];
        ship.scrap_value = {
            coin: 0,
            oil: 0,
            medal: 0
        };
        ship.gallery = [];
        ship.construction = {
            "construction_time": "Cannot Be Constructed",
            "available_in": {
                "Light": false,
                "Heavy": false,
                "Aviation": false,
                "Limited": false,
                "Exchange": false
            }
        };
        ship.limit_breaks = [{}, {}, {}];
        ship.skills = [{}, {}, {}];
        return ship;
    }
    const misc_selectors = [2, 3, 4, 5, 6].map(i => doc.querySelector(`.nomobile:nth-child(1) tr:nth-child(${i}) a`));
    ship.thumbnail = "https://azurlane.koumakan.jp" + doc.getElementsByTagName("img")[0].getAttribute("src");
    ship.rarity = doc.querySelector("div:nth-child(3) > .wikitable td img").parentNode.title;
    let stars = doc.querySelector("div:nth-child(1) > div:nth-child(3) > .wikitable:nth-child(1) tr:nth-child(2) > td").textContent.trim();
    ship.stars = {
        stars: stars,
        value: stars.split("★").length - 1
    };
    ship.stats = parseStats(doc);
    let eqslots = [doc.querySelector(".nomobile > div > .wikitable tr:nth-child(3)"), doc.querySelector(".nomobile > div > .wikitable tr:nth-child(4)"), doc.querySelector(".nomobile > div > .wikitable tr:nth-child(5)")];
    ship.slots = eqslots.map(slot => parseShipEQSlot(slot));
    let enhance_values = doc.querySelector(".nomobile:nth-child(4) td:nth-child(1)").childNodes;
    if (enhance_values.length < 7) ship.enhance_value = doc.querySelector(".nomobile:nth-child(4) td:nth-child(1)").textContent.trim();
    else ship.enhance_value = {
        firepower: parseInt(enhance_values[0].textContent.trim()),
        torpedo: parseInt(enhance_values[2].textContent.trim()),
        aviation: parseInt(enhance_values[4].textContent.trim()),
        reload: parseInt(enhance_values[6].textContent.trim())
    };
    let scrap_values = doc.querySelector(".nomobile:nth-child(4) td:nth-child(2)").childNodes;
    if (scrap_values.length < 5) ship.scrap_value = doc.querySelector(".nomobile:nth-child(4) td:nth-child(2)").textContent.trim();
    else ship.scrap_value = {
        coin: parseInt(scrap_values[0].textContent.trim()),
        oil: parseInt(scrap_values[2].textContent.trim()),
        medal: parseInt(scrap_values[4].textContent.trim())
    };
    let shipLSk = parseShipLSKTable(doc.querySelector(".nomobile:nth-child(5)"));
    ship.skills = shipLSk.skills;
    ship.limit_breaks = shipLSk.limits;
    ship.construction = parseShipConstruction(doc.querySelector("#Construction tbody"));
    ship.gallery = parseShipGallery(doc);
    ship.misc = {
        artist: misc_selectors[0] ? misc_selectors[0].textContent : null,
        web: misc_selectors[1] ? {
            name: misc_selectors[1].textContent,
            url: misc_selectors[1].getAttribute("href")
        } : null,
        pixiv: misc_selectors[2] ? {
            name: misc_selectors[2].textContent,
            url: misc_selectors[2].getAttribute("href")
        } : null,
        twitter: misc_selectors[3] ? {
            name: misc_selectors[3].textContent,
            url: misc_selectors[3].getAttribute("href")
        } : null,
        voice: misc_selectors[4] ? misc_selectors[4].textContent : null
    };
    return ship;
}

function parseShipLSKTable(skill_table) {
    let rows = skill_table.getElementsByTagName("tr");
    rows = [rows[1], rows[2], rows[3]];
    return {
        skills: rows.map(parseSkill),
        limits: rows.map(parseLimitBreak)
    };
}

function parseLimitBreak(row) {
    return {
        limit: row.children[0].textContent.trim(),
        description: row.children[1].textContent.trim()
    };
}

function parseSkill(row) {
    let skill = {
        description: row.lastElementChild.textContent.trim()
    };
    if (skill.description) {
        let cn_name = row.children[2].children[2] ? row.children[2].children[2].textContent.trim() : null;
        let jp_name = row.children[2].children[4] ? row.children[2].children[4].textContent.trim() : null;
        skill.names = {
            en: row.children[2].firstElementChild.textContent.trim(),
            cn: cn_name ? cn_name.substring(cn_name.indexOf(":") + 2) : null,
            jp: jp_name ? jp_name.substring(jp_name.indexOf(":") + 2) : null
        };
        return skill;
    } else return {};
}

function parseShipEQSlot(slot) {
    let eqslot = {
        index: parseInt(slot.children[0].textContent.trim()),
        type: slot.children[2].textContent.trim()
    };
    if (slot.children[1].firstElementChild) {
        eqslot.min_efficiency = parseInt(slot.children[1].firstElementChild.textContent.replace('%', ''));
        eqslot.max_efficiency = parseInt(slot.children[1].lastElementChild.textContent.replace('%', ''));
    }
    return eqslot;
}
// Parse the stats seperately for easy code reading
function parseStats(doc) {
    let allStats = {};
    doc.querySelectorAll(".nomobile > .tabber > .tabbertab .wikitable tbody").forEach(tab => {
        let stats = {};
        let title = tab.parentNode.parentNode.title;
        if (!title) return;
        let names = tab.querySelectorAll("th"),
            bodies = tab.querySelectorAll("td");
        for (let j = 0; j < names.length; j++) {
            let type = names[j].firstElementChild.title;
            if (type === "Hunting range") {
                let range = [];
                doc.querySelectorAll(".tabbertab:nth-child(2) > .wikitable table tr").forEach(row => {
                    let rangeRow = [];
                    row.querySelectorAll("td").forEach(cell => rangeRow.push(cell.style.backgroundColor ? cell.style.backgroundColor === "PaleGreen" ? "S" : (cell.textContent.trim() ? cell.textContent.trim() : "*") : ""));
                    range.push(rangeRow);
                });
                stats[type] = range;
            } else stats[type] = bodies[j].textContent.trim();
        }
        allStats[title] = stats;
    });
    return allStats;
}
// Parse ship's gallery page html body, need a name
function parseGallery(name, body) {
    let skins = [];
    Array.from(new JSDOM(body).window.document.getElementsByClassName("tabbertab")).forEach(tab => {
        let info = {};
        tab.querySelectorAll(".ship-skin-infotable tr").forEach(row => info[row.getElementsByTagName("th")[0].textContent.trim()] = row.getElementsByTagName("td")[0].textContent.trim());
        let parsedSet = srcset.parse(tab.querySelector(".ship-skin-image img").srcset);
        skins.push({
            name: tab.title,
            image: "https://azurlane.koumakan.jp" + parsedSet.sort((s1, s2) => compare(s2.density, s1.density))[0].url,
            background: "https://azurlane.koumakan.jp" + tab.querySelector(".res img").getAttribute("src"),
            chibi: tab.querySelector(".ship-skin-chibi img") ? "https://azurlane.koumakan.jp" + tab.querySelector(".ship-skin-chibi img").getAttribute("src") : null,
            info: info
        });
    });
    return skins;
}

function parseShipConstruction(construction_tbody) {
    let construction_time = construction_tbody.children[1].firstElementChild.textContent.trim();
    let available = {};
    let construction_types = ["Light", "Heavy", "Aviation", "Limited", "Exchange"];
    for (let i = 0; i < 5; i++) {
        let elem = construction_tbody.children[3].children[i];
        let value = elem.textContent.trim();
        if (elem.children.length > 0) value = elem.firstElementChild.firstElementChild.textContent.trim();
        else value = value === '✓';
        available[construction_types[i]] = value;
    }
    return {
        construction_time: construction_time,
        available_in: available
    };
}

function parseShipGallery(doc) {
    let ship_galleries = doc.querySelectorAll(".nomobile:nth-child(8) > div>div >div>div");
    let gallery = [];
    for (let thumb of ship_galleries) gallery.push({
        description: thumb.lastElementChild.textContent,
        url: "https://azurlane.koumakan.jp" + galleryThumbnailUrlToActualUrl(thumb.firstElementChild.firstElementChild.src)
    });
    return gallery;
}
// Its only a prediction
function galleryThumbnailUrlToActualUrl(tdir) {
    return tdir.replace(/\/w\/images\/thumb\/(.\/..)\/([^\/]+)\/.+/g, '/w/images/$1/$2');
}

function parseEquipment(href, category, body) {
    const doc = new JSDOM(body).window.document;
    let tabs = doc.getElementsByClassName("eqbox");
    process.stdout.write("tab count = " + tabs.length + " .");
    let eq = {
        wikiUrl: href,
        category: category,
        names: {
            en: doc.querySelector('[lang="en"]') ? doc.querySelector('[lang="en"]').textContent : null,
            cn: doc.querySelector('[lang="zh"]') ? doc.querySelector('[lang="zh"]').textContent : null,
            jp: doc.querySelector('[lang="ja"]') ? doc.querySelector('[lang="ja"]').textContent : null,
            kr: doc.querySelector('[lang="ko"]') ? doc.querySelector('[lang="ko"]').textContent : null
        }
    };
    let tiers = {};
    for (tab of tabs) {
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
    let primaryRows = eqbox.querySelectorAll(".eqinfo:nth-child(2) td");
    let stars = primaryRows[1].firstElementChild.lastChild.innerHTML.split("<br>")[1];
    let image = srcset.parse(eqbox.getElementsByTagName("img")[0].srcset).sort((s1, s2) => compare(s2.density, s1.density))[0].url;
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
        stats: parseEquipmentStats(eqbox.getElementsByClassName("eqstats")[0]),
        fits: parseEquipmentFit(eqbox.getElementsByClassName("eqfits")[0]),
        misc: parseEquipmentMisc(eqbox.getElementsByClassName("eqmisc")[0])
    };
}

function parseEquipmentStats(eqstats) {
    let stats = {};
    for (row of eqstats.getElementsByClassName("eq-tr")) stats[row.firstElementChild.firstElementChild.title ? row.firstElementChild.firstElementChild.title : row.firstElementChild.textContent.trim()] =
        parseEquipmentStatsSlot(row.lastElementChild)
    return stats;
}

function parseEquipmentStatsSlot(valueNode) {
    if (valueNode.children.length > 0) {
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
        return data;
    }
}

function parseEquipmentFit(eqfits) {
    let fits = {};
    for (row of eqfits.getElementsByTagName("tr")) { // GRR, it was an one liner, unlucky me had to debug it
        let name = row.children[1].textContent.trim();
        if (row.children[2].textContent.trim() === "✘") fits[name] = null;
        else if (row.children[2].textContent.trim() === "✔") fits[name] = "primary";
        else fits[name] = row.children[2].getElementsByClassName("tooltiptext")[0] ? row.children[2].getElementsByClassName("tooltiptext")[0].textContent.trim() : "unspecified";
        if (fits[name] !== null && /^(.+) Only$/.test(fits[name])) fits[name] = fits[name].replace(/^(.+) Only$/, '\"$1\" only'); // XXX Only,
        if (fits[name] === "Secondary gun") fits[name] = "secondary";
    }
    return fits;
}

function parseEquipmentMisc(eqmisc) {
    let datas = eqmisc.getElementsByClassName("eq-td");
    return {
        obtained_from: datas[0].textContent,
        notes: datas[1].textContent,
        animation: datas.length > 2 ? ("https://azurlane.koumakan.jp" + datas[2].firstElementChild.firstElementChild.src) : null
    };
}

// Promise Wrapper for request, I dont trust their own promise support
function fetch(url) {
    return new Promise((resolve, reject) => request({
        url: url,
        headers: HEADERS
    }, (error, res, body) => {
        if (error) reject(error);
        else setTimeout(() => resolve(body), 5500); // Added a delay of 5.5s to prevent wiki server overload
    }));
}
// Downloading images
async function fetchImage(url, localPath) {
    await timeout(5500);
    return new Promise((resolve, reject) => request(url).pipe(fs.createWriteStream(localPath)).on('finish', resolve).on('error', reject));
}

function deleteAll(path) {
    var files = [];
    if (fs.existsSync(path)) {
        files = fs.readdirSync(path);
        files.forEach(function(file, index) {
            var curPath = path + "/" + file;
            if (fs.statSync(curPath).isDirectory()) { // recurse
                deleteAll(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

// recursive string repeating, why not
function repeat(pat, n) {
    return (n > 0) ? pat.concat(repeat(pat, --n)) : "";
}

// Lazy me
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function compare(a, b) {
    if (a < b) {
        return -1;
    } else if (a > b) {
        return 1;
    } else if (a == b) {
        return 0
    } else {
        return "bruh";
    }
}

function getHash(text) {
    var hash = crypto.createHash('sha1');
    hash.setEncoding('hex');
    hash.write(text);
    hash.end();
    return hash.read();
}
