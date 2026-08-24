/**
 * Texturen, Bodenspuren und Lampen, PHASE_6 Block 4 und 5.
 *
 * Alle Ids stammen aus CONTENT_TABLES v1.1 Abschnitt 6. Die Drehung folgt der
 * Kachelkodierung aus SPEC Abschnitt 6 und wird nie von Hand hingeschrieben,
 * sondern ueber `encodeTile` gesetzt.
 */
import { encodeTile } from '../src/core/tiles.ts';
import type { Rotation } from '../src/core/tiles.ts';
import type { Rng } from '../src/core/rng.ts';
import type { LampDef, RoomDef, TileCoord } from '../src/core/types.ts';
import { center, inRoom, roomTiles } from './mapGeometry.ts';
import type { Layout, Room } from './mapGeometry.ts';
import { BLOOD_TRACE, DUST_TRACE, PILLAR_INDEX } from './mapTables.ts';
import type { TraceSet, Zone } from './mapTables.ts';

export type Grids = { walls: number[]; floors: number[]; ceilings: number[] };

function pick<T>(rng: Rng, values: readonly T[]): T {
  const value = values[rng.randInt(0, values.length - 1)];
  if (value === undefined) throw new Error('leere Auswahl');
  return value;
}

/** Zu welchem Raum gehoert die Kachel? -1 fuer Korridor oder Wand. */
function roomAt(layout: Layout, pos: TileCoord): number {
  return layout.rooms.findIndex((room) => inRoom(room, pos));
}

/**
 * Wand-, Boden- und Deckenraster.
 *
 * Je Raum ein Hauptwandtyp und ein Bodentyp, die Korridore einen anderen.
 * Der vierte Wandtyp jeder Zone ist der Stuetzpfeiler und bleibt den Pfeilern
 * der Bossarena vorbehalten.
 */
export function buildGrids(rng: Rng, layout: Layout, zone: Zone): Grids {
  const size = layout.size;
  const plain = zone.walls.slice(0, PILLAR_INDEX);
  const roomWalls = layout.rooms.map(() => pick(rng, plain));
  const roomFloors = layout.rooms.map(() => pick(rng, zone.floors));
  const corridorWall = pick(rng, plain);
  const corridorFloor = pick(rng, zone.floors);
  const ceiling = pick(rng, zone.ceilings);

  const walls = new Array<number>(size * size).fill(0);
  const floors = new Array<number>(size * size).fill(0);
  const ceilings = new Array<number>(size * size).fill(0);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      const pos = { x, y };
      const room = roomAt(layout, pos);
      const solid = layout.solid[index] === true;

      floors[index] = encodeTile(room >= 0 ? (roomFloors[room] ?? corridorFloor) : corridorFloor, 0);
      ceilings[index] = encodeTile(ceiling, 0);
      if (!solid) continue;

      // Ein Pfeiler steht mitten im freien Raum, eine Wand am Rand davon.
      const pillar = room >= 0;
      walls[index] = encodeTile(
        pillar ? (zone.walls[PILLAR_INDEX] ?? corridorWall) : (roomWalls[room] ?? corridorWall),
        0
      );
      if (!pillar) walls[index] = encodeTile(nearestRoomWall(layout, pos, roomWalls, corridorWall), 0);
    }
  }
  return { walls, floors, ceilings };
}

/** Wandtyp einer soliden Kachel: der des angrenzenden Raums, sonst der Korridor. */
function nearestRoomWall(
  layout: Layout,
  pos: TileCoord,
  roomWalls: number[],
  fallback: number
): number {
  for (const step of [
    { x: pos.x - 1, y: pos.y },
    { x: pos.x + 1, y: pos.y },
    { x: pos.x, y: pos.y - 1 },
    { x: pos.x, y: pos.y + 1 },
  ]) {
    const room = layout.rooms.findIndex((candidate) => inRoom(candidate, step));
    if (room >= 0) return roomWalls[room] ?? fallback;
  }
  return fallback;
}

/** Anteil der Raeume, der ab Zone 3 dunkel bleiben darf, PHASE_7 Block 0. */
export const DARK_SHARE = 0.25;

/**
 * Welche Raeume bleiben ohne Licht? Ab Zone 3, hoechstens ein Viertel der
 * Raeume einer Karte, und nie Start, Ausgang oder Arena: dort waere Dunkelheit
 * kein Stimmungsmittel, sondern eine Zumutung.
 */
export function darkRooms(rooms: readonly RoomDef[], depth: number): Set<number> {
  if (depth <= 8) return new Set();
  const eligible = rooms.filter((room) => room.kind === 'normal' || room.kind === 'secret');
  const limit = Math.min(eligible.length, Math.floor(rooms.length * DARK_SHARE));
  if (limit <= 0) return new Set();

  // Gleichmaessig ueber die Liste verteilt, damit nicht ein Kartenteil
  // vollstaendig ausfaellt.
  const step = eligible.length / limit;
  const chosen = new Set<number>();
  for (let index = 0; index < limit; index++) {
    const room = eligible[Math.floor(index * step)];
    if (room !== undefined) chosen.add(room.id);
  }
  return chosen;
}

/**
 * Lampen je Raum und Korridor, PHASE_6 Block 5.
 *
 * Der Abstand von sechs Kacheln zaehlt entlang des Korridorverlaufs, nicht in
 * Rasterreihenfolge (CONTENT_TABLES v1.2 Abschnitt 7). Ab Zone 3 bleibt jede
 * fuenfte Korridorlampe dunkel, dazu bleiben die Raeume aus `dark` ganz ohne
 * Licht.
 */
export function buildLamps(
  layout: Layout,
  zone: Zone,
  depth: number,
  rooms: readonly RoomDef[],
  dark: ReadonlySet<number>
): LampDef[] {
  const lamp = (pos: TileCoord): LampDef => ({ pos, radius: 5, intensity: zone.intensity });
  const solid = (pos: TileCoord): boolean => layout.solid[pos.y * layout.size + pos.x] === true;
  const inDark = (pos: TileCoord): boolean =>
    rooms.some(
      (room) =>
        dark.has(room.id) &&
        pos.x >= room.x &&
        pos.x < room.x + room.w &&
        pos.y >= room.y &&
        pos.y < room.y + room.h
    );

  // Pflichtlampen: eine je Raum, der Licht bekommen soll.
  const required: LampDef[] = [];
  const optional: LampDef[] = [];
  for (const room of layout.rooms) {
    const middle = center(room);
    if (!solid(middle) && !inDark(middle)) required.push(lamp(middle));
    // Grosse Raeume tragen eine zweite Lampe, damit die Ecken nicht absaufen.
    if (Math.max(room.w, room.h) >= 8) {
      const second = { x: room.x + Math.floor(room.w / 4), y: room.y + Math.floor(room.h / 4) };
      if (!solid(second) && !inDark(second)) optional.push(lamp(second));
    }
  }

  for (const edge of layout.edges) {
    let since = 0;
    for (const tile of edge.tiles) {
      if (solid(tile)) continue;
      since += 1;
      if (since < 6) continue;
      since = 0;
      if (inDark(tile)) continue;
      if (optional.some((other) => other.pos.x === tile.x && other.pos.y === tile.y)) continue;
      optional.push(lamp(tile));
    }
  }

  if (depth <= 8) return [...required, ...optional];
  return [...required, ...optional.filter((_lamp, index) => index % 5 !== 4)];
}

/**
 * Drehung eines geraden Spurstuecks: 0 laeuft von Nord nach Sued, 1 von West
 * nach Ost. Die Kurve dreht sich mit der Richtung, in die sie abknickt.
 */
function straightRotation(from: TileCoord, to: TileCoord): Rotation {
  return from.x === to.x ? 0 : 1;
}

function curveRotation(previous: TileCoord, pos: TileCoord, next: TileCoord): Rotation {
  const inDir = { x: pos.x - previous.x, y: pos.y - previous.y };
  const outDir = { x: next.x - pos.x, y: next.y - pos.y };
  // Vier Kombinationen, im Uhrzeigersinn durchnummeriert.
  if (inDir.y > 0 && outDir.x > 0) return 0;
  if (inDir.x < 0 && outDir.y > 0) return 1;
  if (inDir.y < 0 && outDir.x < 0) return 2;
  return 3;
}

/** Zeichnet eine Spur in das Bodenraster, Anfang bis Ende zusammenhaengend. */
export function drawTrace(floors: number[], size: number, path: readonly TileCoord[], set: TraceSet): void {
  path.forEach((pos, index) => {
    const at = pos.y * size + pos.x;
    const previous = path[index - 1];
    const next = path[index + 1];
    if (previous === undefined) {
      floors[at] = encodeTile(set.start, next === undefined ? 0 : straightRotation(pos, next));
      return;
    }
    if (next === undefined) {
      floors[at] = encodeTile(set.end, straightRotation(previous, pos));
      return;
    }
    const straight = previous.x === next.x || previous.y === next.y;
    floors[at] = straight
      ? encodeTile(set.straight, straightRotation(previous, next))
      : encodeTile(set.curve, curveRotation(previous, pos, next));
  });
}

/** Blutspur ab Zone 2, davor Staub und Oel. Der Unterschied ist Stimmung. */
export function traceSetFor(depth: number): TraceSet {
  return depth <= 4 ? DUST_TRACE : BLOOD_TRACE;
}

/**
 * Ein L-foermiger Weg von `from` nach `to`. Er endet an der ersten soliden
 * Kachel: eine Spur, die durch eine Wand springt, waere keine Spur mehr.
 */
export function tracePath(layout: Layout, from: TileCoord, to: TileCoord): TileCoord[] {
  const path: TileCoord[] = [];
  const free = (pos: TileCoord): boolean => layout.solid[pos.y * layout.size + pos.x] !== true;
  const stepX = from.x <= to.x ? 1 : -1;
  for (let x = from.x; x !== to.x + stepX; x += stepX) {
    const pos = { x, y: from.y };
    if (!free(pos)) return path;
    path.push(pos);
  }
  const stepY = from.y <= to.y ? 1 : -1;
  for (let y = from.y + stepY; y !== to.y + stepY; y += stepY) {
    const pos = { x: to.x, y };
    if (!free(pos)) return path;
    path.push(pos);
  }
  return path;
}

/** Freie Kacheln eines Raums, fuer Platzierungen. */
export function freeTiles(layout: Layout, room: Room): TileCoord[] {
  return roomTiles(room).filter((tile) => layout.solid[tile.y * layout.size + tile.x] !== true);
}
