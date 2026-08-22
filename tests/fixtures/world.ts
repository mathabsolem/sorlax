/**
 * Kleine Testwelt: 8 x 8 Kacheln, dazu ein Minimalsatz an Inhalten.
 * Nur fuer Tests, gehoert bewusst nicht nach content/.
 */
import { AFFIXES, DROP_TABLES, EQUIPMENT, SKILLS, UNIQUES, WEAPON_DEFS } from './catalog';
import { ENEMIES, ITEMS, WEAPONS } from './defs';
import { createInstance,
  takeItemUid } from '../../src/core/items';
import { createNewGame } from '../../src/core/state';
import { encodeTile } from '../../src/core/tiles';
import type {
  ContentDb,
  Difficulty,
  ItemInstance,
  Facing,
  GameState,
  LampDef,
  MapDef,
  MapEntityDef,
  TileCoord,
  TriggerDef,
} from '../../src/core/types';

export { AFFIXES, DROP_TABLES, EQUIPMENT, SKILLS, UNIQUES, WEAPON_DEFS } from './catalog';
export { ENEMIES, ITEMS, WEAPONS, noResistances } from './defs';

/** Sechzig Schwellen wie im Vertrag, aber klein genug zum Nachrechnen. */
export const TEST_XP_THRESHOLDS: number[] = Array.from(
  { length: 60 },
  (_unused, index) => (10 * (index + 1) * (index + 2)) / 2
);

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

/**
 * Offener Raum mit Wandrand, fuer Tests die mehr Platz brauchen als die
 * 8 x 8 Standardkarte, etwa der Versatz von `rime` ueber sechs Kacheln.
 */
export function openWalls(size: number): number[] {
  const walls: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const border = x === 0 || y === 0 || x === size - 1 || y === size - 1;
      walls.push(border ? 1 : 0);
    }
  }
  return walls;
}

export type MapOptions = {
  id?: string;
  depth?: number;
  /** Kantenlaenge eines offenen Raums. Ohne Angabe die 8 x 8 Standardkarte. */
  size?: number;
  lamps?: LampDef[];
  light?: number[];
  entities?: MapEntityDef[];
  triggers?: TriggerDef[];
  exits?: MapDef['exits'];
  spawn?: { pos: TileCoord; facing: Facing };
};

/** Baut die Testkarte, optional mit Entitaeten, Triggern und Ausgaengen. */
export function makeMap(options: MapOptions = {}): MapDef {
  const size = options.size ?? 8;
  const walls = options.size === undefined ? [...WALLS] : openWalls(size);
  return {
    id: options.id ?? 'test',
    name: 'Test Map',
    depth: options.depth ?? 1,
    width: size,
    height: size,
    walls,
    floors: walls.map(() => encodeTile(10, 0)),
    ceilings: walls.map(() => encodeTile(20, 0)),
    light: options.light ?? walls.map(() => 255),
    lamps: options.lamps ?? [],
    spawn: options.spawn ?? { pos: { x: 1, y: 1 }, facing: 0 },
    entities: options.entities ?? [],
    triggers: options.triggers ?? [],
    exits: options.exits ?? [],
    ambientLight: 1,
  };
}

/**
 * ContentDb aus einer oder mehreren Karten.
 *
 * `loot` schaltet die Drop-Tabellen zu. Ohne sie vergibt rollMapLoot zwar
 * Raenge, findet aber keine Tabelle und ruestet niemanden aus. Das haelt die
 * uebrigen Tests frei von zufaelliger Gegnerausruestung.
 */
export function makeContent(maps: MapDef[], loot = false): ContentDb {
  const byId: Record<string, MapDef> = {};
  for (const map of maps) byId[map.id] = map;
  return {
    enemies: ENEMIES,
    weapons: { ...WEAPON_DEFS, ...WEAPONS },
    items: { ...ITEMS, ...EQUIPMENT },
    affixes: AFFIXES,
    uniques: UNIQUES,
    dropTables: loot ? DROP_TABLES : {},
    skills: SKILLS,
    maps: byId,
    progression: { xpThresholds: [...TEST_XP_THRESHOLDS] },
  };
}

export type World = { state: GameState; content: ContentDb; map: MapDef };

/** Komplette Testwelt inklusive frischem Spielstand. */
export function setup(
  options: MapOptions & {
    seed?: number;
    extraMaps?: MapDef[];
    difficulty?: Difficulty;
    loot?: boolean;
  } = {}
): World {
  const map = makeMap(options);
  const content = makeContent([map, ...(options.extraMaps ?? [])], options.loot ?? false);
  const state = createNewGame(
    options.seed ?? 1234,
    content,
    map.id,
    options.difficulty ?? 'normal'
  );
  return { state, content, map };
}

/**
 * Legt eine Waffe in den Platz `weapon`. Seit INTERFACES v1.3 ist die getragene
 * Waffe eine `ItemInstance`, deshalb reicht das Setzen einer Id nicht mehr.
 */
export function equipWeapon(state: GameState, content: ContentDb, weaponId: string): void {
  const def = Object.values(content.items).find((candidate) => candidate.weaponId === weaponId);
  if (def === undefined) throw new Error(`kein ItemDef fuer Waffe ${weaponId}`);
  const instance = createInstance(takeItemUid(state), def.id, 1, 'normal', [], content);
  if (instance === null) throw new Error(`Instanz fehlgeschlagen: ${def.id}`);
  state.player.equipment['weapon'] = instance;
  if (!state.player.weapons.includes(weaponId)) state.player.weapons.push(weaponId);
}

/** Legt eine Waffeninstanz ins Inventar, ohne sie anzulegen. */
export function giveWeapon(
  state: GameState,
  content: ContentDb,
  weaponId: string
): ItemInstance {
  const def = Object.values(content.items).find((candidate) => candidate.weaponId === weaponId);
  if (def === undefined) throw new Error(`kein ItemDef fuer Waffe ${weaponId}`);
  const instance = createInstance(takeItemUid(state), def.id, 1, 'normal', [], content);
  if (instance === null) throw new Error(`Instanz fehlgeschlagen: ${def.id}`);
  state.player.inventory.push(instance);
  if (!state.player.weapons.includes(weaponId)) state.player.weapons.push(weaponId);
  return instance;
}
