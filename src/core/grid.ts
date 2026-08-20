/**
 * Raster, Sichtbarkeit und Bewegungsrichtungen nach SPEC 3.1 und 3.4.
 */
import { doorAt, enemyAt, isDoorBlocking } from './entities';
import { tempWallAt } from './tempWalls';
import type { Facing, MapDef, MapRuntimeState, TileCoord } from './types';

/** Kacheln ausserhalb der Karte gelten als solide Wand. */
const OUTSIDE_TILE = 1;

/** Kachelwert an einer Koordinate, ausserhalb der Karte immer solide. */
export function tileAt(map: MapDef, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return OUTSIDE_TILE;
  const tile = map.walls[y * map.width + x];
  // Ein zu kurzes walls-Array ist ein Datenfehler, wird hier als Wand behandelt.
  return tile ?? OUTSIDE_TILE;
}

/** Wand, temporaere Wand oder nicht offene Tuer (INTERFACES v1.2.1). */
export function isSolid(map: MapDef, x: number, y: number, state: MapRuntimeState): boolean {
  if (tileAt(map, x, y) !== 0) return true;
  if (tempWallAt(state, x, y) !== undefined) return true;
  const door = doorAt(state, x, y);
  return door !== undefined && isDoorBlocking(door);
}

/** Begehbar heisst zusaetzlich: kein lebender Gegner auf der Kachel. */
export function isWalkable(map: MapDef, x: number, y: number, state: MapRuntimeState): boolean {
  if (isSolid(map, x, y, state)) return false;
  return enemyAt(state, x, y) === undefined;
}

/** Chebyshev-Distanz in Kacheln, das Distanzmass des Spiels. */
export function chebyshev(a: TileCoord, b: TileCoord): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Manhattan-Distanz, Heuristik der Pfadsuche. */
export function manhattan(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Einheitsschritt in Blickrichtung. y waechst nach Sueden. */
export function facingDelta(facing: Facing): TileCoord {
  switch (facing) {
    case 0:
      return { x: 0, y: -1 };
    case 1:
      return { x: 1, y: 0 };
    case 2:
      return { x: 0, y: 1 };
    case 3:
      return { x: -1, y: 0 };
  }
}

/** Dreht eine Blickrichtung um `steps` Vierteldrehungen im Uhrzeigersinn. */
export function rotate(facing: Facing, steps: number): Facing {
  const index = (((facing + steps) % 4) + 4) % 4;
  // index liegt nach der doppelten Modulo-Rechnung sicher in 0..3.
  return index as Facing;
}

/** Zielkachel einer Bewegung. Seitwaerts- und Rueckwaertsschritte drehen nicht. */
export function stepFrom(
  pos: TileCoord,
  facing: Facing,
  dir: 'forward' | 'back' | 'left' | 'right'
): TileCoord {
  const steps = dir === 'forward' ? 0 : dir === 'right' ? 1 : dir === 'back' ? 2 : 3;
  const delta = facingDelta(rotate(facing, steps));
  return { x: pos.x + delta.x, y: pos.y + delta.y };
}

/**
 * Sichtlinie per Bresenham. Start- und Zielkachel blockieren nie, damit ein
 * Gegner in einem Tuerrahmen weiterhin sichtbar ist.
 */
export function hasLineOfSight(
  map: MapDef,
  from: TileCoord,
  to: TileCoord,
  state: MapRuntimeState
): boolean {
  let x = from.x;
  let y = from.y;
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);
  const sx = from.x < to.x ? 1 : -1;
  const sy = from.y < to.y ? 1 : -1;
  let err = dx - dy;

  for (;;) {
    if (x === to.x && y === to.y) return true;
    const doubled = 2 * err;
    if (doubled > -dy) {
      err -= dy;
      x += sx;
    }
    if (doubled < dx) {
      err += dx;
      y += sy;
    }
    if (x === to.x && y === to.y) return true;
    if (isSolid(map, x, y, state)) return false;
  }
}

/** Schluessel "x,y" fuer die Mengen in MapRuntimeState. */
export function tileKey(pos: TileCoord): string {
  return `${pos.x},${pos.y}`;
}

/** Umkehrung von tileKey. Wirft bei fehlerhaftem Schluessel. */
export function parseTileKey(key: string): TileCoord {
  const parts = key.split(',');
  const rawX = parts[0];
  const rawY = parts[1];
  if (parts.length !== 2 || rawX === undefined || rawY === undefined) {
    throw new Error(`malformed tile key: ${key}`);
  }
  const x = Number.parseInt(rawX, 10);
  const y = Number.parseInt(rawY, 10);
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error(`malformed tile key: ${key}`);
  }
  return { x, y };
}
