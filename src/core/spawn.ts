/**
 * Gegner zur Laufzeit setzen, PHASE_3_7 Block 6.
 * Bossskripte rufen darueber Verstaerkung. Die Ausruestung der Gegner liegt in
 * loot.ts.
 */
import { createEnemyEntity, enemyAt } from './entities';
import { chebyshev, isSolid } from './grid';
import { monsterLevelFor, scaledHealth } from './scaling';
import type { ContentDb, Entity, GameState, TileCoord } from './types';

/**
 * Setzt einen Gegner zur Laufzeit auf die Karte, PHASE_3_7 Block 6.
 * Liefert null bei unbekannter Definition, solider oder besetzter Kachel.
 * `monsterLevel` folgt der Sohle, nicht dem rufenden Boss.
 */
export function spawnEnemy(
  state: GameState,
  defId: string,
  pos: TileCoord,
  content: ContentDb
): Entity | null {
  const map = content.maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  if (map === undefined || mapState === undefined) return null;

  const def = content.enemies[defId];
  if (def === undefined) return null;

  if (isSolid(map, pos.x, pos.y, mapState)) return null;
  if (enemyAt(mapState, pos.x, pos.y) !== undefined) return null;
  if (state.player.pos.x === pos.x && state.player.pos.y === pos.y) return null;

  const monsterLevel = monsterLevelFor(map.depth, state.difficulty, state.player.level);
  const entity = createEnemyEntity(
    mapState.nextEntityId,
    defId,
    pos,
    0,
    scaledHealth(def, monsterLevel, state.difficulty),
    monsterLevel
  );
  // Ein herbeigerufener Gegner ist sofort wach, sonst steht er nutzlos herum.
  entity.active = true;
  if (def.behavior === 'scripted') entity.scriptState = {};

  mapState.nextEntityId += 1;
  mapState.entities.push(entity);
  return entity;
}

/**
 * Freie Kacheln im Umkreis, sortiert nach Distanz, dann x, dann y. Die feste
 * Sortierung macht jede Auswahl daraus reproduzierbar (PHASE_3_7 Block 6).
 *
 * `content` kommt ergaenzend zur Skizze im Task-File dazu: ohne die MapDef
 * laesst sich nicht feststellen, welche Kachel solide ist.
 */
export function freeTilesAround(
  state: GameState,
  center: TileCoord,
  radius: number,
  content: ContentDb
): TileCoord[] {
  const mapDef = content.maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  if (mapDef === undefined || mapState === undefined) return [];

  const tiles: TileCoord[] = [];
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      if (x === center.x && y === center.y) continue;
      if (x < 0 || y < 0 || x >= mapDef.width || y >= mapDef.height) continue;
      if (isSolid(mapDef, x, y, mapState)) continue;
      if (enemyAt(mapState, x, y) !== undefined) continue;
      if (state.player.pos.x === x && state.player.pos.y === y) continue;
      tiles.push({ x, y });
    }
  }

  return tiles.sort((a, b) => {
    const byDistance = chebyshev(center, a) - chebyshev(center, b);
    if (byDistance !== 0) return byDistance;
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });
}
