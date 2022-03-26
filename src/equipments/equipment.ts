// equipment.ts
/**
 * Equipment types
 * @packageDocumentation
 */

export type Url = string;

export interface Fits {
  [hullType: string]: string;
}

export type Stat =
  | {
      type: "more_stats";
      stats: Stat[];
    }
  | {
      type: "range";
      firing: number;
      shell: number;
      formatted: string;
    }
  | {
      type: "min_max_per";
      min: string;
      max: string;
      per: string;
      formatted: string;
    }
  | {
      type: "min_max_multiplier";
      min: string;
      max: string;
      multiplier: string;
      formatted: string;
    }
  | {
      type: "min_max_min_max_multiplier";
      min: string;
      max: string;
      minMultiplier: string;
      maxMultiplier: string;
      formatted: string;
    }
  | {
      type: "multiplier_count_unit";
      multiplier: string;
      count: string;
      unit: string;
      formatted: string;
    }
  | {
      type: "count_unit";
      count: string;
      unit: string;
      formatted: string;
    }
  | {
      type: "min_mid_max";
      min: string;
      mid: string;
      max: string;
      formatted: string;
    }
  | {
      type: "min_max";
      min: string;
      max: string;
      formatted: string;
    }
  | {
      type: "value_unit";
      value: string;
      unit: string;
      formatted: string;
    }
  | {
      // ¯\_(ツ)_/¯
      type: "value";
      formatted: string;
    };

export interface Tier {
  tier: number;
  rarity: string;
  stars: {
    stars: string;
    value: number;
  };
  stats: {
    [key: string]: Stat;
  };
}

export type Misc = {
  blueprints: string;
  madeFrom: string[];
  usedFor: string[];
  obtainedFrom: string;
  notes: string;
  animation: Url;
};

export class Equipment {
  id: string;
  wikiUrl: Url;
  category: string;
  names: {
    en: string;
    cn: string;
    jp: string;
    kr: string;
  };
  type: {
    focus: string;
    name: string;
  };
  nationality: string;
  image: Url;
  fits: Fits;
  misc: Misc;
  tiers: Tier[];
}
