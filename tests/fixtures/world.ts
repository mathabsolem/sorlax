/**
 * Kleine Testwelt: 8 x 8 Kacheln, dazu ein Minimalsatz an Inhalten.
 * Nur fuer Tests, gehoert bewusst nicht nach content/.
 */
import { createNewGame } from '../../src/core/state';
import { encodeTile } from '../../src/core/tiles';
import type {
  ContentDb,
  Difficulty,
  EnemyDef,
  Facing,
  GameState,
  ItemDef,
  LampDef,
  MapDef,
  MapEntityDef,
  Resistances,
  TileCoord,
  TriggerDef,
  WeaponDef,
} from '../../src/core/types';

/** Sechzig Schwellen wie im Vertrag, aber klein genug zum Nachrechnen. */
export const TEST_XP_THRESHOLDS: number[] = Array.from(
  { length: 60 },
  (_unused, index) => (10 * (index + 1) * (index + 2)) / 2
);

export function noResistances(): Resistances {
  return { physical: 0, fire: 0, poison: 0, ice: 0, shock: 0, void: 0 };
}

const W = 1;
const F = 0;

/**
 * Grundriss. Rand ringsum Wand, innen zwei Pfeilergruppen.
 *
 *   y=0  # # # # # # # #
 *   y=1  # . . . . . . #
 *   y=2  # . # # . # . #
 *   y=3  # . . . . . . #
 *   y=4  # . # . # # . #
 *   y=5  # . . . . . . #
 *   y=6  # . . . . . . #
 *   y=7  # # # # # # # #
 */
const WALLS: number[] = [
  W, W, W, W, W, W, W, W,
  W, F, F, F, F, F, F, W,
  W, F, W, W, F, W, F, W,
  W, F, F, F, F, F, F, W,
  W, F, W, F, W, W, F, W,
  W, F, F, F, F, F, F, W,
  W, F, F, F, F, F, F, W,
  W, W, W, W, W, W, W, W,
];

function frames(): EnemyDef['frames'] {
  return { idle: ['idle0'], attack: ['attack0'], pain: ['pain0'], death: ['death0'] };
}

export const WEAPONS: Record<string, WeaponDef> = {
  fists: {
    id: 'fists',
    name: 'Fists',
    dmgMin: 2,
    dmgMax: 4,
    damageType: 'physical',
    critChance: 0,
    optimalRange: 1,
    maxRange: 1,
    ammoType: null,
    ammoPerShot: 0,
    sprite: 'fists',
    sound: 'punch',
  },
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    dmgMin: 3,
    dmgMax: 6,
    damageType: 'physical',
    critChance: 0.1,
    optimalRange: 3,
    maxRange: 6,
    ammoType: 'bullets',
    ammoPerShot: 1,
    sprite: 'pistol',
    sound: 'shot',
  },
  launcher: {
    id: 'launcher',
    name: 'Launcher',
    dmgMin: 5,
    dmgMax: 8,
    damageType: 'fire',
    critChance: 0,
    optimalRange: 4,
    maxRange: 6,
    ammoType: 'rockets',
    ammoPerShot: 1,
    splash: { radius: 2, baseDamage: 20 },
    sprite: 'launcher',
    sound: 'boom',
  },
};

function enemy(overrides: Partial<EnemyDef> & { id: string }): EnemyDef {
  return {
    archetype: 'test',
    element: 'physical',
    name: overrides.id,
    baseHealth: 10,
    baseArmor: 0,
    baseAccuracy: 5,
    baseEvasion: 0,
    resistances: noResistances(),
    speed: 1,
    behavior: 'melee',
    aggroRange: 5,
    preferredRange: 1,
    weaponId: 'fists',
    baseXp: 10,
    spriteWidth: 0.8,
    frames: frames(),
    ...overrides,
  };
}

export const ENEMIES: Record<string, EnemyDef> = {
  grunt: enemy({ id: 'grunt' }),
  runner: enemy({ id: 'runner', behavior: 'charger', speed: 2, aggroRange: 8, baseXp: 15 }),
  crawler: enemy({ id: 'crawler', speed: 0.5, aggroRange: 8, baseXp: 5 }),
  sniper: enemy({
    id: 'sniper',
    behavior: 'ranged',
    aggroRange: 8,
    preferredRange: 3,
    weaponId: 'pistol',
    baseXp: 20,
  }),
  emplacement: enemy({
    id: 'emplacement',
    behavior: 'turret',
    aggroRange: 8,
    weaponId: 'pistol',
    baseXp: 8,
  }),
  sleeper: enemy({ id: 'sleeper', aggroRange: 1, baseXp: 1 }),
  fireproof: enemy({
    id: 'fireproof',
    baseHealth: 999,
    resistances: { ...noResistances(), fire: 60 },
  }),
  tank: enemy({
    id: 'tank',
    baseHealth: 999,
    baseAccuracy: 0,
    aggroRange: 0,
    baseXp: 0,
  }),
};

function item(overrides: Partial<ItemDef> & { id: string; type: ItemDef['type'] }): ItemDef {
  return {
    name: overrides.id,
    amount: 1,
    reqLevel: 1,
    reqStrength: 0,
    reqAgility: 0,
    sprite: overrides.id,
    icon: overrides.id,
    ...overrides,
  };
}

export const ITEMS: Record<string, ItemDef> = {
  medkit: item({ id: 'medkit', name: 'Medkit', type: 'heal', amount: 20 }),
  bullets: item({ id: 'bullets', name: 'Bullets', type: 'ammo', amount: 10 }),
  redkey: item({ id: 'redkey', name: 'Red Key', type: 'key' }),
  shield: item({ id: 'shield', name: 'Shield', type: 'armor', amount: 4 }),
  relic: item({ id: 'relic', name: 'Relic', type: 'quest' }),
  stim: item({
    id: 'stim',
    name: 'Stim',
    type: 'powerup',
    effect: { id: 'burn', turns: 3, magnitude: 4 },
  }),
};

export type MapOptions = {
  id?: string;
  depth?: number;
  lamps?: LampDef[];
  light?: number[];
  entities?: MapEntityDef[];
  triggers?: TriggerDef[];
  exits?: MapDef['exits'];
  spawn?: { pos: TileCoord; facing: Facing };
};

/** Baut die Testkarte, optional mit Entitaeten, Triggern und Ausgaengen. */
export function makeMap(options: MapOptions = {}): MapDef {
  return {
    id: options.id ?? 'test',
    name: 'Test Map',
    depth: options.depth ?? 1,
    width: 8,
    height: 8,
    walls: [...WALLS],
    floors: WALLS.map(() => encodeTile(10, 0)),
    ceilings: WALLS.map(() => encodeTile(20, 0)),
    light: options.light ?? WALLS.map(() => 255),
    lamps: options.lamps ?? [],
    spawn: options.spawn ?? { pos: { x: 1, y: 1 }, facing: 0 },
    entities: options.entities ?? [],
    triggers: options.triggers ?? [],
    exits: options.exits ?? [],
    ambientLight: 1,
  };
}

/** ContentDb aus einer oder mehreren Karten. */
export function makeContent(maps: MapDef[]): ContentDb {
  const byId: Record<string, MapDef> = {};
  for (const map of maps) byId[map.id] = map;
  return {
    enemies: ENEMIES,
    weapons: WEAPONS,
    items: ITEMS,
    affixes: {},
    uniques: {},
    dropTables: {},
    skills: {},
    maps: byId,
    progression: { xpThresholds: [...TEST_XP_THRESHOLDS] },
  };
}

export type World = { state: GameState; content: ContentDb; map: MapDef };

/** Komplette Testwelt inklusive frischem Spielstand. */
export function setup(
  options: MapOptions & { seed?: number; extraMaps?: MapDef[]; difficulty?: Difficulty } = {}
): World {
  const map = makeMap(options);
  const content = makeContent([map, ...(options.extraMaps ?? [])]);
  const state = createNewGame(
    options.seed ?? 1234,
    content,
    map.id,
    options.difficulty ?? 'normal'
  );
  return { state, content, map };
}
