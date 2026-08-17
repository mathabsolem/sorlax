/**
 * Kleine Testwelt: 8 x 8 Kacheln, dazu ein Minimalsatz an Inhalten.
 * Nur fuer Tests, gehoert bewusst nicht nach content/.
 */
import { createNewGame } from '../../src/core/state';
import type {
  ContentDb,
  EnemyDef,
  Facing,
  GameState,
  ItemDef,
  MapDef,
  MapEntityDef,
  TileCoord,
  TriggerDef,
  WeaponDef,
} from '../../src/core/types';

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
    name: overrides.id,
    stats: { health: 10, maxHealth: 10, armor: 0, accuracy: 5, evasion: 0 },
    speed: 1,
    behavior: 'melee',
    aggroRange: 5,
    preferredRange: 1,
    weaponId: 'fists',
    xpReward: 10,
    sprite: overrides.id,
    frames: frames(),
    ...overrides,
  };
}

export const ENEMIES: Record<string, EnemyDef> = {
  grunt: enemy({ id: 'grunt' }),
  runner: enemy({ id: 'runner', behavior: 'charger', speed: 2, aggroRange: 8, xpReward: 15 }),
  crawler: enemy({ id: 'crawler', speed: 0.5, aggroRange: 8, xpReward: 5 }),
  sniper: enemy({
    id: 'sniper',
    behavior: 'ranged',
    aggroRange: 8,
    preferredRange: 3,
    weaponId: 'pistol',
    xpReward: 20,
  }),
  emplacement: enemy({
    id: 'emplacement',
    behavior: 'turret',
    aggroRange: 8,
    weaponId: 'pistol',
    xpReward: 8,
  }),
  sleeper: enemy({ id: 'sleeper', aggroRange: 1, xpReward: 1 }),
  tank: enemy({
    id: 'tank',
    stats: { health: 999, maxHealth: 999, armor: 0, accuracy: 0, evasion: 0 },
    aggroRange: 0,
    xpReward: 0,
  }),
};

export const ITEMS: Record<string, ItemDef> = {
  medkit: { id: 'medkit', name: 'Medkit', type: 'heal', amount: 20, sprite: 'medkit' },
  bullets: { id: 'bullets', name: 'Bullets', type: 'ammo', amount: 10, sprite: 'bullets' },
  redkey: { id: 'redkey', name: 'Red Key', type: 'key', amount: 1, sprite: 'redkey' },
  shield: { id: 'shield', name: 'Shield', type: 'armor', amount: 4, sprite: 'shield' },
  relic: { id: 'relic', name: 'Relic', type: 'quest', amount: 1, sprite: 'relic' },
  stim: {
    id: 'stim',
    name: 'Stim',
    type: 'powerup',
    amount: 1,
    sprite: 'stim',
    effect: { id: 'haste', turns: 3, magnitude: 1 },
  },
};

export type MapOptions = {
  id?: string;
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
    width: 8,
    height: 8,
    walls: [...WALLS],
    floorTexture: 1,
    ceilingTexture: 2,
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
    maps: byId,
    progression: { xpThresholds: [10, 30, 60] },
  };
}

export type World = { state: GameState; content: ContentDb; map: MapDef };

/** Komplette Testwelt inklusive frischem Spielstand. */
export function setup(options: MapOptions & { seed?: number; extraMaps?: MapDef[] } = {}): World {
  const map = makeMap(options);
  const content = makeContent([map, ...(options.extraMaps ?? [])]);
  const state = createNewGame(options.seed ?? 1234, content, map.id);
  return { state, content, map };
}
