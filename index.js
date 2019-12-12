// This file is for fetching data from wiki

const fs = require('fs');
const request = require('request');
const JSDOM = require('jsdom').JSDOM;
const srcset = require('srcset');

const SKIN_PATH = 'images/skins/${id}/';
const SKIN_NAME_PATH = '${name}/';
const SKIN_FILE_NAME = '${type}.png';

const IMAGE_REPO_URL = 'https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/'

let SHIP_LIST = require("./ship-list.json");
let SHIPS = require("./ships.json");
let EQUIPMENTS = require("./equipments.json");
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
    publish: publish,
    refreshShips: refreshShips,
    refreshImages: refreshImages,
    refreshEquipments: refreshEquipments
}
// Filtering the ship list
function filter(callback) {
    let newShips = {};
    Object.keys(SHIPS).forEach(key => {
        if (callback(SHIPS[key]))
            newShips[key] = SHIPS[key]
    });
    return newShips;
}

let shipCounter = 0;

// Refresh ships
async function refreshShips(online) {
    SHIP_LIST = await fetchShipList();
    fs.writeFileSync('./ship-list.json', JSON.stringify(SHIP_LIST));
    console.log("Updated ship list, current ship count = " + Object.keys(SHIP_LIST).length);
    console.log("Loaded a ship list of " + Object.keys(SHIP_LIST).length + " ships.\nLoaded " + Object.keys(SHIPS).length + " ships from cache.");
    let keys = Object.keys(SHIP_LIST);
    for (key of keys) {
        let ship = await refreshShip(key, online);
        SHIPS_INTERNAL[key] = ship;
        shipCounter++;
        if (shipCounter % 32 == 0) process.stdout.write(" " + shipCounter + " Done\n");
        fs.writeFileSync('./ships.internal.json', JSON.stringify(SHIPS_INTERNAL, null, '\t'));
    }
}

async function refreshImages(overwrite) {
    if (IMAGE_PROGRESS.last_id) {
        console.log("Program Last Stopped at ID \"" + IMAGE_PROGRESS.last_id + "\". Deleting " + SKIN_PATH.replace('${id}', IMAGE_PROGRESS.last_id));
        deleteAll(SKIN_PATH.replace('${id}', IMAGE_PROGRESS.last_id));
        console.log("Done")
    }
    console.log("Refreshing images...");
    SHIPS[key] = clone(ship); // Feels wrong to just assing it, so i copied it
    for (let key in SHIPS_INTERNAL) {
        let ship = SHIPS_INTERNAL[key];
        IMAGE_PROGRESS.last_id = key;
        fs.writeFileSync('./image-progress.json', JSON.stringify(IMAGE_PROGRESS));
        if (ship.rarity !== "Unreleased") {
            let root_folder = SKIN_PATH.replace('${id}', ship.id);
            if (!fs.existsSync(root_folder)) fs.mkdirSync(root_folder);
            process.stdout.write(`${key}`);
            if (!fs.existsSync(root_folder + "thumbnail.png") || overwrite)
                await fetchImage(ship.thumbnail, root_folder + "thumbnail.png");
            process.stdout.write("-");
            for (let skin of ship.skins) {
                let skin_folder = SKIN_NAME_PATH.replace('${name}', skin.name.replace(/[^\w\s]/gi, ''));
                if (!fs.existsSync(root_folder + skin_folder)) fs.mkdirSync(root_folder + skin_folder);
                let image_path = root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image');
                let chibi_path = root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'chibi');
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
        }
        shipCounter++;
        if (shipCounter % 50 == 0) process.stdout.write(` ${shipCounter} Done\n|`);
    }
    console.log("\nDone");
}

function publish() {
    console.log("** WARNING, the program will publish the current ships.internal.json!");
    console.log(`SHIPS_INTERNAL.length = ${SHIPS_INTERNAL.length}\nSHIPS.length = ${SHIPS.length}`);
    SHIPS = {};
    console.log("Starting...")
    for (let key in SHIPS_INTERNAL) {
        process.stdout.write(">");
        SHIPS[key] = clone(SHIPS_INTERNAL[key]); //simple clone!
        if (SHIPS[key].rarity !== "Unreleased") { // images?
            let root_folder = SKIN_PATH.replace('${id}', SHIPS[key].id);
            SHIPS[key].thumbnail = IMAGE_REPO_URL + root_folder + "thumbnail.png";
            process.stdout.write("-");
            let newSkins = [];
            for (let skin of SHIPS[key].skins) {
                process.stdout.write(".");
                let skin_folder = SKIN_NAME_PATH.replace('${name}', skin.name.replace(/[^\w\s]/gi, ''));
                skin.image = IMAGE_REPO_URL + root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'image');
                skin.chibi = IMAGE_REPO_URL + root_folder + skin_folder + SKIN_FILE_NAME.replace('${type}', 'chibi');
                skin.background = IMAGE_REPO_URL + "images/backgrounds/" + skin.background.substring(skin.background.lastIndexOf('/') + 1);
                newSkins.push(skin); //not sure why but this feels safer
            }
            SHIPS[key].skins = newSkins;
            process.stdout.write("|");
        }
    }
    fs.writeFileSync('./ships.json', JSON.stringify(SHIPS, null, '\t'));
    VERSION_INFO.ships["version-number"] += 1;
    VERSION_INFO.ships["last-data-refresh-date"] = Date.now();
    VERSION_INFO.ships["number-of-ships"] = SHIP_LIST.length;
    fs.writeFileSync('./version-info.json', JSON.stringify(VERSION_INFO));
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
        if (!EQUIPMENTS[category]) EQUIPMENTS[category] = {};
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
            EQUIPMENTS[category][name] = await refreshEquipment(href, name, category, online);
            fs.writeFileSync('./equipments.json', JSON.stringify(EQUIPMENTS, null, '\t'));
            console.log(" Done");
        }
        console.log(category + " Done");
    }
    VERSION_INFO.equipments["version-number"] += 1;
    VERSION_INFO.equipments["last-data-refresh-date"] = Date.now();
    VERSION_INFO.equipments["number-of-ships"] = SHIP_LIST.length;
    fs.writeFileSync('./version-info.json', JSON.stringify(VERSION_INFO));
}
// Refresh a ship with specified id
async function refreshShip(id, online) {
    if (!SHIPS_INTERNAL.hasOwnProperty(id) || online) { // Revive Program From Crush/Forced online fetch
        process.stdout.write("+");
        return await fetchShip(SHIP_LIST[id].name, online);
    } else {
        process.stdout.write("-");
        return SHIPS_INTERNAL[id];
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
async function fetchShipList() {
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
    if (online) { // Fetch from the wiki directly
        const body = await fetch("https://azurlane.koumakan.jp/" + encodeURIComponent(name.replace(/ +/g, "_")) + "?useformat=desktop")
        fs.writeFileSync('./web/ships/' + name + '.html', body);
        let ship = parseShip(name, body);
        await timeout(6000);
        ship.skins = await fetchGallery(name, online)
        return ship;
    } else {
        if (!fs.existsSync('./web/ships/' + name + '.html')) return fetchShip(name, true); // Enforcing
        let ship = parseShip(name, fs.readFileSync('./web/ships/' + name + '.html', 'utf8')); // Read from local cache
        ship.skins = await fetchGallery(name, online)
        return ship;
    }
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
    let ship = {
        wikiUrl: "https://azurlane.koumakan.jp/" + name.replace(/ +/g, "_"),
        id: doc.querySelector('div:nth-child(4) > .wikitable:nth-child(1) tr:nth-child(1) > td').textContent.trim(),
        names: {
            en: doc.querySelector('#firstHeading').textContent,
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
        ship.unreleased = true,
            ship.names = {
                en: doc.querySelector('#firstHeading').textContent,
                cn: doc.querySelector('[lang="zh"]') ? doc.querySelector('[lang="zh"]').textContent : null,
                jp: doc.querySelector('[lang="ja"]') ? doc.querySelector('[lang="ja"]').textContent : null,
                kr: doc.querySelector('[lang="ko"]') ? doc.querySelector('[lang="ko"]').textContent : null
            };
        ship.thumbnail = "https://azurlane.koumakan.jp" + images[1].getAttribute("src");
        ship.skins = [{
            name: name,
            image: "https://azurlane.koumakan.jp" + doc.querySelector(".tabbertab .image > img").getAttribute("src"),
            background: null,
            chibi: doc.querySelector("td > div > div:nth-child(2) img") ? "https://azurlane.koumakan.jp" + doc.querySelector("td > div > div:nth-child(2) img").getAttribute("src") : null,
            info: null
        }];
        ship.rarity = "Unreleased";
        return ship;
    }
    const misc_selectors = [2, 3, 4, 5, 6].map(i => doc.querySelector(`.nomobile:nth-child(1) tr:nth-child(${i}) a`));
    ship.thumbnail = "https://azurlane.koumakan.jp" + doc.getElementsByTagName("img")[0].getAttribute("src");
    ship.buildTime = doc.querySelector("tr:nth-child(1) > td:nth-child(2) > a").textContent;
    ship.rarity = doc.querySelector("div:nth-child(3) > .wikitable td img").parentNode.title;
    let stars = doc.querySelector("div:nth-child(1) > div:nth-child(3) > .wikitable:nth-child(1) tr:nth-child(2) > td").textContent.trim();
    ship.stars = {
        stars: stars,
        value: stars.split("★").length - 1
    };
    ship.stats = parseStats(doc);
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

function parseEquipment(href, category, body) {
    const doc = new JSDOM(body).window.document;
    let tabs = doc.getElementsByClassName("eqbox");
    process.stdout.write("tab count = " + tabs.length + " .");
    let tiers = {};
    for (tab of tabs) {
        let t = parseEquipmentInfo(tab);
        process.stdout.write("tier = " + t.tier + " .");
        tiers[t.tier] = t;
    }
    process.stdout.write("");
    return {
        wikiUrl: href,
        category: category,
        names: {
            en: doc.querySelector('[lang="en"]') ? doc.querySelector('[lang="en"]').textContent : null,
            cn: doc.querySelector('[lang="zh"]') ? doc.querySelector('[lang="zh"]').textContent : null,
            jp: doc.querySelector('[lang="ja"]') ? doc.querySelector('[lang="ja"]').textContent : null,
            kr: doc.querySelector('[lang="ko"]') ? doc.querySelector('[lang="ko"]').textContent : null
        },
        tiers: tiers
    };
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
                min: rawData[0].trim(),
                max: rawData[1].trim(),
                per: rawData[2].trim()
            };
        } else if (value !== (rawData = value.replace(/([^×]+) × ([^×]+) → ([^×]+) × ([^×]+)/g, "$1|$2|$3|$4"))) { //X × C → X' × C
            rawData = rawData.split(/\|/);
            data = {
                min: rawData[0].trim(),
                max: rawData[2].trim()
            };
            if (rawData[1].trim() === rawData[3].trim()) data.multiplier = rawData[1].trim(); // Why? coz I do not trust the source
            else {
                data.minMultiplier = rawData[1].trim();
                data.maxMultiplier = rawData[3].trim();
            }
        } else if (value !== (rawData = value.replace(/([^×]+) × ([0-9]+)([^×→]+)/g, "$1|$2|$3"))) { // X × C U
            rawData = rawData.split(/\|/);
            data = {
                multiplier: rawData[0].trim(),
                count: rawData[1].trim(),
                unit: rawData[2].trim()
            };
        } else if (value !== (rawData = value.replace(/([0-9]+) [×x] ([^×→\n]+)/g, "$1|$2"))) { // X × U
            rawData = rawData.split(/\|/);
            data = {
                count: rawData[0].trim(),
                unit: rawData[1].trim()
            };
        } else if (value !== (rawData = value.replace(/([^→]+)→([^→\n]+)/g, "$1|$2"))) { // X → X'
            rawData = rawData.split(/\|/);
            data = {
                min: rawData[0].trim(),
                max: rawData[1].trim()
            };
        } else if (value !== (rawData = value.replace(/([0-9\.]+)([^0-9\.]+)/g, "$1|$2"))) { // X U
            rawData = rawData.split(/\|/);
            data = {
                value: rawData[0].trim(),
                unit: rawData[1].trim()
            };
        } else data = { // ¯\_(ツ)_/¯
            value: value
        }
        return data;
    }
}

function parseEquipmentFit(eqfits) {
    let fits = {};
    for (row of eqfits.getElementsByTagName("tr")) { // GRR, it was an one liner, unlucky me had to debug it
        let name = row.children[1].textContent.trim();
        if (row.children[2].textContent.trim() === "✘") fits[name] = false;
        else if (row.children[2].textContent.trim() === "✔") fits[name] = true;
        else fits[name] = row.children[2].getElementsByClassName("tooltiptext")[0] ? row.children[2].getElementsByClassName("tooltiptext")[0].textContent.trim() : "Unspecified";
    }
    return fits;
}

function parseEquipmentMisc(eqmisc) {
    let datas = eqmisc.getElementsByClassName("eq-td");
    return {
        obtained_from: datas[0].textContent,
        notes: datas[1].textContent,
        animation: datas.length > 2 ? datas[2].firstElementChild.firstElementChild.src : null
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
