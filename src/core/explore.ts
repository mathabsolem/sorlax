/**
 * Aufdecken der Karte fuer die Automap, PHASE_4 Block 5.
 *
 * Der einzige Eingriff in `core` in Phase 4. Die Oberflaeche liest `explored`,
 * sie fuellt es nie selbst: jede Zustandsaenderung laeuft ueber applyCommand.
 */
import { hasLineOfSight, tileKey } from './grid';
import { playerDerived } from './turn';
import type { ContentDb, GameState, TileCoord } from './types';

/**
 * Zuschlag auf die Sichtweite. Der Spieler erkennt den Umriss eines Raums
 * etwas weiter, als seine Lampe ihn ausleuchtet.
 */
export const EXPLORE_MARGIN = 2;

/** Reichweite des Aufdeckens: Sichtweite plus Zuschlag. */
export function exploreRadius(state: GameState, content: ContentDb): number {
  return playerDerived(state, content).lightRadius + EXPLORE_MARGIN;
}

/**
 * Ergaenzt alle Kacheln in Sichtlinie innerhalb der Reichweite.
 * Liefert die neu aufgedeckten Kacheln; ein zweiter Aufruf ohne Bewegung
 * liefert eine leere Liste.
 */
export function updateExplored(state: GameState, content: ContentDb): TileCoord[] {
  const map = content.maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  if (map === undefined || mapState === undefined) return [];

  const radius = exploreRadius(state, content);
  const known = new Set(mapState.explored);
  const added: TileCoord[] = [];
  const from = state.player.pos;

  for (let y = from.y - radius; y <= from.y + radius; y++) {
    for (let x = from.x - radius; x <= from.x + radius; x++) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      const key = tileKey({ x, y });
      if (known.has(key)) continue;
      // Die Wand selbst wird sichtbar, alles dahinter nicht: hasLineOfSight
      // laesst die Zielkachel ausdruecklich nie blockieren.
      if (!hasLineOfSight(map, from, { x, y }, mapState)) continue;
      known.add(key);
      mapState.explored.push(key);
      added.push({ x, y });
    }
  }

  return added;
}
