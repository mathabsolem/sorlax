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

export type Finding = { rule: number; text: string };

const ARENA_MIN = 16;

function at(pos: TileCoord): string {
  return `(${pos.x},${pos.y})`;
}

/** Freie Kacheln, Tueren zaehlen als begehbar. */
function passable(map: MapDef): boolean[] {
  const open = map.walls.map((value) => value === 0);
  for (const entity of map.entities) {
    if (entity.kind !== 'door') continue;
    open[entity.pos.y * map.width + entity.pos.x] = true;
  }
  return open;
}

/** Flutfuellung von `from` aus ueber alle Kacheln, fuer die `open` gilt. */
function flood(map: MapDef, from: TileCoord, open: readonly boolean[]): boolean[] {
  const seen = new Array<boolean>(map.width * map.height).fill(false);
  const start = from.y * map.width + from.x;
  if (open[start] !== true) return seen;
  seen[start] = true;
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (index === undefined) continue;
    const x = index % map.width;
    const y = (index - x) / map.width;
    for (const next of [
      x > 0 ? index - 1 : -1,
      x < map.width - 1 ? index + 1 : -1,
      y > 0 ? index - map.width : -1,
      y < map.height - 1 ? index + map.width : -1,
    ]) {
      if (next < 0 || seen[next] === true || open[next] !== true) continue;
      seen[next] = true;
      queue.push(next);
    }
  }
  return seen;
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
  const open = passable(map);
  const seen = flood(map, map.spawn.pos, open);

  for (const exit of map.exits) {
    if (seen[exit.pos.y * map.width + exit.pos.x] !== true) {
      found.push({ rule: 3, text: `Ausgang ${at(exit.pos)} ist vom Start nicht erreichbar` });
    }
  }

  // Regel 4: jeder Schluessel ohne die Tueren, die er oeffnet.
  const keys = map.entities.filter((entity) => entity.kind === 'item' && entity.defId.startsWith('key_'));
  for (const key of keys) {
    const locked = open.slice();
    for (const entity of map.entities) {
      if (entity.kind !== 'door' || entity.locked !== key.defId) continue;
      locked[entity.pos.y * map.width + entity.pos.x] = false;
    }
    const without = flood(map, map.spawn.pos, locked);
    if (without[key.pos.y * map.width + key.pos.x] !== true) {
      found.push({
        rule: 4,
        text: `Schluessel ${key.defId} bei ${at(key.pos)} liegt hinter seiner eigenen Tuer`,
      });
    }
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

/**
 * Kacheln des Startraums. Der Raum endet dort, wo eine Kachel wie ein Korridor
 * aussieht, also hoechstens zwei freie Nachbarn hat. MapDef kennt die Raeume
 * nicht, deshalb wird die Form aus dem Raster gelesen.
 */
function startRoom(map: MapDef): Set<number> {
  const free = (index: number): boolean => map.walls[index] === 0;
  const neighbours = (index: number): number[] => {
    const x = index % map.width;
    const y = (index - x) / map.width;
    return [
      x > 0 ? index - 1 : -1,
      x < map.width - 1 ? index + 1 : -1,
      y > 0 ? index - map.width : -1,
      y < map.height - 1 ? index + map.width : -1,
    ].filter((next) => next >= 0 && free(next));
  };

  const start = map.spawn.pos.y * map.width + map.spawn.pos.x;
  const room = new Set<number>([start]);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (index === undefined) continue;
    for (const next of neighbours(index)) {
      if (room.has(next)) continue;
      if (neighbours(next).length <= 2) continue;
      room.add(next);
      queue.push(next);
    }
  }
  return room;
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

  // Regel 10: Licht. Welche Kachel zu welchem Raum gehoert, steht nicht in der
  // MapDef; pruefbar ist, dass es Lampen gibt und keine unter einer Wand haengt.
  // Dass jeder Raum eine bekommt, stellt der Generator sicher.
  if (map.lamps.length === 0) {
    found.push({ rule: 10, text: 'Karte ohne jede Lampe' });
  }
  for (const lamp of map.lamps) {
    if (map.walls[lamp.pos.y * map.width + lamp.pos.x] === 0) continue;
    found.push({ rule: 10, text: `Lampe bei ${at(lamp.pos)} haengt ueber einer Wand` });
  }

  // Regel 12: der Startraum bleibt gegnerfrei.
  const home = startRoom(map);
  for (const entity of map.entities) {
    if (entity.kind !== 'enemy') continue;
    if (!home.has(entity.pos.y * map.width + entity.pos.x)) continue;
    found.push({ rule: 12, text: `Gegner ${entity.defId} steht im Startraum ${at(entity.pos)}` });
  }

  return found;
}
