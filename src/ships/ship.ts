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

export type ShipExists = {
    en: boolean;
    cn: boolean;
    jp: boolean;
    kr: boolean;
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
    _gid: number;
    _sid: number[];
    _code: number;
    id: ShipID;         // ID of ship, provided by the wiki (not in game id)
    names: ShipNames;
    exists: ShipExists;
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
    max: number;
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