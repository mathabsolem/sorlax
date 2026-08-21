/**
 * Reine Geometrie der Automap, PHASE_4 Block 5.
 * Liefert Kanten und Marken; das Zeichnen liegt in automap.ts.
 */
import { isSolid, tileKey } from '../core/grid';
import type { Facing, GameState, MapDef, MapRuntimeState, TileCoord } from '../core/types';

/** Eine Wandkante zwischen einer erkundeten Kachel und einer soliden Nachbarin. */
export type WallEdge = {
  x: number;
  y: number;
  side: 'north' | 'east' | 'south' | 'west';
};

export type DoorMark = { pos: TileCoord; locked: string | null; open: boolean };

export type AutomapTiles = {
  floors: TileCoord[];
  walls: WallEdge[];
  doors: DoorMark[];
  exits: TileCoord[];
  player: { pos: TileCoord; facing: Facing };
};

const SIDES: { side: WallEdge['side']; dx: number; dy: number }[] = [
  { side: 'north', dx: 0, dy: -1 },
  { side: 'east', dx: 1, dy: 0 },
  { side: 'south', dx: 0, dy: 1 },
  { side: 'west', dx: -1, dy: 0 },
];

/**
 * Alles Zeichenbare einer Karte, beschraenkt auf `explored`.
 *
 * Eine Kante entsteht dort, wo eine erkundete, begehbare Kachel an eine solide
 * grenzt. Damit erscheint der Umriss eines Raums, nicht jede einzelne Wand.
 */
export function automapTiles(
  map: MapDef,
  mapState: MapRuntimeState,
  player: { pos: TileCoord; facing: Facing }
): AutomapTiles {
  const explored = new Set(mapState.explored);
  const floors: TileCoord[] = [];
  const walls: WallEdge[] = [];
  const doors: DoorMark[] = [];

  for (const key of mapState.explored) {
    const parts = key.split(',');
    const x = Number.parseInt(parts[0] ?? '', 10);
    const y = Number.parseInt(parts[1] ?? '', 10);
    if (!Number.isInteger(x) || !Number.isInteger(y)) continue;

    const door = mapState.entities.find(
      (entity) => entity.kind === 'door' && entity.pos.x === x && entity.pos.y === y
    );
    if (door !== undefined) {
      const definition = map.entities.find(
        (candidate) =>
          candidate.kind === 'door' && candidate.pos.x === x && candidate.pos.y === y
      );
      doors.push({
        pos: { x, y },
        locked: definition?.locked ?? null,
        open: door.state === 'open',
      });
    }

    // Solide Kacheln sind der Rand des Bekannten und bekommen keinen Boden.
    if (isSolid(map, x, y, mapState) && door === undefined) continue;
    floors.push({ x, y });

    for (const { side, dx, dy } of SIDES) {
      if (!isSolid(map, x + dx, y + dy, mapState)) continue;
      walls.push({ x, y, side });
    }
  }

  const exits = map.exits
    .filter((exit) => explored.has(tileKey(exit.pos)))
    .map((exit) => ({ x: exit.pos.x, y: exit.pos.y }));

  return { floors, walls, doors, exits, player: { pos: { ...player.pos }, facing: player.facing } };
}

/** Bequemer Zugriff auf die aktuelle Sohle. Null bei kaputtem Zustand. */
export function automapForState(state: GameState, maps: Record<string, MapDef>): AutomapTiles | null {
  const map = maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  if (map === undefined || mapState === undefined) return null;
  return automapTiles(map, mapState, { pos: state.player.pos, facing: state.player.facing });
}
