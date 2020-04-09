# azurapi-js-setup

Setup for [azurapi-js](https://www.npmjs.com/package/@azurapi/azurapi)

## Function

-   Updates `ships.json`, `ship-list.json`, `equipments.json` with fresh data

## Usage

### To update your own copy

-   Fetch `https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/version-info.json`. `application/json`
-   Check respective version numbers from `ships`/`equipments`.
    -   Example: `ships['version-number']`
-   If it is greater than the version number on your local copy. You need to update from either
    -   `https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/ships.json`
    -   `https://raw.githubusercontent.com/AzurAPI/azurapi-js-setup/master/equipments.json`
-   Overwrite your local copy, and reload it into your program
    ### Cloning
-   Clone this repository
-   Update your local copy with

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

-   Bewared that this update program will use up a lot of bandwidth and processing power
-   To rely on local cache, remove all the `true` parameters

### JSON Types

> When a single ship's info is extracted, it is of `Ship` type

```typescript
class Ship {
    wikiUrl: string;    // An valid, full url to its wiki page
    id: string;         // ID of ship, provided by the wiki (not in game id)
    names: {            // Ship's name
        code: string;
        en: string;
        cn?: string;
        jp?: string;
        kr?: string;
    };
    class: string;      // Ship's class
    nationality: string;// Ship's nationality
    hullType: string;   // Ship type (Destroyer etc)
    thumbnail: string;  // A thumbnail ideal for small places
    rarity: string;     // Super Rare, hopefully
    stars: {
        stars: string;      // i.e. ★★☆☆☆
        value: number;      // i.e. 2
    };
    stats: {
        baseStats: Stats;
        level100: Stats;
        level120: Stats;
        level100Retrofit?: Stats;
        level120Retrofit?: Stats;
    };
    slots: {
        1: Slot;
        2: Slot;
        3: Slot;
    };
    enhanceValue: object;// mapped by [key = "stat type", value = "enhance value"]
    scrapValue: {
        coin: number;
        oil: number;
        medal: number;
    };
    skills: Array<Skill>;
    limitBreaks: Array<Array<string>>;      // first layer = breaks, second layer = bonus
    fleetTech: {                            // fleet tech stuff
        statsBonus: {
            collection: {                   // on collection
                applicable: Array<string>;  // applicable ship types (i.e. Destroyer)
                stat: string;               // name of stat to enhance
                bonus: string;              // human-readable version of how much to enhance
            };
            maxLevel: {                     // on reaching max-level
                applicable: Array<string>;
                stat: string;
                bonus: string;
            };
        };
        techPoints: {
            collection: number;
            maxLimitBreak: number;
            maxLevel: number;
            total: number;
        };
    };
    construction: {
        constructionTime: string;
        availableIn: {
            light: false;
            heavy: false;
            aviation: false;
            limited: false;
            exchange: false;
        };
    };
    misc: {
        artist: string;
        web?: Artist;
        pixiv?: Artist;
        twitter?: Artist;
        voice?: Artist;
    };
}

// Recommended to be treated as an object, ship stats vary from ship to ship
// Most string fields here may be numbers
class Stats {
    health: string;
    armor: string;
    reload: string;
    luck: string;
    firepower: string;
    torpedo: string;
    evasion: string;
    speed: string;
    antiair: string;
    aviation: string;
    oilConsumption: string;
    accuracy: string;
    antisubmarineWarfare: string;
    // For submarines
    oxygen?: string;
    ammunition?: string;
    huntingRange?: Array<Array<string>>; // hunting range represented by 2d array
}

class Slot {
    type: string;
    minEfficiency: number;  // in percentage
    maxEfficiency: number;  // in percentage
}

class Skill {
    icon: string;       // url
    names: {
        en?: string;
        cn?: string;
        jp?: string;
        kr?: string;
    };
    description: string;
    color: string;      // descriptive color name (not hex code)
}

class Artist {
    name: string;
    url: string;
}
```

### Join our discord!

<a href="https://discord.gg/aAEdys8">
    <img src="https://discordapp.com/api/v6/guilds/648206344729526272/widget.png?style=banner2" alt="Discord server" />
</a>

## Credits

Data is obtained from the official [Azur Lane Wiki](https://azurlane.koumakan.jp/)
