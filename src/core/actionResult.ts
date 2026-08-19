/**
 * Gemeinsames Ergebnisformat der Spieleraktionen und der Kartenzugriff dazu.
 * `ok: false` fuehrt in applyCommand zu genau einem `invalid`-Ereignis.
 */
import type { ContentDb, GameEvent, GameState, MapDef, MapRuntimeState } from './types';

export type ActionResult = { ok: true; events: GameEvent[] } | { ok: false; reason: string };

/** Karte und Laufzeitzustand der aktuellen Sohle, oder null bei kaputtem Zustand. */
export function currentScene(
  state: GameState,
  content: ContentDb
): { map: MapDef; mapState: MapRuntimeState } | null {
  const map = content.maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  if (map === undefined || mapState === undefined) return null;
  return { map, mapState };
}
