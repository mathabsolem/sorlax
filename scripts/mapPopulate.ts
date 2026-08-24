/**
 * Tueren, Schluessel, Ausgang, Gegner und Beute, PHASE_6 Block 3 und 6.
 */
import { Rng } from '../src/core/rng.ts';
import type { EnemyDef, ItemDef, MapDef, MapEntityDef, TileCoord, TriggerDef } from '../src/core/types.ts';
import { freeTiles } from './mapDecor.ts';
import { center } from './mapGeometry.ts';
import type { Layout } from './mapGeometry.ts';
import { doorTile, farthestPair, graphOf, pathEdges, reachableTiles } from './mapGraph.ts';
import { BOSS_DEPTHS, WEAPON_FINDS } from './mapTables.ts';
import type { Zone } from './mapTables.ts';
import { DEPTH_PLAN } from './canonical.ts';

export type Plan = {
  start: number;
  exit: number;
  /** Kantenindizes der verriegelten Tueren. */
  lockedEdges: number[];
  entities: MapEntityDef[];
  triggers: TriggerDef[];
  exits: MapDef['exits'];
  /** Raum hinter der Geheimtuer, -1 wenn keine gesetzt wurde. */
  secretRoom: number;
};

/** Kanten an Sackgassen zuerst: dort ist die Geheimtuer am unauffaelligsten. */
function rankOf(layout: Layout, degree: Map<number, number>, index: number): number {
  const edge = layout.edges[index];
  if (edge === undefined) return 9;
  return Math.min(degree.get(edge.a) ?? 9, degree.get(edge.b) ?? 9);
}

/**
 * Schneidet eine Tuer an dieser Stelle mehr ab als den Raum `only`?
 * Geprueft auf Kachelebene, denn Korridore kreuzen fremde Raeume.
 */
function cutsOffMoreThan(layout: Layout, spawn: TileCoord, pos: TileCoord, only: number): boolean {
  const reach = reachableTiles(layout, spawn, [pos]);
  return layout.rooms.some((room, index) => {
    if (index === only) return false;
    return !freeTiles(layout, room).some((tile) => reach.has(tile.y * layout.size + tile.x));
  });
}

/** Zahl der Tueren auf dem kritischen Pfad, PHASE_6 Block 3. */
function doorCount(depth: number): number {
  return depth >= 5 ? 2 : 1;
}

function tileTaken(entities: readonly MapEntityDef[], pos: TileCoord): boolean {
  return entities.some((entity) => entity.pos.x === pos.x && entity.pos.y === pos.y);
}

/**
 * Setzt Tueren, Schluessel, Geheimtuer und Ausgang.
 *
 * Der Schluessel liegt in einem Raum, den der Spieler ohne jede verriegelte
 * Tuer erreicht. Das prueft der Generator selbst, nicht erst der Validator.
 */
export function planLayout(rng: Rng, layout: Layout, depth: number, zone: Zone): Plan {
  const graph = graphOf(layout);
  const { start, exit } = farthestPair(graph, layout.rooms.length);
  const path = pathEdges(graph, start, exit);
  const entities: MapEntityDef[] = [];
  const triggers: TriggerDef[] = [];
  const spawn = center(layout.rooms[start] ?? { x: 1, y: 1, w: 1, h: 1 });

  /** Taugt die Kachel als Tuerstelle? Nicht im Nichts und nicht auf dem Start. */
  const usable = (pos: TileCoord): boolean =>
    pos.x >= 0 &&
    pos.y >= 0 &&
    layout.solid[pos.y * layout.size + pos.x] !== true &&
    !(pos.x === spawn.x && pos.y === spawn.y) &&
    !tileTaken(entities, pos);

  // Tueren sitzen in der zweiten Haelfte des Weges, damit vor der ersten Tuer
  // genug Raum fuer den Schluessel bleibt.
  const wanted = Math.min(doorCount(depth), path.length);
  const lockedEdges: number[] = [];
  for (let index = 0; index < wanted; index++) {
    const at = Math.min(path.length - 1, Math.floor((path.length * (index + 2)) / (wanted + 2)));
    const edgeIndex = path[at];
    if (edgeIndex === undefined || lockedEdges.includes(edgeIndex)) continue;
    lockedEdges.push(edgeIndex);
  }

  for (const edgeIndex of lockedEdges) {
    const edge = layout.edges[edgeIndex];
    if (edge === undefined) continue;
    const pos = [doorTile(edge, edge.a), doorTile(edge, edge.b)].find(usable);
    if (pos === undefined) continue;
    entities.push({ kind: 'door', defId: 'door', pos, locked: zone.keyId });
  }

  // Geheimtuer: eine Kante abseits des kritischen Pfades, dahinter der Raum
  // mit dem erhoehten Beutewurf. Der Schalter liegt in einem anderen Raum.
  // Probiert werden alle in Frage kommenden Kanten und beide Enden, sonst
  // bliebe eine Karte ohne Geheimtuer, sobald der erste Platz belegt ist.
  let secretRoom = -1;
  // Zuerst die Kanten, die an einem Raum mit nur einem Zugang haengen: dort
  // sperrt die Tuer sicher nur diesen einen Raum ab.
  const degree = new Map<number, number>();
  for (const edge of layout.edges) {
    degree.set(edge.a, (degree.get(edge.a) ?? 0) + 1);
    degree.set(edge.b, (degree.get(edge.b) ?? 0) + 1);
  }
  const candidates = layout.edges
    .map((_edge, index) => index)
    .filter((index) => !path.includes(index))
    .sort((one, other) => rankOf(layout, degree, one) - rankOf(layout, degree, other));

  for (const index of candidates) {
    if (secretRoom >= 0) break;
    const edge = layout.edges[index];
    if (edge === undefined) continue;
    for (const room of [edge.b, edge.a]) {
      const pos = doorTile(edge, room);
      if (!usable(pos)) continue;
      // Hinter der Geheimtuer darf nur der eine Raum liegen. Sitzt sie auf
      // einem Korridor, den auch andere Raeume brauchen, sperrt sie die halbe
      // Karte, und Schluessel wie Ausgang rutschen in den Startraum.
      if (cutsOffMoreThan(layout, spawn, pos, room)) continue;
      entities.push({ kind: 'door', defId: 'door', pos, secret: true });
      secretRoom = room;

      const switchRoom = layout.rooms[start];
      const tiles = switchRoom === undefined ? [] : freeTiles(layout, switchRoom);
      const switchPos = tiles.find((tile) => !tileTaken(entities, tile));
      if (switchPos !== undefined) {
        triggers.push({
          id: `switch_${depth}`,
          pos: switchPos,
          on: 'use',
          once: true,
          actions: [
            { type: 'openDoor', pos },
            { type: 'message', text: 'Irgendwo öffnet sich eine Wand.' },
          ],
        });
      }
      break;
    }
  }

  // Je verriegelter Tuer ein Schluessel, CONTENT_TABLES v1.2 Abschnitt 7.
  // Schluessel `i` liegt dort, wo der Spieler steht, wenn er die Tueren davor
  // schon geoeffnet hat und die uebrigen noch verschlossen sind. Damit gibt es
  // immer eine Reihenfolge, die aufgeht.
  //
  // Gerechnet wird auf Kachelebene, denn Korridore kreuzen fremde Raeume, und
  // eine Tuer sperrt damit mehr als ihre eigene Kante im Raumgraphen.
  const lockedTiles = entities
    .filter((entity) => entity.kind === 'door' && entity.locked !== undefined)
    .map((entity) => entity.pos);
  const secretTiles = entities
    .filter((entity) => entity.kind === 'door' && entity.secret === true)
    .map((entity) => entity.pos);

  for (let index = 0; index < lockedTiles.length; index++) {
    const shut = [...secretTiles, ...lockedTiles.slice(index)];
    const reach = reachableTiles(layout, spawn, shut);
    const candidates = layout.rooms
      .flatMap((room, roomIndex) => (roomIndex === start ? [] : freeTiles(layout, room)))
      .filter((tile) => reach.has(tile.y * layout.size + tile.x) && !tileTaken(entities, tile));
    const fallback = freeTiles(layout, layout.rooms[start] ?? { x: 1, y: 1, w: 1, h: 1 }).filter(
      (tile) => reach.has(tile.y * layout.size + tile.x) && !tileTaken(entities, tile)
    );
    const pool = candidates.length > 0 ? candidates : fallback;
    const pos = pool[rng.randInt(0, pool.length - 1)];
    if (pos !== undefined) entities.push({ kind: 'item', defId: zone.keyId, pos });
  }

  // Der Ausgang: die am weitesten entfernte Raumkachel, die mit Schluessel
  // erreichbar ist. Die Geheimtuer zaehlt dabei als Wand, hinter ihr liegt nur
  // Zusatzbeute.
  const withKey = reachableTiles(layout, spawn, secretTiles);
  const exits: MapDef['exits'] = [];
  if (depth < 16) {
    let bestPos: TileCoord | null = null;
    let bestScore = -1;
    layout.rooms.forEach((room, index) => {
      // Der Ausgang gehoert nicht in den Startraum, sonst endet die Sohle im
      // ersten Schritt.
      if (index === start) return;
      for (const tile of freeTiles(layout, room)) {
        if (tileTaken(entities, tile)) continue;
        const d = withKey.get(tile.y * layout.size + tile.x);
        if (d === undefined) continue;
        // Der Raum am Ende des laengsten Weges wird bevorzugt.
        const score = d + (index === exit ? layout.size : 0);
        if (score > bestScore) {
          bestScore = score;
          bestPos = tile;
        }
      }
    });
    if (bestPos !== null) exits.push({ pos: bestPos, targetMapId: mapIdFor(depth + 1) });
  }

  return { start, exit, lockedEdges, entities, triggers, exits, secretRoom };
}

/** Dateiname und Karten-Id einer Sohle. */
export function mapIdFor(depth: number): string {
  return `sohle_${String(depth).padStart(2, '0')}`;
}

/** Zahl der Gegner einer Sohle, PHASE_6 Block 6. */
export function enemyCount(depth: number): number {
  return Math.min(26, 8 + depth);
}

/** Grenzt die Kachel an eine Wand? Bedingung fuer `turret`. */
function nextToWall(layout: Layout, pos: TileCoord): boolean {
  return [
    { x: pos.x - 1, y: pos.y },
    { x: pos.x + 1, y: pos.y },
    { x: pos.x, y: pos.y - 1 },
    { x: pos.x, y: pos.y + 1 },
  ].some((step) => layout.solid[step.y * layout.size + step.x] === true);
}

/**
 * Verteilt die Gegner des Sohlenplans. Der Startraum und seine Nachbarn
 * bleiben frei, je Raum stehen hoechstens vier.
 */
export function placeEnemies(
  rng: Rng,
  layout: Layout,
  depth: number,
  enemies: Record<string, EnemyDef>,
  plan: Plan,
  taken: MapEntityDef[]
): MapEntityDef[] {
  const bossId = BOSS_DEPTHS[depth];
  if (bossId !== undefined) return placeBoss(layout, bossId, taken);

  const kinds = DEPTH_PLAN[depth] ?? [];
  if (kinds.length === 0) return [];

  const graph = graphOf(layout);
  const forbidden = new Set<number>([plan.start]);
  for (const step of graph.get(plan.start) ?? []) forbidden.add(step.to);

  const placed: MapEntityDef[] = [];
  const perRoom = new Map<number, number>();
  const wanted = enemyCount(depth);

  for (let attempt = 0; attempt < wanted * 40 && placed.length < wanted; attempt++) {
    const roomIndex = rng.randInt(0, layout.rooms.length - 1);
    if (forbidden.has(roomIndex)) continue;
    if ((perRoom.get(roomIndex) ?? 0) >= 4) continue;
    const room = layout.rooms[roomIndex];
    if (room === undefined) continue;

    const defId = kinds[rng.randInt(0, kinds.length - 1)];
    const def = defId === undefined ? undefined : enemies[defId];
    if (defId === undefined || def === undefined) continue;

    const tiles = freeTiles(layout, room).filter(
      (tile) => !tileTaken(taken, tile) && !tileTaken(placed, tile)
    );
    const candidates =
      def.behavior === 'turret' ? tiles.filter((tile) => nextToWall(layout, tile)) : tiles;
    const pos = candidates[rng.randInt(0, candidates.length - 1)];
    if (pos === undefined) continue;

    placed.push({ kind: 'enemy', defId, pos });
    perRoom.set(roomIndex, (perRoom.get(roomIndex) ?? 0) + 1);
  }
  return placed;
}

/** Auf einer Bosskarte steht nur der Boss, mittig in der Halle. */
function placeBoss(layout: Layout, bossId: string, taken: MapEntityDef[]): MapEntityDef[] {
  const hall = layout.rooms[1];
  if (hall === undefined) return [];
  const tiles = freeTiles(layout, hall).filter((tile) => !tileTaken(taken, tile));
  const middle = center(hall);
  const pos =
    tiles.find((tile) => tile.x === middle.x && tile.y === middle.y) ?? tiles[0] ?? middle;
  return [{ kind: 'enemy', defId: bossId, pos, forceRank: 'boss' }];
}

/**
 * Fundstuecke: die Waffe dieser Sohle abseits des kritischen Pfades, dazu drei
 * bis sechs Stapelgueter. Welche Stapelgueter zur Zone passen, steht nicht in
 * einer eigenen Tabelle; genommen wird, was die Gegner dieser Sohle fallen
 * lassen, dazu der Notverband.
 */
export function placeItems(
  rng: Rng,
  layout: Layout,
  depth: number,
  enemies: Record<string, EnemyDef>,
  items: Record<string, ItemDef>,
  plan: Plan,
  taken: MapEntityDef[]
): MapEntityDef[] {
  const placed: MapEntityDef[] = [];
  const graph = graphOf(layout);
  const critical = new Set<number>([plan.start, plan.exit]);
  for (const edgeIndex of pathEdges(graph, plan.start, plan.exit)) {
    const edge = layout.edges[edgeIndex];
    if (edge !== undefined) {
      critical.add(edge.a);
      critical.add(edge.b);
    }
  }

  const put = (defId: string, roomIndex: number): void => {
    const room = layout.rooms[roomIndex];
    if (room === undefined) return;
    const tiles = freeTiles(layout, room).filter(
      (tile) => !tileTaken(taken, tile) && !tileTaken(placed, tile)
    );
    const pos = tiles[rng.randInt(0, tiles.length - 1)];
    if (pos !== undefined) placed.push({ kind: 'item', defId, pos });
  };

  const weapon = WEAPON_FINDS[depth];
  if (weapon !== undefined && items[weapon] !== undefined) {
    const aside = layout.rooms
      .map((_room, index) => index)
      .filter((index) => !critical.has(index));
    put(weapon, aside[rng.randInt(0, aside.length - 1)] ?? plan.exit);
  }

  const pool = new Set<string>(['heal_small']);
  for (const defId of DEPTH_PLAN[depth] ?? []) {
    for (const drop of enemies[defId]?.drops ?? []) pool.add(drop.defId);
  }
  const stock = [...pool].sort();
  const count = rng.randInt(3, 6);
  for (let index = 0; index < count; index++) {
    const defId = stock[rng.randInt(0, stock.length - 1)];
    if (defId === undefined) continue;
    put(defId, rng.randInt(0, layout.rooms.length - 1));
  }

  return placed;
}
