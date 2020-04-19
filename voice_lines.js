const fs = require('fs');
const nodefetch = require('node-fetch');
const JSDOM = require('jsdom').JSDOM;
const AUDIO_REPO_URL = 'https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/'
let SHIPS = require("./ships.internal.json");
let VOICE_LINES = require("./voice_lines.json");

const HEADERS = {
    'user-agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'cookie': 'VEE=wikitext'
};
exports.refreshVoiceLines = async () => {
    for (let key in SHIPS) {
        let ship = SHIPS[key];
        console.log("Voice Lines of ('" + key + "') " + ship.names.code);
        let text = await fetch(ship.wikiUrl + "/Quotes", "./web/ships.quotes/" + ship.names.en + ".html");
        VOICE_LINES[key] = parseVoiceLines(new JSDOM(text).window.document, ship);
        fs.writeFileSync("voice_lines.json", JSON.stringify(VOICE_LINES, null, '\t'));
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        if (used > 1000) await timeout(1000);
    }
    console.log("Done!");
}

function parseVoiceLines(doc, ship) {
    let tabs = doc.getElementsByClassName("tabbertab");
    let languages = {};
    for (let tab of tabs) {
        console.log("\tLanguage = " + tab.title);
        let skins = [];
        let i = 0;
        while (i < tab.children.length) {
            if (tab.children[i].tagName === "H3" && tab.children[i + 1] && tab.children[i + 1].tagName === "TABLE") {
                skins.push({
                    name: tab.children[i].textContent.trim(),
                    lines: parseTableLines(tab.children[i + 1])
                });
                i++;
            }
            i++;
        }
        languages[tab.title] = skins;
    }
    return compressLanguages(languages, ship);
}

function compressLanguages(languages, ship) {
    let skins = {};
    for (let server of Object.values(languages)) {
        for (let skin of server) {
            let skinName = findElSkinName(ship.skins, skin.name);
            if (!skins[skinName]) skins[skinName] = {};

            for (let line of skin.lines) {
                let eventCamel = camelize(line.event);
                if (!skins[skinName][eventCamel]) skins[skinName][eventCamel] = {
                    event: line.event
                };
                skins[skinName][eventCamel][line.language] = line.transcription;
                if (skins[skinName][eventCamel].audio && line.audio && skins[skinName][eventCamel].audio !== line.audio) {
                    skins[skinName][eventCamel].audioAlt = skins[skinName][eventCamel].audioAlt || [];
                    skins[skinName][eventCamel].audioAlt.push(line.audio);
                    if (fs.existsSync("./web/ships.quotes/" + ship.names.en + ".html")) fs.unlinkSync("./web/ships.quotes/" + ship.names.en + ".html");
                } else skins[skinName][eventCamel].audio = skins[skinName][eventCamel].audio || line.audio;
            }
        }
    }
    let newSkins = {};
    for (let key of Object.keys(skins)) {
        newSkins[key] = Object.values(skins[key]);
    }
    return newSkins;
}

function parseTableLines(table) {
    table = table.firstElementChild;
    let lines = [];
    for (let i = 1; i < table.children.length; i++) {
        let row = table.children[i];
        let notes = row.lastElementChild.textContent.trim();
        lines.push({
            event: row.children[0].textContent.trim(),
            audio: row.children[1].firstElementChild ? row.children[1].firstElementChild.href : undefined,
            language: row.children[2].lang,
            transcription: row.children[2].textContent.trim(),
            notes: notes ? notes : undefined
        });
    }
    return lines;
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

function findElSkinName(skins, name) {
    name = name.trim();
    if (name.includes("Remodel") || name.includes("改")) return "Retrofit";
    for (let skin of skins) {
        if (skin.name.trim().includes(name) || name.includes(skin.name.trim())) return skin.name;
        if (skin.info.enClient && (skin.info.enClient.trim().includes(name) || name.includes(skin.info.enClient.trim()))) return skin.name;
        if (skin.info.cnClient && (skin.info.cnClient.trim().includes(name) || name.includes(skin.info.cnClient.trim()))) return skin.name;
        if (skin.info.jpClient && (skin.info.jpClient.trim().includes(name) || name.includes(skin.info.jpClient.trim()))) return skin.name;
    }
    return name;
}

function camelize(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, (match, i) => {
        if (+match === 0) return "";
        return i == 0 ? match.toLowerCase() : match.toUpperCase();
    });
}

function timeout(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
