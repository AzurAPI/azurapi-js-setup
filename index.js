// This file is for fetching data from wiki
const crypto = require('crypto');
const fs = require('fs');
const request = require('request');
const JSDOM = require('jsdom').JSDOM;

const chapter = require('./chapter.js');
const memory = require('./memory.js');

const SKIN_PATH = 'images/skins/${id}/';
const SKIN_NAME_PATH = '${name}/';
const SKIN_FILE_NAME = '${type}.png';

const IMAGE_REPO_URL = 'https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/'

let SHIP_LIST = require("./ship-list.json");
let SHIPS = require("./ships.json");
let EQUIPMENTS = require("./equipments.internal.json");
let EQUIPMENTS_PUBLIC = require("./equipments.json");
let CHAPTERS = require("./chapters.json");
let MEMORIES = require("./memories.json");
let SHIPS_INTERNAL = require("./ships.internal.json");
let VERSION_INFO = require("./version-info.json");
let IMAGE_PROGRESS = require("./image-progress.json");
let PATH_SIZE = require("./path-sizes.json");

const HEADERS = {
    'user-agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'cookie': 'VEE=wikitext'
};

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
    publishShips: publishShips,
    publishEQ: publishEQ,
    refreshShips: refreshShips,
    refreshEquipments: refreshEquipments,
    refreshShipImages: refreshShipImages,
    refreshEQImages: refreshEQImages,
    refreshChapter: refreshChapter,
    refreshMemory: refreshMemory,
    removeShip: removeShip
}

function removeShip(name) {
    for (let key in SHIPS_INTERNAL)
        if (SHIPS_INTERNAL[key].names.en === name) delete SHIPS_INTERNAL[key];
    fs.writeFileSync('./ships.internal.json', JSON.stringify(SHIPS_INTERNAL, null, '\t'));
}

function removeShips(tester) {
    for (let key in SHIPS_INTERNAL)
        if (tester(SHIPS_INTERNAL[key])) delete SHIPS_INTERNAL[key];
    fs.writeFileSync('./ships.internal.json', JSON.stringify(SHIPS_INTERNAL, null, '\t'));
}

// Refresh ships
async function refreshShips(online) {
    SHIP_LIST = await fetchShipList(online);
    let shipCounter = 0;
    fs.writeFileSync('./ship-list.json', JSON.stringify(SHIP_LIST));
    console.log("Updated ship list, current ship count = " + Object.keys(SHIP_LIST).length);
    console.log("Loaded a ship list of " + Object.keys(SHIP_LIST).length + " ships.\nLoaded " + Object.keys(SHIPS_INTERNAL).length + " ships from cache.");
    let keys = Object.keys(SHIP_LIST);
    for (key of keys) {
        if (key.length === 4 && key.startsWith("3")) continue; // Retrofited ship ids
        let ship = await refreshShip(key, online);
        shipCounter++;
        process.stdout.write(" =>" + shipCounter + "/" + keys.length + "\n")
        if (!ship) continue;
        SHIPS_INTERNAL[key] = ship;
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        fs.writeFileSync('./ships.internal.json', JSON.stringify(SHIPS_INTERNAL, null, '\t'));
        if (used > 1000) await timeout(1000);
    }
    console.log("\nDone");
}

async function refreshShipImages() {
    if (IMAGE_PROGRESS.inProgress) {
        console.log("Program Last Stopped at \"" + IMAGE_PROGRESS.inProgress + "\"");
        if (fs.existsSync(IMAGE_PROGRESS.inProgress)) fs.unlinkSync(IMAGE_PROGRESS.inProgress);
        console.log("Done")
    }
    console.log("Refreshing images...");
    let shipCounter = 0;
    console.log("Images from ships...");
    for (let key in SHIPS_INTERNAL) {
        let ship = SHIPS_INTERNAL[key];
        let root_folder = SKIN_PATH.replace('${id}', ship.id);
        if (!fs.existsSync(root_folder)) fs.mkdirSync(root_folder);
        process.stdout.write(`${key}`);
        await fetchImage(ship.thumbnail, root_folder + "thumbnail.png");
        process.stdout.write("-");
        for (let skin of ship.skins) {
            let skin_folder = SKIN_NAME_PATH.replace('${name}', skin.name.replace(/[^\w\s]/gi, '').replace(/ +/g, "_"));
            if (!fs.existsSync(root_folder + skin_folder)) fs.mkdirSync(root_folder + skin_folder);
            let image_path = root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image').replace(/ +/g, "_");
            let chibi_path = root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'chibi').replace(/ +/g, "_");
            if (skin.image !== null) await fetchImage(skin.image, image_path);
            process.stdout.write(".");
            if (skin.chibi !== null) await fetchImage(skin.chibi, chibi_path);
            process.stdout.write("|");
            if (skin.background !== null) await fetchImage(skin.background, "./images/backgrounds/" + skin.background.substring(skin.background.lastIndexOf('/') + 1));
        }
        if (ship.unreleased) continue;
        process.stdout.write("G");
        for (let item of ship.gallery) {
            if (item.url !== null) {
                let path = "./images/gallery/" + item.url.substring(item.url.lastIndexOf('/') + 1);
                await fetchImage(item.url, path);
            }
        }
        process.stdout.write("S");
        let getSkillIcon = async (skill) => {
            if (!skill) return;
            let skillName = skill.names.en.toLowerCase();
            if (skillName.includes('(retrofit)')) skillName = skillName.replace('(retrofit)', '') + ".kai";
            skillName = skillName.trim().replace(/\s+/g, '_');
            let path = "./images/skills/" + key + "/" + skillName + ".png";
            if (skill.icon !== null)
                await fetchImage(skill.icon, path);
            return;
        };
        if (!fs.existsSync("./images/skills/" + key)) fs.mkdirSync("./images/skills/" + key);
        for (let skill of ship.skills) {
            await getSkillIcon(skill);
            process.stdout.write(".");
        }
        shipCounter++;
        if (shipCounter % 50 == 0) process.stdout.write(` ${shipCounter} Done\n|`);
    }
    console.log("\nDone");
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
            skin.image = IMAGE_REPO_URL + root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image').replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, '');
            skin.chibi = IMAGE_REPO_URL + root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'chibi').replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, '');
            skin.background = skin.background ? IMAGE_REPO_URL + "images/backgrounds/" + skin.background.substring(skin.background.lastIndexOf('/') + 1) : null;
            skin.info.live2dModel = skin.info.live2dModel === "Yes" // true if and only if "Yes"
            newSkins.push(skin); //not sure why but this feels safer
        }
        SHIPS[key].skins = newSkins;
        process.stdout.write("|");
        if (SHIPS[key].unreleased) continue;
        let newGallery = [];
        for (let item of SHIPS[key].gallery) {
            process.stdout.write(".");
            item.url = IMAGE_REPO_URL + "images/gallery/" + item.url.substring(item.url.lastIndexOf('/') + 1).replace(/ +/g, "_").replace(/[^\d\w_.-]+/g, '');
            newGallery.push(item);
        }
        SHIPS[key].gallery = newGallery;
        let publishSkill = async (skill) => {
            if (!skill) return {};
            let path = IMAGE_REPO_URL + "images/skills/" + skill.names.en.replace(/\s+/g, '_').toLowerCase() + ".png";
            skill.icon = path;
            return skill;
        };
        for (let i = 0; i < SHIPS[key].skills[i].length; i++)
            SHIPS[key].skills[i] = publishSkill(SHIPS[key].skills[i]);
        process.stdout.write("|");
    }
    let ships_value = JSON.stringify(SHIPS);
    fs.writeFileSync('./ships.json', ships_value);
    fs.writeFileSync('./ships.formatted.json', JSON.stringify(SHIPS, null, 4));
    VERSION_INFO.ships.hash = getHash(ships_value);
    VERSION_INFO.ships["version-number"] += 1;
    VERSION_INFO.ships["last-data-refresh-date"] = Date.now();
    VERSION_INFO.ships["number-of-ships"] = SHIP_LIST.length;
    fs.writeFileSync('./version-info.json', JSON.stringify(VERSION_INFO));
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
    if (!online && Object.keys(SHIP_LIST).length !== 0) return SHIP_LIST;
    console.log("Getting new ship list...");
    let LIST = {};
    let data;
    if (!fs.existsSync('./web/ships.index.html') || online) fs.writeFileSync('./web/ships.index.html', data = await fetch("https://azurlane.koumakan.jp/List_of_Ships"));
    else data = fs.readFileSync('./web/ships.index.html', 'utf8');
    new JSDOM(data).window.document.querySelectorAll("#mw-content-text .mw-parser-output table tbody tr").forEach(table_ship => {
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
        data = await fetch("https://azurlane.koumakan.jp/" + encodeURIComponent(name) + "?useformat=desktop")
        fs.writeFileSync('./web/ships/' + name + '.html', data);
    } else {
        if (!fs.existsSync('./web/ships/' + name + '.html')) return fetchShip(name, true); // Enforcing
        data = fs.readFileSync('./web/ships/' + name + '.html', 'utf8'); // Read from local cache
    }
    process.stdout.write(".");
    let ship = parseShip(name, data);
    process.stdout.write("|");
    let gallery = await fetchGallery(name, online);
    ship.skins = gallery.skins;
    ship.gallery = gallery.gallery;
    process.stdout.write("|");
    return ship;
}

async function fetchGallery(name, online) {
    if (online) {
        const body = await fetch("https://azurlane.koumakan.jp/" + encodeURIComponent(name) + "/Gallery");
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
    //console.log(ship.names.en); // If any parsing error arised
    if (doc.querySelectorAll("#mw-content-text .mw-parser-output > div").length < 2) { // Unreleased
        let images = doc.getElementsByTagName("img");
        ship.unreleased = true;
        ship.thumbnail = "https://azurlane.koumakan.jp" + images[1].getAttribute("src");
        ship.skins = [{
            name: name,
            image: "https://azurlane.koumakan.jp" + doc.getElementsByTagName("img")[0].src,
            background: "https://azurlane.koumakan.jp/w/images/3/3a/MainDayBG.png",
            chibi: doc.querySelector("td > div > div:nth-child(2) img") ? "https://azurlane.koumakan.jp" + doc.querySelector("td > div > div:nth-child(2) img").getAttribute("src") : null,
            info: {
                obtainedFrom: "Default",
                live2DModel: "No"
            }
        }];
        ship.rarity = "Unreleased";
        return ship;
    }
    const misc_selectors = [2, 3, 4, 5, 6].map(i => doc.querySelector(`.nomobile:nth-child(1) tr:nth-child(${i}) a`));
    process.stdout.write(ship.names.en);
    ship.thumbnail = "https://azurlane.koumakan.jp" + doc.getElementsByTagName("img")[0].getAttribute("src");
    ship.rarity = doc.querySelector("div:nth-child(3) > .wikitable td img").parentNode.title;
    let stars = doc.querySelector("div:nth-child(1) > div:nth-child(3) > .wikitable:nth-child(1) tr:nth-child(2) > td").textContent.trim();
    ship.stars = {
        stars: stars,
        value: stars.split("★").length - 1
    };
    ship.stats = parseStats(doc);
    ship.slots = {};
    for (let i = 0; i < 3; i++) ship.slots[i + 1] = parseShipEQSlot(doc.querySelector(".nomobile > div > .wikitable tr:nth-child(" + (i + 3) + ")"));
    let enhanceValues = doc.querySelector(".nomobile:nth-child(4) td:nth-child(1)").childNodes;
    if (enhanceValues.length < 7) ship.enhanceValue = doc.querySelector(".nomobile:nth-child(4) td:nth-child(1)").textContent.trim();
    else ship.enhanceValue = {
        firepower: parseInt(enhanceValues[0].textContent.trim()),
        torpedo: parseInt(enhanceValues[2].textContent.trim()),
        aviation: parseInt(enhanceValues[4].textContent.trim()),
        reload: parseInt(enhanceValues[6].textContent.trim())
    };
    let scrapValues = doc.querySelector(".nomobile:nth-child(4) td:nth-child(2)").childNodes;
    if (scrapValues.length < 5) ship.scrapValue = doc.querySelector(".nomobile:nth-child(4) td:nth-child(2)").textContent.trim();
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
    }
    ship.construction = parseShipConstruction(doc.querySelector("#Construction tbody"));
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
        voice: misc_selectors[4] ? {
            name: misc_selectors[4].parentElement.lastElementChild.textContent,
            url: misc_selectors[4].parentElement.lastElementChild.href
        } : null
    };
    return ship;
}

function parseShipLimits(skill_table) {
    let rows = skill_table.getElementsByTagName("tr");
    let limits = [];
    for (let i = 1; i < 4; i++) limits.push(parseLimitBreak(rows[i]));
    return limits;
}

function parseLimitBreak(row) {
    let buffs = [];
    let rows = row.children[1].children;
    for (let i = 0; i < rows.length; i++) buffs.push(rows[i].textContent.trim())
    return buffs;
}

function parseSkills(table) {
    let rows = table.getElementsByTagName("tr");
    let skills = [];
    let skill_count = 3;
    let skill;
    for (let i = 1; skill = parseSkill(rows[i], rows[i + 2]); i += 4) skills.push(skill);
    return skills;
}

function parseDevelopmentLevels(table) {
    let rows = table.getElementsByTagName("tr");
    let levels = {};
    for (let i = 1; i < rows.length; i++) {
        let buff_rows = rows[i].lastElementChild.children;
        let buffs = [];
        for (let j = 0; j < buff_rows.length; j++) buffs.push(parseDevelopmentLevelBuff(buff_rows[j]));
        levels[rows[i].firstElementChild.textContent.trim()] = buffs;
    }
    return levels;
}

function parseDevelopmentLevelBuff(row) {
    if (row.childElementCount === 0) return row.textContent.trim(); // pure text
    else {
        let buffs = {};
        for (let i = 0; i < row.childNodes.length;) {
            let image, text;
            if (row.childNodes[i].tagName === "DIV") {
                image = row.childNodes[i].childNodes[0];
                text = row.childNodes[i].childNodes[1];
            } else {
                image = row.childNodes[i];
                text = row.childNodes[i + 1];
            }
            buffs[camelize(image.title.replace(/[^\w ]/g, ''))] = text.textContent.replace(',', '').trim();
            i += 2;
        }
        return buffs;
    }
}

function parseSkill(title, body) {
    if (!title || !body) return null;
    return {
        icon: title.getElementsByTagName("a")[0] ? title.getElementsByTagName("a")[0].href : null,
        names: {
            en: title.firstElementChild.firstElementChild.lastElementChild.childNodes[0].textContent,
            cn: title.querySelector("[lang='zh']") ? title.querySelector("[lang='zh']").textContent : null,
            jp: title.querySelector("[lang='ja']") ? title.querySelector("[lang='ja']").textContent : null
        },
        description: body.textContent.trim(),
        color: title.firstElementChild.getAttribute("style").replace(/^.+background-color:([^;]+).+$/, '$1').toLowerCase() // cant use style.backgroundColor, jsdom's issue
    };
}

function parseFleetTech(table_p) {
    let fleet_tech = {};
    let cells = table_p.getElementsByTagName("td");
    fleet_tech.statsBonus = {
        collection: parseStatsBonus(cells[0]),
        maxLevel: parseStatsBonus(cells[1])
    };
    fleet_tech.techPoints = {
        collection: parseTechPoints(cells[2]),
        maxLimitBreak: parseTechPoints(cells[4]),
        maxLevel: parseTechPoints(cells[5]),
        total: parseTechPoints(cells[3])
    };
    return fleet_tech;
}

function parseStatsBonus(cell) {
    if (!cell || cell.childElementCount === 0) return null;
    let i = 0;
    let statsBonus = {};
    statsBonus.applicable = [];
    for (; cell.children[i].tagName === "A"; i++) statsBonus.applicable.push(cell.children[i].title.replace(/\(\w+\)/, '').trim());
    statsBonus.stat = cell.children[i].title;
    statsBonus.bonus = cell.lastChild.textContent.trim();
    return statsBonus;
}

function parseTechPoints(cell) {
    if (!cell || cell.childElementCount === 0) return 0;
    return parseInt(cell.lastChild.textContent.trim());
}

function parseRetrofit(tbody) {
    let projects = {};
    let rows = tbody.children;
    for (let i = 1; i < rows.length; i++) {
        let cols = rows[i].children;
        let index = cols[0].textContent.trim();
        let split = cols[1].textContent.replace(/([^(]+)\((.+)\)/, '$1|$2').split("|");
        let split2 = cols[6].textContent.trim().split(" ");
        projects[index] = {
            name: split[0].trim(),
            grade: split[1] ? split[1].trim() : undefined,
            attributes: deepToString(cols[2]).trim().replace(/\s{2,}/g, ' ').split(/ ?and ?|, ?/g),
            materials: deepToString(cols[3]).trim().replace(/\s{2,}/g, ' ').split(/ ?and ?|, ?/g),
            coins: parseInt(cols[4].textContent),
            level: parseInt(cols[5].textContent),
            levelBreakLevel: parseInt(split2[0]),
            levelBreakStars: split2[1],
            recurrence: parseInt(cols[7].textContent),
            require: cols[8].textContent.trim().split(/, ?/g)
        };
        if (projects[index].require[0] === "") projects[index].require = [];
    }
    return projects;
}

function parseShipEQSlot(slot) {
    let eqslot = {
        type: slot.children[2].textContent.trim()
    };
    if (slot.children[1].firstElementChild) {
        eqslot.minEfficiency = parseInt(slot.children[1].children[0].textContent.replace('%', ''));
        eqslot.maxEfficiency = parseInt(slot.children[1].children[1].textContent.replace('%', ''));
        if (slot.children[1].children[2]) eqslot.kaiEfficiency = parseInt(slot.children[1].children[2].textContent.replace('%', ''));
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
                stats[camelize(type.replace(/[^\w ]/g, ''))] = range;
            } else stats[camelize(type.replace(/[^\w ]/g, ''))] = bodies[j].textContent.trim();
        }
        allStats[camelize(title.replace(/[^\w ]/g, ''))] = stats;
    });
    return allStats;
}
// Parse ship's gallery page html body, need a name
function parseGallery(name, body) {
    let skins = [];
    let gallery = [];
    let doc = new JSDOM(body).window.document;
    Array.from(doc.getElementsByClassName("tabbertab")).forEach(tab => {
        let info = {};
        tab.querySelectorAll(".shipskin-table tr").forEach(row => info[camelize(row.getElementsByTagName("th")[0].textContent.toLowerCase().trim())] = row.getElementsByTagName("td")[0].textContent.trim());
        skins.push({
            name: tab.title,
            image: tab.querySelector(".shipskin-image img") ? "https://azurlane.koumakan.jp" + tab.querySelector(".shipskin-image img").src : null,
            background: (tab.querySelector(".res img") ? "https://azurlane.koumakan.jp" + tab.querySelector(".res img").getAttribute("src") : null),
            chibi: tab.querySelector(".shipskin-chibi img") ? "https://azurlane.koumakan.jp" + tab.querySelector(".shipskin-chibi img").getAttribute("src") : null,
            info: info
        });
    });
    Array.from(doc.getElementsByClassName("gallerybox")).forEach(box => {
        gallery.push({
            description: box.getElementsByClassName("gallerytext")[0].textContent.trim(),
            url: galleryThumbnailUrlToActualUrl("https://azurlane.koumakan.jp" + box.getElementsByTagName("img")[0].src)
        });
    });
    return {
        skins: skins,
        gallery: gallery
    };
}

function parseShipConstruction(construction_tbody) {
    let construction_time = construction_tbody.children[1].firstElementChild.textContent.trim();
    let available = {};
    let construction_types = ["light", "heavy", "aviation", "limited", "exchange"];
    for (let i = 0; i < 5; i++) {
        let elem = construction_tbody.children[3].children[i];
        let value = elem.textContent.trim();
        if (elem.children.length > 0) value = elem.firstElementChild.firstElementChild.textContent.trim();
        else value = value === '✓';
        available[construction_types[i]] = value;
    }
    return {
        constructionTime: construction_time,
        availableIn: available
    };
}

// Its only a prediction
function galleryThumbnailUrlToActualUrl(tdir) {
    return tdir.replace(/\/w\/images\/thumb\/(.\/..)\/([^\/]+)\/.+/g, '/w/images/$1/$2');
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
    let chapters = doc.querySelectorAll(".mw-parser-output>ul>li");
    for (let i = 0; i < 12; i++) {
        let cn = parseChapterNames(chapters[i]);
        let jp = parseChapterNames(chapters[i + 12]);
        names[i + 1] = {
            cn: cn.name,
            jp: jp.name
        };
        for (let j = 1; j <= 4; j++) names[(i + 1) + "-" + j] = {
            cn: cn.maps[j - 1],
            jp: jp.maps[j - 1]
        };
    }
    return names;
}

function parseChapterNames(li) {
    let names = [];
    let maps = li.lastElementChild.children;
    for (let i = 0; i < 4; i++) {
        names[i] = maps[i].childNodes[1].textContent.replace(/^:/, '').replace(/\(.+\)/, '').trim();
    }
    return {
        name: li.childNodes[1].textContent.replace(/^:/, '').replace(/\(.+\)/, '').trim(),
        maps: names
    }
}
// Promise Wrapper for request, I dont trust their own promise support
function fetch(url) {
    return new Promise((resolve, reject) => request({
        url: url,
        headers: HEADERS
    }, (error, res, body) => {
        if (error) reject(error);
        else resolve(body);
        //else setTimeout(() => resolve(body), 5500); // Added a delay of 5.5s to prevent wiki server overload
    }));
}

function head(url) {
    return new Promise((resolve, reject) => {
        request.head(url, function(err, res, body) {
            resolve({
                err: err,
                res: res,
                body: body
            });
        });
    });
}

function fetchImage(url, localPath) {
    //await timeout(5500);
    if (!url) return new Promise((resolve, reject) => resolve());
    if (url.includes("thumb")) url = galleryThumbnailUrlToActualUrl(url);
    return new Promise((resolve, reject) => {
        if (fs.existsSync(localPath)) { // Check local file
            verifyFile(url, localPath).then(valid => {
                if (valid) {
                    process.stdout.write("-");
                    resolve();
                } else {
                    fs.unlinkSync(localPath);
                    console.log("Redownloading " + localPath);
                    fetchImage(url, localPath).then(resolve);
                }
            });
        } else {
            IMAGE_PROGRESS.inProgress = localPath;
            fs.writeFileSync('./image-progress.json', JSON.stringify(IMAGE_PROGRESS));
            request(url).pipe(fs.createWriteStream(localPath)).on('close', () => {
                IMAGE_PROGRESS.inProgress = null;
                fs.writeFileSync('./image-progress.json', JSON.stringify(IMAGE_PROGRESS));
                resolve();
            }).on('error', reject);
        }
    });
}

async function verifyFile(url, localPath) {
    let correctSize;
    if (PATH_SIZE[url]) correctSize = PATH_SIZE[url];
    else {
        PATH_SIZE[url] = correctSize = parseInt((await head(url)).res.headers['content-length']);
        fs.writeFileSync('./path-sizes.json', JSON.stringify(PATH_SIZE));
    }
    if (fs.statSync(localPath)["size"] === correctSize) return true;
    else {
        console.log("File Corrupted: " + localPath);
        return false;
    }
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

function camelize(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, i) => {
        if (+match === 0) return "";
        return i == 0 ? match.toLowerCase() : match.toUpperCase();
    });
}

function unwrap(el) {
    var parent = el.parentNode;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
}

function deepToString(parent) {
    if (parent.nodeType === 3) return parent.textContent;
    if (parent.tagName === "IMG" && parent.title) return `"${parent.title}"`;
    if (parent.tagName === "IMG") return `"${parent.alt.replace(/(Icon)?.png/, '')}"`;
    if (parent.childNodes.length > 0) {
        let text = "";
        for (node of parent.childNodes) text += deepToString(node);
        return text;
    } else {
        if (parent.title) return parent.title;
        return parent.textContent;
    }
}
