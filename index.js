// This file is for fetching data from wiki

const fs = require('fs');
const request = require('request');
const JSDOM = require('jsdom').JSDOM;
const srcset = require('srcset');

let SHIP_LIST = require("./ship-list.json");
let SHIPS = require("./ships.json");
let VERSION_INFO = require("./version-info.json");

const HEADERS = {
    'user-agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'cookie': 'VEE=wikitext'
};

module.exports = {
    refreshData: refreshData
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
let lineCount = 0;
// Refresh everything
async function refreshData(online) {
    SHIP_LIST = await fetchShipList();
    fs.writeFileSync('./ship-list.json', JSON.stringify(SHIP_LIST));
    console.log("Updated ship list, current ship count = " + Object.keys(SHIP_LIST).length);
    console.log("Loaded a ship list of " + Object.keys(SHIP_LIST).length + " ships.\nLoaded " + Object.keys(SHIPS).length + " ships from cache.");
    let keys = Object.keys(SHIP_LIST);
    for (let i = 0; i < keys.length; i++) {
        let key = keys[i];
        let ship = await refresh(key, online);
        SHIPS[key] = ship;
        process.stdout.write("+");
        shipCounter++;
        if (shipCounter > 32) {
            shipCounter = 0;
            lineCount++;
            process.stdout.write(" " + lineCount * 32 + " Done\n");
        }
        fs.writeFileSync('./ships.json', JSON.stringify(SHIPS));
    };
    VERSION_INFO["version-number"] += 1;
    VERSION_INFO["last-data-refresh-date"] = Date.now();
    VERSION_INFO["number-of-ships"] = SHIP_LIST.length;
    fs.writeFileSync('./version-info.json', JSON.stringify(VERSION_INFO));
}
// Refresh a ship with specified id
async function refresh(id, online) {
    if (!SHIPS.hasOwnProperty(id) || online) { // Revive Program From Crush/Forced online fetch
        return await fetchShip(SHIP_LIST[id].name, online);
    } else {
        return SHIPS[id];
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
        fs.writeFileSync('./web/' + name + '.html', body);
        let ship = parseShip(name, body);
        ship.skins = await fetchGallery(name, online);
        return ship;
    } else {
        if (!fs.existsSync('./web/' + name + '.html')) return fetchShip(name, true); // Enforcing
        let ship = parseShip(name, fs.readFileSync('./web/' + name + '.html', 'utf8')); // Read from local cache
        ship.skins = await fetchGallery(name, online);
        return ship;
    }
}

async function fetchGallery(name, online) {
    if (online) {
        const body = await fetch("https://azurlane.koumakan.jp/" + name.replace(/ +/g, "_") + "/Gallery");
        fs.writeFileSync('./web.gallery/' + name + '.html', body);
        return parseGallery(name, body);
    } else {
        if (!fs.existsSync('./web.gallery/' + name + '.html')) return fetchGallery(name, true); // Enforcing
        return parseGallery(name, fs.readFileSync('./web.gallery/' + name + '.html', 'utf8'));
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
    ship.rarity = doc.querySelector("div:nth-child(3) > .wikitable td img").parentNode.getAttribute("title");
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
        let title = tab.parentNode.parentNode.getAttribute("title");
        let names = tab.querySelectorAll("th"),
            bodies = tab.querySelectorAll("td");
        for (let j = 0; j < names.length; j++) {
            let type = names[j].firstChild.getAttribute("title");
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
        const parsedSet = srcset.parse(tab.querySelector(".ship-skin-image img").getAttribute("srcset"));
        const maxDensity = Math.max(...parsedSet.map(set => set.density));
        skins.push({
            name: tab.getAttribute("title"),
            image: "https://azurlane.koumakan.jp" + parsedSet.find(set => set.density == maxDensity).url,
            background: "https://azurlane.koumakan.jp" + tab.querySelector(".res img").getAttribute("src"),
            chibi: tab.querySelector(".ship-skin-chibi img") ? "https://azurlane.koumakan.jp" + tab.querySelector(".ship-skin-chibi img").getAttribute("src") : null,
            info: info
        });
    });
    return skins;
}
// Promise Wrapper for request, I dont trust their own promise support
function fetch(url) {
    return new Promise((resolve, reject) => request({
        url: url,
        headers: HEADERS
    }, async (error, res, body) => {
        if (error) reject(error);
        else resolve(body);
    }));
}
