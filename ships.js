const fs = require("fs");
const JSDOM = require('jsdom').JSDOM;
const nodefetch = require('node-fetch');
const parseInfo = require("infobox-parser");
let SHIP_LIST = require("./ship-list.json");

const HEADERS = {
    'user-agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'cookie': 'VEE=wikitext'
};

async function refreshShips() {
    SHIP_LIST = await fetchShipList();
    let SHIPS = {};
    for (let ship of SHIP_LIST) {
        SHIPS[ship.id] = await parseShip(ship.name);
        await sleep(500);
        fs.writeFileSync("newships.json", JSON.stringify(SHIPS, null, '\t'));
    }
}

refreshShips();

async function parseShip(name) {
    let infobox = await fetch("https://azurlane.koumakan.jp/w/index.php?title=" + name + "&action=raw", './web/ships.source/' + name + '.info');
    const info = parseInfo(infobox).general;
    return {
        id: info.id,
        names: {
            en: name,
            cn: info.cnName,
            jp: info.jpName,
            kr: info.krName,
        },
        rarity: info.rarity,
        nationality: info.nationality,
        constructionTime: info.constructionTime,
        type: info.type,
        class: info.class,
        luck: info.luck,
        armor: info.armor,
        speed: info.speed,
        stats: {},
        misc: {
            artist: info.artist,
            web: info.artistLink ? {
                url: info.artistLink.substring(1, info.artistLink.indexOf(" ")),
                name: info.artistLink.substring(info.artistLink.indexOf(" "), info.artistLink.length - 1)
            } : undefined,
            pixiv: info.artistPixiv ? {
                url: info.artistPixiv.substring(1, info.artistPixiv.indexOf(" ")),
                name: info.artistPixiv.substring(info.artistPixiv.indexOf(" "), info.artistPixiv.length - 1)
            } : undefined,
            va: info.va ? (typeof (info.va) === "object" ? "object" : info.va.substring(info.va.indexOf(":"))) : undefined
        }
    };
}

function fetch(url, localPath) {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(localPath)) resolve(fs.readFileSync(localPath, 'utf8'));
        else nodefetch(url, {
            headers: HEADERS,
        }).then(res => res.text()).then(text => {
            fs.writeFileSync(localPath, text);
            resolve(text);
        }).catch(reject);
    });
}
async function fetchShipList() {
    console.log("Getting new ship list...");
    let LIST = [];
    new JSDOM(await fetch("https://azurlane.koumakan.jp/List_of_Ships", './web/ships.index.html')).window.document.querySelectorAll("#mw-content-text .mw-parser-output table tbody tr").forEach(table_ship => {
        let columns = table_ship.childNodes;
        if (columns[0].tagName === "TD") LIST.push({
            id: columns[0].textContent,
            name: columns[1].textContent,
            rarity: columns[2].textContent,
            type: columns[3].textContent,
            nationality: columns[4].textContent
        });
    });
    return LIST;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
