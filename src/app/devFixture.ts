/**
 * Entwicklungskarte fuer die Sichtpruefung. Liegt bewusst nicht in content/,
 * sie ist kein Spielinhalt sondern Werkzeug.
 *
 * 16 x 16 Kacheln, eine verriegelbare Tuer, zwei Gegner mit verschiedenen
 * Verhaltensmustern, ein Item, zwei Deckenlampen, gedrehte Bodenkacheln.
 */
import affixes from '../../content/affixes.json';
import equipment from '../../content/items.json';
import progression from '../../content/progression.json';
import skills from '../../content/skills.json';
import { STARTER_WEAPON_ITEM } from '../core/items';
import { generateLightMap } from '../core/lighting';
import { encodeTile } from '../core/tiles';
import type { ContentDb, EnemyDef, ItemDef, MapDef, WeaponDef } from '../core/types';
import {
  TEX_CEILING,
  TEX_FLOOR_PLATE,
  TEX_FLOOR_ROCK,
  TEX_WALL_PANEL,
  TEX_WALL_ROCK,
  TEX_WALL_RUST,
} from '../render/placeholders';

export const DEV_MAP_ID = 'dev';
export const DEV_SEED = 20260818;

const PLAN = [
  '################',
  '#....#.........#',
  '#....#.........#',
  '#....#.........#',
  '#....D.........#',
  '#....#.........#',
  '#....#.........#',
  '########.#######',
  '#..............#',
  '#..............#',
  '#..#####..#....#',
  '#..#...#..#....#',
  '#..#...#..#....#',
  '#..#####..#....#',
  '#..............#',
  '################',
];

const SIZE = 16;

/** Wandtextur nach Position variieren, damit die Raeume unterscheidbar sind. */
function wallTextureAt(x: number, y: number): number {
  if (y < 7) return x < 6 ? TEX_WALL_RUST : TEX_WALL_PANEL;
  return TEX_WALL_ROCK;
}

function buildWalls(): number[] {
  const walls: number[] = [];
  for (let y = 0; y < SIZE; y++) {
    const row = PLAN[y] ?? '';
    for (let x = 0; x < SIZE; x++) {
      const cell = row[x] ?? '#';
      walls.push(cell === '#' ? encodeTile(wallTextureAt(x, y), 0) : 0);
    }
  }
  return walls;
}

/**
 * Boden mit Richtungspfeil. Der Gang und der Ring um die Halle bekommen
 * Drehungen, damit die Kachelkodierung im Bild ueberpruefbar ist.
 */
function buildFloors(): number[] {
  const floors: number[] = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const texture = y < 7 ? TEX_FLOOR_PLATE : TEX_FLOOR_ROCK;
      let rotation: 0 | 1 | 2 | 3 = 0;
      if (x === 8 && y === 7) rotation = 2;
      else if (y === 8) rotation = 1;
      else if (y === 14) rotation = 3;
      else if (x === 4 && y >= 1 && y <= 6) rotation = 2;
      floors.push(encodeTile(texture, rotation));
    }
  }
  return floors;
}

function buildCeilings(): number[] {
  return new Array<number>(SIZE * SIZE).fill(encodeTile(TEX_CEILING, 0));
}

export function createDevMap(): MapDef {
  const walls = buildWalls();
  // Eine Deckenlampe je Bereich, sonst ist der Nachbarraum zum Testen zu dunkel.
  const lamps = [
    { pos: { x: 3, y: 3 }, radius: 6, intensity: 255 },
    { pos: { x: 10, y: 3 }, radius: 8, intensity: 230 },
    { pos: { x: 11, y: 11 }, radius: 8, intensity: 210 },
  ];

  return {
    id: DEV_MAP_ID,
    name: 'Vortrieb 1',
    depth: 1,
    width: SIZE,
    height: SIZE,
    walls,
    floors: buildFloors(),
    ceilings: buildCeilings(),
    light: generateLightMap(SIZE, SIZE, walls, lamps),
    spawn: { pos: { x: 2, y: 4 }, facing: 1 },
    lamps,
    entities: [
      { kind: 'door', defId: 'gate', pos: { x: 5, y: 4 } },
      { kind: 'enemy', defId: 'grubling', pos: { x: 12, y: 3 } },
      { kind: 'enemy', defId: 'sentry', pos: { x: 12, y: 12 } },
      { kind: 'item', defId: 'medkit', pos: { x: 8, y: 9 } },
    ],
    triggers: [],
    exits: [],
    ambientLight: 0.9,
  };
}

/** Kleiner Bauer fuer Gegenstaende ohne Anforderungen. */
function consumable(id: string, name: string, type: ItemDef['type'], amount: number): ItemDef {
  return {
    id,
    name,
    type,
    amount,
    reqLevel: 1,
    reqStrength: 0,
    reqAgility: 0,
    sprite: id,
    icon: id,
  };
}

const WEAPONS: Record<string, WeaponDef> = {
  cutter: {
    id: 'cutter',
    name: 'Schneidbrenner',
    dmgMin: 3,
    dmgMax: 6,
    damageType: 'physical',
    critChance: 0.05,
    optimalRange: 1,
    maxRange: 1,
    ammoType: null,
    ammoPerShot: 0,
    sprite: 'cutter',
    sound: 'cutter',
  },
  bolter: {
    id: 'bolter',
    name: 'Bolzenwerfer',
    dmgMin: 4,
    dmgMax: 9,
    damageType: 'shock',
    appliesEffect: 'jolt',
    critChance: 0.12,
    optimalRange: 4,
    maxRange: 9,
    ammoType: 'bolts',
    ammoPerShot: 1,
    sprite: 'bolter',
    sound: 'bolter',
  },
};

function framesFor(name: string): EnemyDef['frames'] {
  return {
    idle: [`${name}_idle_0`, `${name}_idle_1`],
    attack: [`${name}_attack_0`],
    pain: [`${name}_pain_0`],
    death: [`${name}_death_0`, `${name}_death_1`],
  };
}

const ENEMIES: Record<string, EnemyDef> = {
  grubling: {
    id: 'grubling',
    archetype: 'grub',
    element: 'physical',
    name: 'Grubling',
    baseHealth: 14,
    baseArmor: 0,
    baseAccuracy: 6,
    baseEvasion: 3,
    resistances: { physical: 0, fire: -20, poison: 20, ice: 0, shock: 0, void: 0 },
    speed: 1,
    behavior: 'melee',
    aggroRange: 7,
    preferredRange: 1,
    weaponId: 'cutter',
    baseXp: 12,
    spriteWidth: 0.8,
    frames: framesFor('grubling'),
  },
  sentry: {
    id: 'sentry',
    archetype: 'turret',
    element: 'shock',
    name: 'Wachgeschütz',
    baseHealth: 20,
    baseArmor: 2,
    baseAccuracy: 9,
    baseEvasion: 0,
    resistances: { physical: 10, fire: 0, poison: 40, ice: 0, shock: 30, void: 0 },
    speed: 1,
    behavior: 'turret',
    aggroRange: 9,
    preferredRange: 4,
    weaponId: 'bolter',
    baseXp: 18,
    spriteWidth: 0.9,
    frames: framesFor('sentry'),
  },
};

/** ItemDef zu einer Waffe der Entwicklungskarte. */
function weaponItem(id: string, name: string, weaponId: string): ItemDef {
  return {
    id,
    name,
    type: 'weapon',
    slots: ['weapon'],
    weaponId,
    amount: 1,
    reqLevel: 1,
    reqStrength: 0,
    reqAgility: 0,
    sprite: id,
    icon: id,
  };
}

export function createDevContent(): ContentDb {
  const map = createDevMap();
  return {
    enemies: ENEMIES,
    weapons: WEAPONS,
    items: {
      ...(equipment as unknown as ContentDb['items']),
      medkit: consumable('medkit', 'Verbandpack', 'heal', 20),
      bolts: { ...consumable('bolts', 'Bolzen', 'ammo', 12), ammoType: 'bolts' },
      // Seit INTERFACES v1.3 haelt der Platz `weapon` eine ItemInstance.
      // createNewGame braucht dafuer den Grundtyp der Startwaffe.
      [STARTER_WEAPON_ITEM]: weaponItem(STARTER_WEAPON_ITEM, 'Schneidbrenner', 'cutter'),
      item_bolter: weaponItem('item_bolter', 'Bolzenwerfer', 'bolter'),
    },
    affixes: affixes as unknown as ContentDb['affixes'],
    uniques: {},
    dropTables: {},
    skills: skills as unknown as ContentDb['skills'],
    maps: { [map.id]: map },
    progression,
  };
}

/** Alle Sprite- und Waffennamen, die die Platzhalter erzeugen muessen. */
export function collectAssetNames(content: ContentDb): {
  spriteNames: string[];
  weaponNames: string[];
} {
  const sprites = new Set<string>();
  for (const enemy of Object.values(content.enemies)) {
    for (const list of Object.values(enemy.frames)) {
      for (const frame of list) sprites.add(frame);
    }
  }
  for (const item of Object.values(content.items)) sprites.add(item.sprite);

  const weapons = new Set<string>();
  for (const weapon of Object.values(content.weapons)) weapons.add(weapon.sprite);

  return { spriteNames: [...sprites], weaponNames: [...weapons] };
}
