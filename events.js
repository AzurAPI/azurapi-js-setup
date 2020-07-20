const fs = require("fs");
const moment = require('moment');
const JSDOM = require('jsdom').JSDOM;
const nodefetch = require('node-fetch');
const parseInfo = require('infobox-parser');

const HEADERS = {
    'user-agent': "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36",
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3',
    'cookie': 'VEE=wikitext'
};

const SUBTITLE_REGEX = /(?:\s)*<br ?\/?>''(.*)(?:'')?/;
const LINK_REGEX2 = /\[\[([^|\n]+)\]\](.*)/g;
const LINK_REGEX = /\[\[([^|]+)\|([^|\]]+)\]\](.*)\n(.+)\n(.+)\n(.+)\n(.+)/g;
const LINK_REPLC = '[[$2$3]]\n$4\n$5\n$6\n$7\n| $1';

async function refreshEvents() {
    let infobox = await title("Events", './web/events.info');
    infobox = infobox
        .replace(LINK_REGEX2, '[[$1|$1]]$2')
        .replace(LINK_REGEX, LINK_REPLC)
        .replace('! style="width:21%" class="unsortable" |Notes', '! style="width:21%" class="unsortable" |Notes\n! style="width:21%" class="unsortable" |Link')
        .replace(`! style="width:25%"|Event Name<br />''EN Name''`, `! style="width:25%"|name`);
    fs.writeFileSync("./web/events.format.info", infobox);
    const info = parseInfo(infobox);
    // console.log(info.tables[0]);
    let eventNames = info.tables[0].map(eventInfo => {
        let title = eventInfo['link'] || eventInfo['name'];
        if (SUBTITLE_REGEX.test(title)) title = title.replace(SUBTITLE_REGEX, '');
        return title;
    });

    const EVENTS = [];
    for (let eventName of eventNames) {
        let eventbox = await title(eventName, './web/events/' + eventName + ".info");
        if (eventbox.trim().length <= 0) continue;
        EVENTS.push(parseEventBox(eventName, eventbox));
    }
    fs.writeFileSync("./events.json", JSON.stringify(EVENTS, null, '\t'));
}

const NEW_SHIP_REGEX = /{{ShipDisplay\|(?<rarity>\d+)\|(?<name>[^{}|\n]+)\|(?<type>[^{}|\n]+)\|(?<idk>[^{}|\n]*)\|(?:(?:'*(?<time>[\d:]+)'*\|'*(?<chance>[\d.%]+)'*)|(?:'*Construction\s*(?:\((?<chance2>[\d.%]+)\))?'*(?:<br>)?\|?(?<time2>[\d:]+)))}}/g;
const NEW_SHIP_SKIN_REGEX = /{{ShipDisplay\|(?<rarity>\d+)\|(?<name>[^{}|\n]+)\|(?<type>[^{}|\n]+)\|(?<series>[^{}|\n]*)\|(?<skin_name>[^{}|\n]*)\|{{(?<currency>[^{}[\]\n]+)}}\s?(?<price>\d+)(?:(?:<br>\(not discounted\))?\|*(?<L2D>L2D)?}}|\|\d+\|(?:BG)?)\|(?<bgID>\d+)?\|(?<idk>[^|{}]*)}}/g;
const NEW_SHIP_OTHER_REGEX = /{{ShipDisplay\|(?<rarity>\d+)\|(?<name>[^{}|\n]+)\|(?<type>[^{}|\n]+)\|(?<idk>[^{}|\n]*)\|'*\[\[(?<rewardName>[^[\]|}{]+)\|(?<rewardType>[^[\]|}{]+)\]\]'*}}/g;

function parseEventBox(eventName, info) {
    let event = {
        name: eventName,
        new_ships_construction: [],
        new_ships_skins: [],
        new_ships_others: [],
    };
    let match = null;
    while (match = NEW_SHIP_REGEX.exec(info)) {
        match.groups.chance = match.groups.chance || match.groups.chance2;
        match.groups.time = match.groups.time || match.groups.time2;
        event.new_ships_construction.push({
            name: match.groups.name,
            rarity: SHIP_RARITY[match.groups.rarity],
            type: match.groups.type,
            construction_time: match.groups.time,
            construction_chance: match.groups.chance,
        });
    }
    while (match = NEW_SHIP_SKIN_REGEX.exec(info)) {
        event.new_ships_skins.push({
            name: match.groups.name,
            rarity: SHIP_RARITY[match.groups.rarity],
            type: match.groups.type,
            series: match.groups.series,
            skin_name: match.groups.skin_name,
            currency: match.groups.currency,
            price: match.groups.price,
            L2D: !(!match.groups.L2D),
            bgID: match.groups.bgID
        });
        if (match.groups.idk && match.groups.idk !== "y") {
            console.log(eventName, match.groups.name);
        }
    }
    while (match = NEW_SHIP_OTHER_REGEX.exec(info)) {
        event.new_ships_construction.push({
            name: match.groups.name,
            rarity: SHIP_RARITY[match.groups.rarity],
            type: match.groups.type,
            from: match.groups.rewardType
        });
    }
    return event;
}

function title(title, localPath) {
    return fetch("https://azurlane.koumakan.jp/w/index.php?title=" + encodeURIComponent(title) + "&action=raw", localPath);
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

refreshEvents();

const SHIP_RARITY = {
    '1': 'Unreleased',
    '2': 'Normal',
    '3': 'Rare',
    '4': 'Elite',
    '5': 'Super Rare'
}
