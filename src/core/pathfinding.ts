/**
 * A-Stern auf dem Raster nach SPEC 5.2: nur vier Nachbarn, Manhattan-Heuristik,
 * harte Grenze fuer besuchte Knoten.
 */
import { isWalkable, manhattan, parseTileKey, tileKey } from './grid';
import type { MapDef, MapRuntimeState, TileCoord } from './types';

type OpenNode = { key: string; pos: TileCoord; g: number; f: number };

function neighbors(pos: TileCoord): TileCoord[] {
  return [
    { x: pos.x, y: pos.y - 1 },
    { x: pos.x + 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x - 1, y: pos.y },
  ];
}

/** Nimmt den Knoten mit kleinstem f, bei Gleichstand den lexikografisch kleineren Schluessel. */
function popBest(open: OpenNode[]): OpenNode | undefined {
  if (open.length === 0) return undefined;
  let bestIndex = 0;
  let best = open[0];
  if (best === undefined) return undefined;
  for (let i = 1; i < open.length; i++) {
    const candidate = open[i];
    if (candidate === undefined) continue;
    if (candidate.f < best.f || (candidate.f === best.f && candidate.key < best.key)) {
      best = candidate;
      bestIndex = i;
    }
  }
  open.splice(bestIndex, 1);
  return best;
}

function reconstruct(cameFrom: Map<string, string>, goalKey: string, startKey: string): TileCoord[] {
  const path: TileCoord[] = [];
  let cursor = goalKey;
  while (cursor !== startKey) {
    path.push(parseTileKey(cursor));
    const previous = cameFrom.get(cursor);
    if (previous === undefined) return [];
    cursor = previous;
  }
  path.reverse();
  return path;
}

/**
 * Pfad von `from` nach `to`. Der erste Eintrag ist das erste Feld nach `from`,
 * der letzte ist `to`. Kein Pfad oder mehr als `maxNodes` besuchte Knoten liefert null.
 */
export function findPath(
  map: MapDef,
  from: TileCoord,
  to: TileCoord,
  state: MapRuntimeState,
  maxNodes = 200
): TileCoord[] | null {
  const startKey = tileKey(from);
  const goalKey = tileKey(to);
  if (startKey === goalKey) return [];

  const open: OpenNode[] = [{ key: startKey, pos: from, g: 0, f: manhattan(from, to) }];
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startKey, 0]]);
  const closed = new Set<string>();
  let visited = 0;

  for (;;) {
    const current = popBest(open);
    if (current === undefined) return null;
    if (current.key === goalKey) return reconstruct(cameFrom, goalKey, startKey);
    if (closed.has(current.key)) continue;
    closed.add(current.key);
    visited += 1;
    if (visited > maxNodes) return null;

    for (const next of neighbors(current.pos)) {
      const nextKey = tileKey(next);
      if (closed.has(nextKey)) continue;
      if (!isWalkable(map, next.x, next.y, state)) continue;
      const tentative = current.g + 1;
      const known = gScore.get(nextKey);
      if (known !== undefined && tentative >= known) continue;
      gScore.set(nextKey, tentative);
      cameFrom.set(nextKey, current.key);
      open.push({ key: nextKey, pos: next, g: tentative, f: tentative + manhattan(next, to) });
    }
  }
}
