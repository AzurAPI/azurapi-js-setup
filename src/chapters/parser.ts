import {
  AirSupremacy,
  BaseExp,
  Chapter,
  EnemyLevel,
  MapPart,
  Reward,
  StarConditions,
} from "./chapter";
import { camelize } from "../utils";

const parsers: {
  [s: string]: (element: Element) => any;
} = {
  Introduction: extractText,
  "Unlock Requirements": parseUnlockReq,
  "Clear Rewards": parseClearRewards,
  "3-Star Rewards": parse3StarRewards,
  "Enemy Level": parseEnermyLevel,
  "Base XP (info)": parseBaseXP,
  "Required Battles": extractLeadingDigits,
  "Boss Kills to Clear": extractLeadingDigits,
  "Star Conditions": parseStarCon,
  "Air Supremacy (info)": parseAirSuprem,
  "Fleet Restrictions": parseFleetRestriction,
  "HARD Fleet Restrictions": parseFleetRestriction,
  "Stat Restrictions": parseStatsRestriction,
  "HARD Stat Restrictions": parseStatsRestriction,
  "Map Drops": parseMapDrops,
  "Additional Notes": extractText,
  "Blueprint Drops": parseEQBPDrops,
  "Ship Drops": parseShipDrops,
  "Node Map": parseNodeMap,
};
const betterNames = {
  checkAndReplace: function (text: string) {
    if (this[text]) return this[text];
    else return text;
  },
  hARDFleetRestrictions: "fleetRestrictions",
  hARDStatRestrictions: "statRestrictions",
  "3-StarRewards": "threeStarRewards",
};

export function parseChapter(doc: Document, index: number, names: any) {
  let chapter = new Chapter();
  let boxes = doc.getElementsByClassName("mapbox");
  let hasHardMode = boxes.length > 5;
  chapter.id = String(index);
  chapter.names = names[index] || {};
  chapter.image = doc.querySelector(".mw-parser-output table a.image img")?.getAttribute("src");
  for (let i = 1; i <= 4; i++) {
    // @ts-ignore
    chapter[String(i)] = {
      names: {
        en: names[index + "-" + i] ? names[index + "-" + i].en : null,
        cn: names[index + "-" + i] ? names[index + "-" + i].cn : null,
        jp: names[index + "-" + i] ? names[index + "-" + i].jp : null,
      },
      normal: hasHardMode
        ? parseMap(doc.querySelector("div[title='" + index + "-" + i + "']"), index + "-" + i)
        : parseMap(boxes[i - 1], index + "-" + i),
      hard: hasHardMode
        ? parseMap(doc.querySelector("div[title='" + index + "-" + i + " Hard']"), index + "-" + i)
        : null,
    };
  }
  return chapter;
}

function parseMap(div: Element, code: string): MapPart {
  if (!div) return null;
  let name_list = div.getElementsByTagName("th");
  let data_list = div.getElementsByTagName("td");
  // @ts-ignore
  let map: MapPart = {
    title: div.querySelector("caption").textContent,
    code: code,
  };
  for (let i = 0; i < name_list.length; i++) {
    let parser = parsers[name_list[i].textContent];
    if (!parser) console.log("\n(" + i + ") Missing Parser: " + name_list[i].textContent);
    let key = betterNames.checkAndReplace(camelize(name_list[i].textContent.replace(/\(.+\)/, "")));
    // @ts-ignore
    map[key] = parser(data_list[i]);
    if (name_list[i].textContent === "Node Map") break; // 100% the last valid head
  }
  return map;
}

function extractText(div: Element) {
  return div.textContent.trim();
}

function extractLeadingDigits(div: Element) {
  return parseInt(div.textContent.replace(/(^\d+).+/g, "$1"));
}

function parseUnlockReq(div: Element) {
  let value = div.textContent.trim();
  return {
    text: value,
    requiredLevel: parseInt(value.substring(7)),
  };
}

function parseClearRewards(div: Element) {
  if (div.childNodes[4].textContent === ", ")
    return {
      cube: parseInt(div.childNodes[0].textContent.replace(/[^\d]+/g, "")),
      coin: parseInt(div.childNodes[2].textContent.replace(/[^\d]+/g, "")),
      ship: (<HTMLElement>div.childNodes[5]).title,
    };
  else
    return {
      cube: parseInt(div.childNodes[0].textContent.replace(/[^\d]+/g, "")),
      coin: parseInt(div.childNodes[2].textContent.replace(/[^\d]+/g, "")),
      oil: parseInt(div.childNodes[4].textContent.replace(/[^\d]+/g, "")),
    };
}

const ITEM_NAME_WITH_AMOUNT_REGEX = /^(?:,\s+)?(\d+)x ?(.+)$/g;

function parse3StarRewards(div: Element): Reward[] {
  let reward: Reward = { item: "" };
  let rewards: Reward[] = [];
  for (let i = 0; i < div.childNodes.length; i++) {
    if (div.childNodes[i].nodeType === 3) {
      // text node
      let text = div.childNodes[i].textContent;
      if (text.includes(",")) {
        rewards.push(reward);
        reward = { item: "" };
        text = text.replace(",", "");
      }
      if (text.trim().length === 0) continue;
      if (isNaN(Number(text.replace(/[,\s]+/g, "")))) {
        if (ITEM_NAME_WITH_AMOUNT_REGEX.test(text)) {
          let args = text.replace(ITEM_NAME_WITH_AMOUNT_REGEX, "$1|$2").split("|");
          reward.count = parseInt(args[0]);
          reward.item = args[1].trim();
        } else reward.item = text.trim();
      } else reward.count = parseInt(text.replace(/[^\d]+/g, ""));
    } else reward.item = (<HTMLElement>div.childNodes[i]).title;
  }
  if (reward.item.length > 0) rewards.push(reward);
  return rewards;
}

function parseEnermyLevel(div: Element): EnemyLevel {
  let mobLevel = div.childNodes[1].textContent.substr(1).trim();
  if (mobLevel.includes(" ")) mobLevel = mobLevel.substr(0, mobLevel.indexOf(" "));
  let info: EnemyLevel = {
    mobLevel: parseInt(mobLevel),
    bossLevel: parseInt(div.childNodes[4].textContent.replace(/[^\d]+/g, "")),
  };
  if (div.childNodes.length === 7) info.boss = div.childNodes[5].textContent;
  else if (div.childNodes.length > 7)
    info.boss = [...div.children]
      .filter((n) => (<HTMLElement>n).tagName === "A")
      .map((e) => (<HTMLElement>e).title);
  else info.boss = div.childNodes[4].textContent.replace(/[^()]+\((.+)\)/, "$1");
  return info;
}

function parseBaseXP(div: Element): BaseExp {
  return {
    smallFleet: parseInt(div.childNodes[1].textContent.replace(/[^\d]+/g, "")),
    mediumFleet: parseInt(div.childNodes[3].textContent.replace(/[^\d]+/g, "")),
    largeFleet: parseInt(div.childNodes[5].textContent.replace(/[^\d]+/g, "")),
    bossFleet: parseInt(div.childNodes[7].textContent.replace(/[^\d]+/g, "")),
  };
}

function parseStarCon(div: Element): StarConditions {
  return [
    div.childNodes[0].textContent,
    div.childNodes[2].textContent,
    div.childNodes[4].textContent,
  ];
}

function parseAirSuprem(div: Element): AirSupremacy {
  return {
    actual: parseInt(div.childNodes[1].textContent.replace(/[^\d]+/g, "")),
    superiority: parseInt(div.childNodes[6].textContent.replace(/[^\d]+/g, "")),
    supremacy: parseInt(div.childNodes[8].textContent.replace(/[^\d]+/g, "")),
  };
}

function parseFleetRestriction(div: Element) {
  let fleet_1_res: any = {};
  let i = 0;
  while (div.childNodes[i] && div.childNodes[i + 1]) {
    let ce = <HTMLElement>div.childNodes[i];
    let ne = <HTMLElement>div.childNodes[i + 1];
    if (ce.tagName === "HR" || ne.tagName === "HR") break;
    if (ce.tagName === "B") {
      i++;
      continue;
    }
    fleet_1_res[camelize(ne.title.replace(/\(.+\)/g, "").trim())] = parseInt(
      ce.textContent.replace(/[^\d]/g, "")
    );
    i += 2;
  }
  i += 3;
  let fleet_2_res: any = {};
  while (div.childNodes[i] && div.childNodes[i + 1]) {
    let ce = <HTMLElement>div.childNodes[i];
    let ne = <HTMLElement>div.childNodes[i + 1];
    if (ce.tagName === "B") {
      i++;
      continue;
    }
    fleet_2_res[camelize(ne.title.replace(/\(.+\)/g, "").trim())] = parseInt(
      ce.textContent.replace(/[^\d]/g, "")
    );
    i += 2;
  }
  return {
    fleet1: fleet_1_res,
    fleet2: fleet_2_res,
  };
}

function parseStatsRestriction(div: Element) {
  let restrictions: any = {};
  div.childNodes.forEach((n) => {
    if (n.textContent === ": Not available") return;
    if (n.nodeType === 3) {
      let restriction = n.textContent.replace(/, $/, "").replace(":", "").trim();
      let data = restriction
        .replace(/(?:Total )?(.+)(?: >|(?: total value)? greater than) (\d+)/, "$1|$2")
        .split("|");
      data[0] = data[0].replace(/(total value|stat)/gi, "").trim();
      restrictions[camelize(data[0])] = parseInt(data[1]);
    }
  });
  return restrictions;
}

function parseMapDrops(div: Element): string[] {
  let rewards: string[] = [];
  div.childNodes.forEach((n) => {
    if (n.nodeType === 3) rewards.push(n.textContent.replace(",", "").trim());
  });
  return rewards;
}

function parseEQBPDrops(div: Element) {
  let names = div.querySelectorAll(".alicon .alittxt");
  let tiers = div.querySelectorAll(".alicon .alintr");
  let eqs = [];
  for (let i = 0; i < names.length; i++)
    eqs[i] = {
      name: names[i].textContent,
      tier: tiers[i].textContent,
    };
  return eqs;
}

function parseShipDrops(div: Element) {
  let ships = [];
  for (let container of div.getElementsByClassName("alicon")) {
    let ship: any = {};
    ship.name = container.getElementsByClassName("alittxt")[0].textContent;
    if (container.getElementsByClassName("alintr")[0]) {
      ship.note = container.getElementsByClassName("alintr")[0].textContent;
      ships.push(ship);
    } else ships.push(ship.name);
  }
  return ships;
}

const BGCOLOR_DICT: { [s: string]: string } = {
  "rgb(0, 68, 0)": "Land",
  "rgb(170, 221, 221)": "Sea",
};

function parseNodeMap(div: Element) {
  let map = [];
  let nodes = [];
  let rows = div.querySelectorAll(".nodemap tr");
  let width,
    height = 0;
  for (let row of rows) {
    let cols = row.getElementsByTagName("td");
    if (cols.length === 0) continue;
    let map_cols = [];
    if (!width) width = cols.length;
    for (let i = 0; i < cols.length; i++) {
      if (cols[i].children.length !== 0) map_cols[i] = (<HTMLElement>cols[i].children[0]).title;
      else map_cols[i] = BGCOLOR_DICT[cols[i].style.backgroundColor];
      if (map_cols[i] !== "Sea")
        nodes.push({
          x: i,
          y: height,
          node: map_cols[i],
        });
    }
    map.push(map_cols);
    height++;
  }
  return { width, height, map, nodes };
}
