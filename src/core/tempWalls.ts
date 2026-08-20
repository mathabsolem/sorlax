/**
 * Temporaere Waende nach INTERFACES v1.2.1 Abschnitt 4.
 *
 * Bossskripte verschliessen damit Felder fuer eine begrenzte Zahl von Runden.
 * Die Waende liegen im Kartenzustand und damit im Spielstand; sie ueberleben
 * also Speichern und Laden.
 */
import type { Entity, GameState, MapRuntimeState, TempWall, TileCoord } from './types';

/** Temporaere Wand auf einer Kachel, oder undefined. */
export function tempWallAt(
  mapState: MapRuntimeState,
  x: number,
  y: number
): TempWall | undefined {
  return mapState.tempWalls.find((wall) => wall.pos.x === x && wall.pos.y === y);
}

/** Steht auf der Kachel ein lebender Akteur? */
function occupied(state: GameState, mapState: MapRuntimeState, pos: TileCoord): boolean {
  if (state.player.pos.x === pos.x && state.player.pos.y === pos.y) return true;
  return mapState.entities.some(
    (entity: Entity) =>
      entity.kind === 'enemy' &&
      entity.pos.x === pos.x &&
      entity.pos.y === pos.y &&
      (entity.health === undefined || entity.health > 0)
  );
}

/**
 * Setzt eine temporaere Wand. Liefert false, wenn die Kachel vom Spieler oder
 * einem lebenden Gegner besetzt ist oder dort schon eine Wand steht. Ein Akteur
 * darf nie eingemauert werden, deshalb wird hier und nicht erst im Aufrufer
 * geprueft.
 */
export function addTempWall(
  state: GameState,
  mapState: MapRuntimeState,
  pos: TileCoord,
  tileValue: number,
  expiresAtTurn: number
): boolean {
  if (occupied(state, mapState, pos)) return false;
  if (tempWallAt(mapState, pos.x, pos.y) !== undefined) return false;
  mapState.tempWalls.push({ pos: { x: pos.x, y: pos.y }, tileValue, expiresAtTurn });
  return true;
}

/**
 * Entfernt abgelaufene Waende. Laut PHASE_3_7 Block 1 laeuft eine Wand ab,
 * sobald `turnCount >= expiresAtTurn`. Liefert die Zahl der entfernten Waende.
 */
export function expireTempWalls(mapState: MapRuntimeState, turnCount: number): number {
  let removed = 0;
  for (let index = mapState.tempWalls.length - 1; index >= 0; index--) {
    const wall = mapState.tempWalls[index];
    if (wall === undefined) continue;
    if (turnCount < wall.expiresAtTurn) continue;
    mapState.tempWalls.splice(index, 1);
    removed += 1;
  }
  return removed;
}
