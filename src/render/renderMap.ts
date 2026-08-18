/**
 * Sicht des Renderers auf eine Karte: flache typisierte Arrays, in denen
 * geschlossene Tueren bereits als Wand eingetragen sind. Wird bei jedem
 * setState neu gebaut, der Spielzustand bleibt dabei unangetastet.
 */
import { generateLightMap } from '../core/lighting';
import type { MapDef, MapRuntimeState } from '../core/types';

export type RenderMap = {
  width: number;
  height: number;
  walls: Int32Array;
  floors: Int32Array;
  ceilings: Int32Array;
  light: Uint8Array;
  ambientLight: number;
};

export function createRenderMap(
  map: MapDef,
  mapState: MapRuntimeState,
  doorTileValue: number
): RenderMap {
  const size = map.width * map.height;
  const walls = Int32Array.from(map.walls);
  const floors = Int32Array.from(map.floors);
  const ceilings = Int32Array.from(map.ceilings);

  // INTERFACES Abschnitt 6: fehlt light, wird es aus den Lampen erzeugt.
  const source = map.light.length === size ? map.light : generateLightMap(map.width, map.height, map.walls, map.lamps);
  const light = Uint8Array.from(source);

  for (const entity of mapState.entities) {
    if (entity.kind !== 'door' || entity.state === 'open') continue;
    const index = entity.pos.y * map.width + entity.pos.x;
    if (index < 0 || index >= size) continue;
    walls[index] = doorTileValue;
  }

  return { width: map.width, height: map.height, walls, floors, ceilings, light, ambientLight: map.ambientLight };
}
