/**
 * Validator fuer erzeugte Karten, PHASE_6 Block 7.
 *
 * Der Generator ruft ihn nach jeder Karte, der Test ueber alle sechzehn. Bei
 * einem Verstoss gibt es keine stille Korrektur, sondern eine Meldung mit
 * Sohle, Regel und Position.
 */
import { textureIdOf } from '../src/core/tiles.ts';
import type { ContentDb, MapDef, TileCoord } from '../src/core/types.ts';
import { BOSS_DEPTHS, KNOWN_TEXTURES } from './mapTables.ts';
import { DARK_SHARE } from './mapDecor.ts';
import { simulate } from './validateReach.ts';

export type Finding = { rule: number; text: string };

const ARENA_MIN = 16;

function at(pos: TileCoord): string {
  return `(${pos.x},${pos.y})`;
}

function checkGrids(map: MapDef, found: Finding[]): void {
  const size = map.width * map.height;
  for (const [name, grid] of Object.entries({
    walls: map.walls,
    floors: map.floors,
    ceilings: map.ceilings,
    light: map.light,
  })) {
    if (grid.length !== size) {
      found.push({ rule: 1, text: `${name} hat ${grid.length} Eintraege, erwartet ${size}` });
    }
  }

  for (let x = 0; x < map.width; x++) {
    for (const y of [0, map.height - 1]) {
      if (map.walls[y * map.width + x] === 0) {
        found.push({ rule: 2, text: `Rand offen bei ${at({ x, y })}` });
      }
    }
  }
  for (let y = 0; y < map.height; y++) {
    for (const x of [0, map.width - 1]) {
      if (map.walls[y * map.width + x] === 0) {
        found.push({ rule: 2, text: `Rand offen bei ${at({ x, y })}` });
      }
    }
  }
}

function checkReach(map: MapDef, found: Finding[]): void {
  const { reached, missed } = simulate(map);

  for (const exit of map.exits) {
    if (reached[exit.pos.y * map.width + exit.pos.x] !== true) {
      found.push({ rule: 3, text: `Ausgang ${at(exit.pos)} ist vom Start nicht erreichbar` });
    }
  }

  for (const key of missed) {
    found.push({
      rule: 4,
      text: `Schluessel ${key.defId} bei ${at(key.pos)} ist in keiner Reihenfolge erreichbar`,
    });
  }

  // Ebenso ein Fehler: mehr verriegelte Tueren als Schluessel derselben Farbe.
  const locks = new Map<string, number>();
  for (const door of map.entities) {
    if (door.kind !== 'door' || door.locked === undefined) continue;
    locks.set(door.locked, (locks.get(door.locked) ?? 0) + 1);
  }
  for (const [lock, count] of locks) {
    const keys = map.entities.filter(
      (entity) => entity.kind === 'item' && entity.defId === lock
    ).length;
    if (keys >= count) continue;
    found.push({ rule: 4, text: `${count} Tueren mit ${lock}, aber nur ${keys} Schluessel` });
  }
}

function checkEntities(map: MapDef, content: ContentDb, found: Finding[]): void {
  const taken = new Map<string, string>();
  for (const entity of map.entities) {
    const index = entity.pos.y * map.width + entity.pos.x;
    // Geheimtueren stehen bewusst in einer Wand, alles andere nicht.
    const inWall = map.walls[index] !== 0;
    if (inWall && !(entity.kind === 'door' && entity.secret === true)) {
      found.push({ rule: 5, text: `${entity.defId} steht bei ${at(entity.pos)} in einer Wand` });
    }

    const key = `${entity.pos.x},${entity.pos.y}`;
    const other = taken.get(key);
    if (other !== undefined) {
      found.push({ rule: 6, text: `${entity.defId} und ${other} teilen sich ${at(entity.pos)}` });
    }
    taken.set(key, entity.defId);

    const known =
      entity.kind === 'enemy'
        ? content.enemies[entity.defId] !== undefined
        : entity.kind === 'door'
          ? true
          : content.items[entity.defId] !== undefined;
    if (!known) {
      found.push({ rule: 7, text: `${entity.defId} bei ${at(entity.pos)} steht in keinem Katalog` });
    }
  }
}

function checkTextures(map: MapDef, found: Finding[]): void {
  for (const [name, grid] of Object.entries({
    walls: map.walls,
    floors: map.floors,
    ceilings: map.ceilings,
  })) {
    for (let index = 0; index < grid.length; index++) {
      const value = grid[index] ?? 0;
      if (value === 0) continue;
      const id = textureIdOf(value);
      if (KNOWN_TEXTURES.has(id)) continue;
      found.push({
        rule: 8,
        text: `${name} nutzt Textur ${id} bei ${at({ x: index % map.width, y: Math.floor(index / map.width) })}`,
      });
    }
  }
}

function checkLamps(map: MapDef, found: Finding[]): void {
  for (let index = 0; index < map.light.length; index++) {
    const value = map.light[index] ?? 0;
    if (value >= 0 && value <= 255) continue;
    found.push({ rule: 13, text: `Licht ${value} ausserhalb von 0 bis 255 bei Index ${index}` });
  }
}

function checkBoss(map: MapDef, found: Finding[]): void {
  const bossId = BOSS_DEPTHS[map.depth];
  const enemies = map.entities.filter((entity) => entity.kind === 'enemy');
  if (bossId === undefined) return;

  if (enemies.length !== 1 || enemies[0]?.defId !== bossId) {
    found.push({
      rule: 11,
      text: `Bosskarte fuehrt ${enemies.length} Gegner, erwartet genau ${bossId}`,
    });
  }

  let best = 0;
  for (let y = 0; y + ARENA_MIN <= map.height; y++) {
    for (let x = 0; x + ARENA_MIN <= map.width; x++) {
      let free = 0;
      for (let dy = 0; dy < ARENA_MIN; dy++) {
        for (let dx = 0; dx < ARENA_MIN; dx++) {
          if (map.walls[(y + dy) * map.width + x + dx] === 0) free += 1;
        }
      }
      best = Math.max(best, free);
    }
  }
  // Die vier Stuetzpfeiler duerfen im Quadrat stehen.
  if (best < ARENA_MIN * ARENA_MIN - 4) {
    found.push({ rule: 11, text: `Arena hat kein Quadrat von ${ARENA_MIN} x ${ARENA_MIN}` });
  }
}

/** Prueft eine Karte gegen die dreizehn Regeln aus PHASE_6 Block 7. */
export function validateMap(map: MapDef, content: ContentDb, maps: ReadonlySet<string>): Finding[] {
  const found: Finding[] = [];
  checkGrids(map, found);
  checkReach(map, found);
  checkEntities(map, content, found);
  checkTextures(map, found);
  checkLamps(map, found);
  checkBoss(map, found);

  for (const exit of map.exits) {
    if (maps.has(exit.targetMapId)) continue;
    found.push({ rule: 9, text: `Ausgang zeigt auf unbekannte Karte ${exit.targetMapId}` });
  }

  // Regel 10: jeder Raum ausser den Korridoren braucht eine Lampe oder das
  // Kennzeichen `dark` aus INTERFACES v1.8. Seit v1.7 stehen die Raeume in der
  // Karte, geraten wird nichts mehr.
  for (const room of map.rooms) {
    if (room.kind === 'corridor' || room.dark === true) continue;
    const lit = map.lamps.some(
      (lamp) =>
        lamp.pos.x >= room.x &&
        lamp.pos.x < room.x + room.w &&
        lamp.pos.y >= room.y &&
        lamp.pos.y < room.y + room.h
    );
    if (lit) continue;
    found.push({ rule: 10, text: `Raum ${room.id} bei ${at({ x: room.x, y: room.y })} ohne Lampe` });
  }

  // Die Grenze aus PHASE_7 Block 0: hoechstens ein Viertel dunkel, und Start,
  // Ausgang und Arena nie.
  const dark = map.rooms.filter((room) => room.dark === true);
  if (dark.length > Math.floor(map.rooms.length * DARK_SHARE)) {
    found.push({ rule: 10, text: `${dark.length} von ${map.rooms.length} Raeumen sind dunkel` });
  }
  for (const room of dark) {
    if (room.kind === 'normal' || room.kind === 'secret') continue;
    found.push({ rule: 10, text: `Raum ${room.id} ist dunkel, obwohl er ${room.kind} ist` });
  }
  for (const lamp of map.lamps) {
    if (map.walls[lamp.pos.y * map.width + lamp.pos.x] === 0) continue;
    found.push({ rule: 10, text: `Lampe bei ${at(lamp.pos)} haengt ueber einer Wand` });
  }

  // Regel 12: der Startraum bleibt gegnerfrei, geprueft ueber sein Rechteck.
  const home = map.rooms.find((room) => room.kind === 'start');
  for (const entity of map.entities) {
    if (entity.kind !== 'enemy' || home === undefined) continue;
    const inside =
      entity.pos.x >= home.x &&
      entity.pos.x < home.x + home.w &&
      entity.pos.y >= home.y &&
      entity.pos.y < home.y + home.h;
    if (!inside) continue;
    found.push({ rule: 12, text: `Gegner ${entity.defId} steht im Startraum ${at(entity.pos)}` });
  }

  return found;
}
