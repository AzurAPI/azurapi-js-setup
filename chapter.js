exports.parseChapter = parseChapter;

let parsers = {
    "Introduction": extractText,
    "Unlock Requirements": parseUnlockReq,
    "Clear Reward": parseClearRewards,
    "3-Star Reward": parse3StarRewards,
    "Enemy Level": parseEnermyLevel,
    "Base XP (info)": parseBaseXP,
    "Required Battles": extractLeadingDigits,
    "Boss Kills to Clear": extractLeadingDigits,
    "Star Conditions": parseStarCon,
    "Air Supremacy (info)": parseAirSuprem,
    "Fleet Restrictions": parseFleetRestriction,
    "Stat Restrictions": parseStatsRestriction,
    "Map Drops": parseMapDrops,
    "Additional Notes": extractText,
    "Equipment Blueprint Drops": parseEQBPDrops,
    "Ship Drops": parseShipDrops,
    "Node Map": parseNodeMap
}

function parseChapter(doc, index, names) {
    let chapter = {};
    let boxes = doc.getElementsByClassName("mapbox");
    let hasHardMode = boxes.length > 5;
    chapter['names'] = names[index] || {};
    chapter['names'].en = doc.querySelector(".mw-collapsible th").childNodes[0].textContent.replace(/^Chapter \d: (.+)/, '$1').trim();
    for (let i = 1; i <= 4; i++) {
        chapter[i] = {
            names: {
                cn: names[index + "-" + i] ? names[index + "-" + i].cn : undefined,
                jp: names[index + "-" + i] ? names[index + "-" + i].jp : undefined
            },
            normal: hasHardMode ? parseMap(doc.querySelector("div[title='" + index + "-" + i + "']"), index + "-" + i) : parseMap(boxes[i - 1], index + "-" + i),
            hard: hasHardMode ? parseMap(doc.querySelector("div[title='" + index + "-" + i + " Hard']"), index + "-" + i) : null
        };
        chapter[i].names.en = chapter[i].normal.title;
    };
    return chapter;
}

function parseMap(div, code, names) {
    if (!div) return null;
    let name_list = div.getElementsByTagName("th");
    let data_list = div.getElementsByTagName("td");
    let map = {};
    map.title = div.querySelector(".mapbox-header").textContent;
    map.code = code;
    for (let i = 0; i < name_list.length; i++) {
        let parser = parsers[name_list[i].textContent];
        if (!parser) console.log("\n(" + i + ") Missing Parser: " + name_list[i].textContent)
        map[name_list[i].textContent.replace(/\([^()]+\)/g, '').trim().replace(/\s+/g, '_').toLowerCase()] = parser(data_list[i]);
        if (name_list[i].textContent === "Node Map") break; // 100% the last valid head
    }
    return map;
}

function extractText(div) {
    return div.textContent.trim();
}

function extractLeadingDigits(div) {
    return parseInt(div.textContent.replace(/(^\d+).+/g, '$1'));
}

function parseUnlockReq(div) {
    let value = div.textContent.trim();
    return {
        text: value,
        required_level: parseInt(value.substring(7))
    };
}

function parseClearRewards(div) {
    if (div.childNodes[0].nodeType === 3) return {
        cube: parseInt(div.childNodes[0].textContent.replace(/[^\d]+/g, '')),
        coin: parseInt(div.childNodes[2].textContent.replace(/[^\d]+/g, '')),
        oil: parseInt(div.childNodes[4].textContent.replace(/[^\d]+/g, '')),
    };
    else return {
        cube: parseInt(div.childNodes[1].textContent.replace(/[^\d]+/g, '')),
        coin: parseInt(div.childNodes[3].textContent.replace(/[^\d]+/g, '')),
        oil: parseInt(div.childNodes[5].textContent.replace(/[^\d]+/g, '')),
    };
}

function parse3StarRewards(div) {

}

function parseEnermyLevel(div) {
    let info = {
        mob_level: parseInt(div.childNodes[1].textContent.replace(/[^\d]+/g, '')),
        boss_level: parseInt(div.childNodes[4].textContent.replace(/[^\d]+/g, ''))
    };
    if (div.childNodes.length === 7) info.boss = div.childNodes[5].textContent;
    else info.boss = div.childNodes[4].textContent.replace(/[^()]+\((.+)\)/, '$1');
    return info;
}

function parseBaseXP(div) {
    return {
        small_fleet: parseInt(div.childNodes[1].textContent.replace(/[^\d]+/g, '')),
        medium_fleet: parseInt(div.childNodes[3].textContent.replace(/[^\d]+/g, '')),
        large_fleet: parseInt(div.childNodes[5].textContent.replace(/[^\d]+/g, '')),
        boss_fleet: parseInt(div.childNodes[7].textContent.replace(/[^\d]+/g, '')),
    };
}

function parseStarCon(div) {
    return [div.childNodes[0].textContent, div.childNodes[2].textContent, div.childNodes[4].textContent];
}

function parseAirSuprem(div) {
    return {
        suggested: parseInt(div.childNodes[1].textContent.replace(/[^\d]+/g, '')),
        actual: parseInt(div.childNodes[4].textContent.replace(/[^\d]+/g, ''))
    };
}

function parseFleetRestriction(div) {

}

function parseStatsRestriction(div) {

}

function parseMapDrops(div) {

}

function parseEQBPDrops(div) {
    let names = div.querySelectorAll(".azlicon-container .tooltiptext");
    let tiers = div.querySelectorAll(".azlicon-container .azlicon-note");
    let eqs = [];
    for (let i = 0; i < names.length; i++) eqs[i] = {
        name: names[i].textContent,
        tier: tiers[i].textContent
    }
    return eqs;
}

function parseShipDrops(div) {
    let ships = [];
    for (let container of div.getElementsByClassName("azlicon-container")) {
        let ship = {}
        ship.name = container.getElementsByClassName("tooltiptext")[0].textContent;
        if (container.getElementsByClassName("azlicon-note")[0]) ship.note = container.getElementsByClassName("azlicon-note")[0].textContent
        ships.push(ship);
    }
    return ships;
}

const BGCOLOR_DICT = {
    "rgb(0, 68, 0)": "Land",
    "rgb(170, 221, 221)": "Sea"
}

function parseNodeMap(div) {
    let nodemap = {};
    nodemap.preview = "https://azurlane.koumakan.jp" + galleryThumbnailUrlToActualUrl(div.getElementsByTagName("img")[0].src);
    let nodes = [];
    let map = [];
    let rows = div.querySelectorAll(".nodemap tr");
    let width, height = 0;
    for (let row of rows) {
        let cols = row.getElementsByTagName("td");
        if (cols.length === 0) continue;
        let map_cols = [];
        if (!width) width = cols.length;
        for (let i = 0; i < cols.length; i++) {
            if (cols[i].children.length !== 0) map_cols[i] = cols[i].children[0].title
            else map_cols[i] = BGCOLOR_DICT[cols[i].style.backgroundColor];
            if (map_cols[i] !== "Sea") nodes.push({
                x: i,
                y: height,
                node: map_cols[i]
            });
        }
        map.push(map_cols);
        height++;
    }
    nodemap.width = width;
    nodemap.height = height;
    nodemap.map = map;
    nodemap.nodes = nodes;
    return nodemap;
}

function galleryThumbnailUrlToActualUrl(tdir) {
    return tdir.replace(/\/w\/images\/thumb\/(.\/..)\/([^\/]+)\/.+/g, '/w/images/$1/$2');
}
