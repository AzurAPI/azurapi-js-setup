export class Chapter {
  id: string;
  image: string;
  "1": Map;
  "2": Map;
  "3": Map;
  "4": Map;
  names: {
    en: string;
    cn: string;
    jp: string;
  };
}

export type Map = {
  id: string;
  names: {
    en: string;
    cn: string;
    jp: string;
  };
  normal: MapPart;
  hard?: MapPart;
};

export type MapPart = {
  title: string;
  code: string;
  introduction: string;
};

export type Reward = { count?: number; item: string };
export type EnemyLevel = {
  mobLevel: number;
  bossLevel: number;
  boss?: string | string[];
};
export type BaseExp = {
  smallFleet: number;
  mediumFleet: number;
  largeFleet: number;
  bossFleet: number;
};
export type StarConditions = [string, string, string];
export type AirSupremacy = {
  actual: number;
  superiority: number;
  supremacy: number;
};
