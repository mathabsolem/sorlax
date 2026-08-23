/**
 * Graph ueber die Raeume einer Karte, PHASE_6 Block 3.
 *
 * Start und Ausgang liegen an den Enden des laengsten Weges, Tueren sitzen auf
 * dem Weg dazwischen, und der Schluessel muss ohne diese Tueren erreichbar
 * sein. Alles davon ist eine Frage an denselben Graphen.
 */
import type { Edge, Layout } from './mapGeometry.ts';
import type { TileCoord } from '../src/core/types.ts';

export type Graph = Map<number, { to: number; edge: number }[]>;

/** Nachbarschaftsliste, optional ohne die genannten Kanten. */
export function graphOf(layout: Layout, without: readonly number[] = []): Graph {
  const graph: Graph = new Map();
  for (let index = 0; index < layout.rooms.length; index++) graph.set(index, []);
  layout.edges.forEach((edge, index) => {
    if (without.includes(index)) return;
    graph.get(edge.a)?.push({ to: edge.b, edge: index });
    graph.get(edge.b)?.push({ to: edge.a, edge: index });
  });
  return graph;
}

/** Abstand in Kanten von `from` zu jedem erreichbaren Raum. */
export function distances(graph: Graph, from: number): Map<number, number> {
  const seen = new Map<number, number>([[from, 0]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const room = queue[head];
    if (room === undefined) continue;
    for (const step of graph.get(room) ?? []) {
      if (seen.has(step.to)) continue;
      seen.set(step.to, (seen.get(room) ?? 0) + 1);
      queue.push(step.to);
    }
  }
  return seen;
}

/** Die beiden Raeume mit dem groessten Abstand zueinander. */
export function farthestPair(graph: Graph, count: number): { start: number; exit: number } {
  let best = { start: 0, exit: count > 1 ? 1 : 0, d: -1 };
  for (let room = 0; room < count; room++) {
    for (const [other, d] of distances(graph, room)) {
      if (d > best.d) best = { start: room, exit: other, d };
    }
  }
  return { start: best.start, exit: best.exit };
}

/** Weg von `from` nach `to` als Folge von Kantenindizes. */
export function pathEdges(graph: Graph, from: number, to: number): number[] {
  const parent = new Map<number, { room: number; edge: number }>();
  const queue = [from];
  const seen = new Set([from]);
  for (let head = 0; head < queue.length; head++) {
    const room = queue[head];
    if (room === undefined) continue;
    if (room === to) break;
    for (const step of graph.get(room) ?? []) {
      if (seen.has(step.to)) continue;
      seen.add(step.to);
      parent.set(step.to, { room, edge: step.edge });
      queue.push(step.to);
    }
  }

  const edges: number[] = [];
  let cursor = to;
  while (cursor !== from) {
    const step = parent.get(cursor);
    if (step === undefined) return [];
    edges.unshift(step.edge);
    cursor = step.room;
  }
  return edges;
}

/** Raeume, die von `from` aus ohne die genannten Kanten erreichbar sind. */
export function reachableRooms(
  layout: Layout,
  from: number,
  without: readonly number[]
): Set<number> {
  return new Set(distances(graphOf(layout, without), from).keys());
}

/** Die Kachel, an der ein Korridor den Raum `room` verlaesst. */
export function doorTile(edge: Edge, room: number): TileCoord {
  return edge.a === room ? edge.doorSpots[0] : edge.doorSpots[1];
}

/**
 * Erreichbare Kacheln vom Start aus. `blocked` sind Kacheln, die als solide
 * gelten, etwa die Tueren, die auf diesem Weg nicht benutzt werden duerfen.
 *
 * Der Raumgraph reicht dafuer nicht: Korridore laufen durch andere Raeume und
 * kreuzen sich, eine Tuer sperrt deshalb mehr als ihre eigene Kante.
 */
export function reachableTiles(
  layout: Layout,
  from: TileCoord,
  blocked: readonly TileCoord[]
): Map<number, number> {
  const size = layout.size;
  const shut = new Set(blocked.map((pos) => pos.y * size + pos.x));
  const start = from.y * size + from.x;
  const seen = new Map<number, number>();
  if (layout.solid[start] === true || shut.has(start)) return seen;

  seen.set(start, 0);
  const queue = [start];
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (index === undefined) continue;
    const x = index % size;
    const y = (index - x) / size;
    for (const next of [
      x > 0 ? index - 1 : -1,
      x < size - 1 ? index + 1 : -1,
      y > 0 ? index - size : -1,
      y < size - 1 ? index + size : -1,
    ]) {
      if (next < 0 || seen.has(next) || shut.has(next)) continue;
      if (layout.solid[next] === true) continue;
      seen.set(next, (seen.get(index) ?? 0) + 1);
      queue.push(next);
    }
  }
  return seen;
}
