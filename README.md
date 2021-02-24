# azurapi-js-setup

Setup for [azurapi-js](https://www.npmjs.com/package/@azurapi/azurapi)

## Function

- Updates `ships.json`, `ship-list.json`, `equipments.json` with fresh data

## Usage

### To update your own copy

- Fetch `https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/version-info.json`. `application/json`
- Check respective version numbers from `ships`/`equipments`.
    - Example: `ships['version-number']`
- If it is greater than the version number on your local copy. You need to update from either
    - `https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/ships.json`
    - `https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/equipments.json`
- Overwrite your local copy, and reload it into your program
  ### Cloning
- Clone this repository
- Update your local copy with

```javascript
const azurlane = require("./index.js");
azurlane.refreshShips(true);
azurlane.refreshEquipments(true);
azurlane.refreshChapter(true);
azurlane.refreshShipImages();
azurlane.refreshEQImages();
azurlane.publishShips();
azurlane.publishEQ();
```

- Bewared that this update program will use up a lot of bandwidth and processing power
- To rely on local cache, remove all the `true` parameters

### JSON Types

> When a single ship's info is extracted, it is of `Ship` type

#### Typescript Definition for `ships.json`

```typescript
export type Url = string;
export type Stat = 'health' | 'armor' | 'reload' | 'luck' | 'firepower' | 'torpedo' | 'evasion' | 'speed' | 'antiair'
        | 'aviation' | 'oilConsumption' | 'accuracy' | 'antisubmarineWarfare' | 'oxygen' | 'ammunition' | 'huntingRange';
export const isStat = (str: string) => ['health', 'armor', 'reload', 'luck', 'firepower', 'torpedo', 'evasion', 'speed', 'antiair'
  , 'aviation', 'oilConsumption', 'accuracy', 'antisubmarineWarfare', 'oxygen', 'ammunition', 'huntingRange'].includes(str);
export type ShipID = string;
export type Rarity = 'Normal' | 'Rare' | 'Epic' | 'Super Rare' | 'Ultra Rare' | 'Priority' | 'Decisive' | 'Unreleased';
export type LimitBreak = string[];

export type ShipNames = {            // Ship's name
  code: string;
  en: string;
  cn: string;
  jp: string;
  kr: string;
};

export type ShipStats = {
  baseStats: Stats;
  level100: Stats;
  level120: Stats;
  level100Retrofit?: Stats;
  level120Retrofit?: Stats;
};

export type FleetTech = {                            // fleet tech stuff
  statsBonus: {
    collection?: Bonus;
    maxLevel?: Bonus;
  };
  techPoints: {
    collection: number;
    maxLimitBreak: number;
    maxLevel: number;
    total: number;
  };
};

export class Ship {
  wikiUrl: Url;    // An valid, full url to its wiki page
  id: ShipID;         // ID of ship, provided by the wiki (not in game id)
  names: ShipNames;
  thumbnail: Url;
  hexagon: [number, number, number, number, number, number];
  class: string;      // Ship's class
  nationality: string;// Ship's nationality
  hullType: string;   // Ship type (Destroyer etc)
  rarity: Rarity;     // Super Rare, hopefully
  stars: {
    stars: string;
    value: number;
  };
  stats: ShipStats;
  slots: [Slot, Slot, Slot];
  enhanceValue: { firepower: number, torpedo: number, aviation: number, reload: number };
  scrapValue: {
    coin: number;
    oil: number;
    medal: number;
  };
  skills: Skill[];
  skins: Skin[];
  gallery: GalleryItem[];
  limitBreaks: LimitBreak[];      // first layer = breaks, second layer = bonus
  devLevels: DevLevel[]
  fleetTech: FleetTech;
  unreleased?: boolean;
  retrofit: boolean;                              // if the ship is retrofittable
  retrofitId: string;                             // the id after retrofit
  retrofitHullType: string;                       // if the ship changes type
  retrofitProjects: { [id: string]: RetrofitProject };
  construction: {
    constructionTime: string;
    availableIn: {
      light: boolean;
      heavy: boolean;
      aviation: boolean;
      limited: boolean;
      exchange: boolean;
    };
  };
  obtainedFrom: {
    obtainedFrom?: string;       // source, etc "Available in Medal Exchange for \"Medal\" 80."
    fromMaps: string[];    // map ids, etc "1-1" "10-2"
  };
  misc: {
    artist?: Artist;
    web?: Artist;
    pixiv?: Artist;
    twitter?: Artist;
    voice?: Artist;
  };
}

export type Bonus = {                  // on collection
  applicable: string[];  // applicable ship types (i.e. Destroyer)
  stat: Stat;                 // name of stat to enhance
  bonus: string;              // human-readable version of how much to enhance
};


export type Stats = {
  [k in Stat]?: string;
};

export type Slot = {
  type: string;
  kaiEfficiency?: number;
  minEfficiency: number;
  maxEfficiency: number;
}

export type Skill = {
  icon: Url;
  names: {
    en: string;
    cn: string;
    jp: string;
  };
  description: string;
  color: string;
}

export type SkinInfo = {
  enClient?: string;
  cnClient?: string;
  jpClient?: string;
  cost?: number;
  obtainedFrom: string;
  live2dModel: boolean;
};

export interface Skin {
  name: string;
  chibi: Url;
  image: Url;
  cn?: Url; // censored
  bg?: Url; // with background
  nobg?: Url; // without background (only used internally)
  background: Url; // scenery background
  info: SkinInfo;
}

export type GalleryItem = {
  description: string;    // self-explanatory
  url: Url;            // the image url
}

export type Artist = {
  name: string;
  url: Url;
}

export type ProjectID = string;
export type RetrofitProject = {
  id: ProjectID;
  grade: string;
  attributes: string[];
  materials: string[];
  coins: number;
  level: number;
  levelBreakLevel: number;
  levelBreakStars: string;
  recurrence: number;
  require: ProjectID[];
}
export type DevLevel = {
  level: string;
  buffs: string[];
}
```

#### `voice_lines.json`

```typescript
class Ship {
    Default: Array<Line>;
    // [Skin Name]: Array<Line>; // note: the skin name is directly from the wiki page
    // ...
}

class Line {
    event: string;  // the event (touch etc) name
    en?: string;    // the line in english
    zh?: string;    // the line in chinese
    jp?: string;    // the line in japanese
    audio?: string; // the line's audio url, file type = "audio/ogg"
}
```

### Join our discord!

<a href="https://discord.gg/aAEdys8">
    <img src="https://discordapp.com/api/v6/guilds/648206344729526272/widget.png?style=banner2" alt="Discord server" />
</a>

## Credits

Data is obtained from the official [Azur Lane Wiki](https://azurlane.koumakan.jp/)
