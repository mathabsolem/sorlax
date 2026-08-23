/**
 * Kartengenerator, PHASE_6 Block 1 bis 7.
 *
 * Kein Laufzeitcode. Erzeugt content/maps/sohle_01.json bis sohle_16.json und
 * prueft jede Karte sofort gegen den Validator. Ein Verstoss bricht ab, es
 * wird nichts stillschweigend korrigiert.
 *
 * Aufruf: npm run gen:maps
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { argv } from 'node:process';
import { fileURLToPath } from 'node:url';
import { generateLightMap } from '../src/core/lighting.ts';
import { Rng } from '../src/core/rng.ts';
import { encodeTile } from '../src/core/tiles.ts';
import type {
  ContentDb,
  EnemyDef,
  ItemDef,
  MapDef,
  MapEntityDef,
  TileCoord,
} from '../src/core/types.ts';
import { buildGrids, buildLamps, drawTrace, freeTiles, tracePath, traceSetFor } from './mapDecor.ts';
import { buildArena, buildLayout, center } from './mapGeometry.ts';
import type { Layout } from './mapGeometry.ts';
import { mapIdFor, placeEnemies, placeItems, planLayout } from './mapPopulate.ts';
import { BOSS_DEPTHS, seedFor, sizeFor, zoneOf } from './mapTables.ts';
import { validateMap } from './validateMap.ts';

const MAPS_DIR = new URL('../content/maps/', import.meta.url);
const DEPTHS = Array.from({ length: 16 }, (_value, index) => index + 1);

function readJson<T>(name: string): Record<string, T> {
  return JSON.parse(readFileSync(new URL(`../content/${name}`, import.meta.url), 'utf8')) as Record<
    string,
    T
  >;
}

/** Zahl der Raeume, PHASE_6 Block 2. */
function roomCount(depth: number): number {
  return Math.min(14, 6 + Math.floor(depth / 2));
}

/** Deutscher Kartenname. Die Zonen heissen nach CONTENT_TABLES Abschnitt 6. */
function nameFor(depth: number): string {
  const zone = ['Industrie', 'Pilzbefall', 'Frost', 'Struktur'][Math.min(3, Math.ceil(depth / 4) - 1)];
  return `Sohle ${depth}, ${zone ?? 'Industrie'}`;
}

/** Zwei bis vier Spuren, jede von einem Raum zu einer Tuer oder Sackgasse. */
function addTraces(rng: Rng, layout: Layout, floors: number[], depth: number, doors: TileCoord[]): void {
  const set = traceSetFor(depth);
  const count = rng.randInt(2, 4);
  for (let index = 0; index < count; index++) {
    const room = layout.rooms[rng.randInt(0, layout.rooms.length - 1)];
    if (room === undefined) continue;
    const tiles = freeTiles(layout, room);
    const from = tiles[rng.randInt(0, tiles.length - 1)];
    const to = doors[index % Math.max(1, doors.length)] ?? center(room);
    if (from === undefined) continue;
    const path = tracePath(layout, from, to);
    if (path.length >= 2) drawTrace(floors, layout.size, path, set);
  }
}

/** Die Startkachel: Mitte des Startraums, Blick nach Norden. */
function spawnOf(layout: Layout, start: number): MapDef['spawn'] {
  const room = layout.rooms[start];
  const pos = room === undefined ? { x: 1, y: 1 } : center(room);
  return { pos, facing: 0 };
}

export function buildMap(
  depth: number,
  enemies: Record<string, EnemyDef>,
  items: Record<string, ItemDef>
): MapDef {
  const rng = new Rng(seedFor(depth));
  const size = sizeFor(depth);
  const zone = zoneOf(depth);
  const isBoss = BOSS_DEPTHS[depth] !== undefined;
  const layout = isBoss ? buildArena(size) : buildLayout(rng, size, roomCount(depth));

  const plan = planLayout(rng, layout, depth, zone);
  const grids = buildGrids(rng, layout, zone);
  const lamps = buildLamps(layout, zone, depth);

  // Die Deckenlampe sitzt ueber jeder Lampe, CONTENT_TABLES Abschnitt 6.
  for (const lamp of lamps) {
    grids.ceilings[lamp.pos.y * size + lamp.pos.x] = encodeTile(zone.lamp, 0);
  }

  addTraces(
    rng,
    layout,
    grids.floors,
    depth,
    plan.entities.filter((entity) => entity.kind === 'door').map((entity) => entity.pos)
  );

  const entities: MapEntityDef[] = [...plan.entities];
  entities.push(...placeEnemies(rng, layout, depth, enemies, plan, entities));
  entities.push(...placeItems(rng, layout, depth, enemies, items, plan, entities));

  // Erhoehter Beutewurf hinter der Geheimtuer: zwei zusaetzliche Stapel.
  if (plan.secretRoom >= 0) {
    const room = layout.rooms[plan.secretRoom];
    const tiles = room === undefined ? [] : freeTiles(layout, room);
    for (const defId of ['heal_large', 'armor_plate']) {
      const pos = tiles.find(
        (tile) => !entities.some((entity) => entity.pos.x === tile.x && entity.pos.y === tile.y)
      );
      if (pos !== undefined && items[defId] !== undefined) {
        entities.push({ kind: 'item', defId, pos });
      }
    }
  }

  return {
    id: mapIdFor(depth),
    name: nameFor(depth),
    depth,
    width: size,
    height: size,
    walls: grids.walls,
    floors: grids.floors,
    ceilings: grids.ceilings,
    light: generateLightMap(size, size, grids.walls, lamps),
    spawn: spawnOf(layout, plan.start),
    lamps,
    entities,
    triggers: plan.triggers,
    exits: plan.exits,
    ambientLight: zone.ambientLight,
  };
}

/** Alle sechzehn Sohlen, frisch erzeugt. Schreibt nichts. */
export function buildAllMaps(): MapDef[] {
  const enemies = readJson<EnemyDef>('enemies.json');
  const items = readJson<ItemDef>('items.json');
  return DEPTHS.map((depth) => buildMap(depth, enemies, items));
}

/** Der Inhalt, gegen den der Validator prueft. */
export function contentForValidation(): { content: ContentDb; known: Set<string> } {
  const content = {
    enemies: readJson<EnemyDef>('enemies.json'),
    items: readJson<ItemDef>('items.json'),
  } as unknown as ContentDb;
  return { content, known: new Set(DEPTHS.map(mapIdFor)) };
}

/** Dateiinhalt einer Karte, so wie er in content/maps liegt. */
export function serializeMap(map: MapDef): string {
  return `${JSON.stringify(map, null, 2)}\n`;
}

function main(): void {
  const { content, known } = contentForValidation();
  mkdirSync(MAPS_DIR, { recursive: true });
  const maps = buildAllMaps();

  const problems: string[] = [];
  for (const map of maps) {
    for (const finding of validateMap(map, content, known)) {
      problems.push(`${map.id}: Regel ${finding.rule}, ${finding.text}`);
    }
  }
  if (problems.length > 0) {
    for (const line of problems.slice(0, 40)) console.error(line);
    throw new Error(`${problems.length} Verstoesse, nichts geschrieben`);
  }

  for (const map of maps) {
    writeFileSync(new URL(`${map.id}.json`, MAPS_DIR), serializeMap(map), 'utf8');
  }
  const rooms = maps.reduce((sum, map) => sum + map.lamps.length, 0);
  console.log(`${maps.length} Karten geschrieben, ${rooms} Lampen`);
}

// Beim Import aus einem Test wird nichts geschrieben, nur beim direkten Aufruf.
if (argv[1] !== undefined && fileURLToPath(import.meta.url) === argv[1]) main();
