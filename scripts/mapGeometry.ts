/**
 * Geometrie des Kartengenerators, PHASE_6 Block 2.
 *
 * Raeume setzen, dann verbinden. Kein BSP, weil dessen Ergebnisse zu
 * regelmaessig aussehen. Alles hier arbeitet auf einem Rechteckraster aus
 * `true` fuer solide und `false` fuer frei; Texturen kommen spaeter dazu.
 */
import type { Rng } from '../src/core/rng.ts';
import type { TileCoord } from '../src/core/types.ts';

export type Room = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Edge = {
  a: number;
  b: number;
  /** Die beiden Kacheln, an denen der Korridor die Raeume verlaesst. */
  doorSpots: [TileCoord, TileCoord];
};

export type Layout = {
  size: number;
  solid: boolean[];
  rooms: Room[];
  edges: Edge[];
  /** Kacheln, die zu einem Korridor gehoeren und zu keinem Raum. */
  corridor: boolean[];
};

export function center(room: Room): TileCoord {
  return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
}

export function roomTiles(room: Room): TileCoord[] {
  const tiles: TileCoord[] = [];
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) tiles.push({ x, y });
  }
  return tiles;
}

/** Liegt die Kachel in diesem Raum? */
export function inRoom(room: Room, pos: TileCoord): boolean {
  return pos.x >= room.x && pos.x < room.x + room.w && pos.y >= room.y && pos.y < room.y + room.h;
}

/** Zwei Raeume brauchen mindestens zwei Kacheln Abstand, PHASE_6 Block 2. */
function tooClose(a: Room, b: Room): boolean {
  return (
    a.x - 2 < b.x + b.w && b.x - 2 < a.x + a.w && a.y - 2 < b.y + b.h && b.y - 2 < a.y + a.h
  );
}

/** Setzt bis zu `count` Raeume. Wer nach 200 Versuchen nicht passt, entfaellt. */
export function placeRooms(rng: Rng, size: number, count: number): Room[] {
  const rooms: Room[] = [];
  for (let index = 0; index < count; index++) {
    for (let attempt = 0; attempt < 200; attempt++) {
      const w = rng.randInt(4, 10);
      const h = rng.randInt(4, 8);
      // Der Kartenrand bleibt solide, deshalb beginnt der Platz bei 1.
      const room: Room = {
        x: rng.randInt(1, size - w - 2),
        y: rng.randInt(1, size - h - 2),
        w,
        h,
      };
      if (rooms.some((other) => tooClose(room, other))) continue;
      rooms.push(room);
      break;
    }
  }
  return rooms;
}

function manhattan(a: TileCoord, b: TileCoord): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Minimaler Spannbaum ueber die Raummittelpunkte, danach 20 Prozent der
 * uebrigen Kanten. Ohne die Zusatzkanten waere jede Karte ein Baum und jeder
 * Weg eindeutig.
 */
export function connect(rng: Rng, rooms: Room[]): { a: number; b: number }[] {
  if (rooms.length < 2) return [];
  const centers = rooms.map(center);
  const inTree = new Set<number>([0]);
  const edges: { a: number; b: number }[] = [];

  while (inTree.size < rooms.length) {
    let best: { a: number; b: number; d: number } | null = null;
    for (const a of inTree) {
      for (let b = 0; b < rooms.length; b++) {
        if (inTree.has(b)) continue;
        const centerA = centers[a];
        const centerB = centers[b];
        if (centerA === undefined || centerB === undefined) continue;
        const d = manhattan(centerA, centerB);
        if (best === null || d < best.d) best = { a, b, d };
      }
    }
    if (best === null) break;
    edges.push({ a: best.a, b: best.b });
    inTree.add(best.b);
  }

  const rest: { a: number; b: number }[] = [];
  for (let a = 0; a < rooms.length; a++) {
    for (let b = a + 1; b < rooms.length; b++) {
      if (edges.some((edge) => (edge.a === a && edge.b === b) || (edge.a === b && edge.b === a))) {
        continue;
      }
      rest.push({ a, b });
    }
  }
  // Feste Reihenfolge: nach Distanz, damit der Wurf reproduzierbar bleibt.
  rest.sort((one, other) => {
    const centerOneA = centers[one.a];
    const centerOneB = centers[one.b];
    const centerOtherA = centers[other.a];
    const centerOtherB = centers[other.b];
    if (
      centerOneA === undefined ||
      centerOneB === undefined ||
      centerOtherA === undefined ||
      centerOtherB === undefined
    ) {
      return 0;
    }
    return manhattan(centerOneA, centerOneB) - manhattan(centerOtherA, centerOtherB);
  });

  const extra = Math.floor(rest.length * 0.2);
  for (let index = 0; index < extra; index++) {
    const pick = rest[rng.randInt(0, rest.length - 1)];
    if (pick === undefined) continue;
    if (edges.some((edge) => edge.a === pick.a && edge.b === pick.b)) continue;
    edges.push(pick);
  }
  return edges;
}

/** Traegt einen L-foermigen Korridor der Breite 1 ein. */
function carveCorridor(
  layout: Layout,
  from: TileCoord,
  to: TileCoord,
  horizontalFirst: boolean
): TileCoord[] {
  const tiles: TileCoord[] = [];
  const put = (x: number, y: number): void => {
    const index = y * layout.size + x;
    if (x <= 0 || y <= 0 || x >= layout.size - 1 || y >= layout.size - 1) return;
    tiles.push({ x, y });
    if (layout.solid[index] === true) {
      layout.solid[index] = false;
      layout.corridor[index] = true;
    }
  };

  if (horizontalFirst) {
    for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++) put(x, from.y);
    for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y++) put(to.x, y);
  } else {
    for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y++) put(from.x, y);
    for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x++) put(x, to.y);
  }
  return tiles;
}

/** Erste Korridorkachel ausserhalb des Raums, von seinem Mittelpunkt aus. */
function doorSpot(room: Room, tiles: TileCoord[]): TileCoord {
  const outside = tiles.find((tile) => !inRoom(room, tile));
  return outside ?? center(room);
}

/** Baut das Raster aus Raeumen und Korridoren. */
export function buildLayout(rng: Rng, size: number, roomCount: number): Layout {
  const layout: Layout = {
    size,
    solid: new Array<boolean>(size * size).fill(true),
    corridor: new Array<boolean>(size * size).fill(false),
    rooms: placeRooms(rng, size, roomCount),
    edges: [],
  };

  for (const room of layout.rooms) {
    for (const tile of roomTiles(room)) layout.solid[tile.y * size + tile.x] = false;
  }

  for (const edge of connect(rng, layout.rooms)) {
    const roomA = layout.rooms[edge.a];
    const roomB = layout.rooms[edge.b];
    if (roomA === undefined || roomB === undefined) continue;
    const tiles = carveCorridor(layout, center(roomA), center(roomB), rng.next() < 0.5);
    layout.edges.push({
      a: edge.a,
      b: edge.b,
      doorSpots: [doorSpot(roomA, tiles), doorSpot(roomB, [...tiles].reverse())],
    });
  }

  return layout;
}

/** Bossarena: ein Zugangskorridor von acht Kacheln, dann die Halle. */
export function buildArena(size: number): Layout {
  const layout: Layout = {
    size,
    solid: new Array<boolean>(size * size).fill(true),
    corridor: new Array<boolean>(size * size).fill(false),
    rooms: [],
    edges: [],
  };
  const free = (x: number, y: number): void => {
    layout.solid[y * size + x] = false;
  };

  // Halle von mindestens 16 x 16 Kacheln, mittig gesetzt.
  const hall: Room = { x: 4, y: 2, w: size - 8, h: size - 12 };
  for (const tile of roomTiles(hall)) free(tile.x, tile.y);

  // Zugang: acht Kacheln von der Suedkante zur Halle.
  const corridorX = Math.floor(size / 2);
  const corridorTop = hall.y + hall.h;
  for (let step = 0; step < 8; step++) {
    const y = corridorTop + step;
    if (y >= size - 1) break;
    free(corridorX, y);
    layout.corridor[y * size + corridorX] = true;
  }

  const entry: Room = { x: corridorX, y: corridorTop, w: 1, h: 8 };
  layout.rooms = [entry, hall];
  layout.edges = [
    {
      a: 0,
      b: 1,
      doorSpots: [
        { x: corridorX, y: corridorTop },
        { x: corridorX, y: corridorTop - 1 },
      ],
    },
  ];

  // Vier Stuetzpfeiler als Deckung, PHASE_6 Block 2.
  const insetX = hall.x + Math.floor(hall.w / 4);
  const insetY = hall.y + Math.floor(hall.h / 4);
  for (const pillar of [
    { x: insetX, y: insetY },
    { x: hall.x + hall.w - 1 - Math.floor(hall.w / 4), y: insetY },
    { x: insetX, y: hall.y + hall.h - 1 - Math.floor(hall.h / 4) },
    {
      x: hall.x + hall.w - 1 - Math.floor(hall.w / 4),
      y: hall.y + hall.h - 1 - Math.floor(hall.h / 4),
    },
  ]) {
    layout.solid[pillar.y * size + pillar.x] = true;
  }

  return layout;
}
