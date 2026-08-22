/**
 * `rime`, PHASE_3_7 Block 7.
 *
 * Haelt Distanz 5 bis 7 und weicht aus, wenn der Spieler naeher kommt.
 * Fernangriff mit `chill`. Bei Distanz unter 3 hoechstens alle 8 Runden ein
 * Versatz auf ein freies Feld in Distanz 6. Unter 50 Prozent Leben alle 5
 * Runden vier temporaere Waende im Umkreis 4.
 */
import { chebyshev } from '../grid';
import { freeTilesAround } from '../spawn';
import { addTempWall } from '../tempWalls';
import {
  bossAttack,
  bossScene,
  counter,
  effectOnHit,
  facePlayer,
  healthRatio,
  seesPlayer,
  setCounter,
  stepToward,
} from './shared';
import type { ContentDb, EnemyDef, Entity, GameEvent, GameState, TileCoord } from '../types';

const MIN_RANGE = 5;
const MAX_RANGE = 7;

/** Ab dieser Naehe denkt `rime` an einen Versatz. */
const BLINK_TRIGGER = 3;
const BLINK_COOLDOWN = 8;
const BLINK_DISTANCE = 6;

/** Ab diesem Anteil Leben stellt `rime` temporaere Waende. */
const WOUNDED_RATIO = 0.5;
const WALL_INTERVAL = 5;
const WALL_COUNT = 4;
const WALL_RADIUS = 4;
const WALL_DURATION = 6;

/** Kachelwert der Eiswand. Solide, damit isSolid sie als Wand liest. */
export const RIME_WALL_TILE = 1;

/** Versatz auf ein freies Feld in Distanz 6, das erste in fester Sortierung. */
function blink(state: GameState, entity: Entity, content: ContentDb): GameEvent[] {
  const candidates = freeTilesAround(state, state.player.pos, BLINK_DISTANCE, content).filter(
    (tile) => chebyshev(tile, state.player.pos) === BLINK_DISTANCE
  );
  const target = candidates[0];
  if (target === undefined) return [];

  const from = { x: entity.pos.x, y: entity.pos.y };
  entity.pos = { x: target.x, y: target.y };
  facePlayer(state, entity);
  return [
    { type: 'message', text: 'Der Erkaltete entweicht in einem Frosthauch' },
    { type: 'moved', who: entity.id, from, to: { x: target.x, y: target.y } },
  ];
}

/** Vier temporaere Waende im Umkreis, nie auf besetzten Kacheln. */
function raiseWalls(state: GameState, entity: Entity, content: ContentDb): GameEvent[] {
  const mapState = state.maps[state.currentMapId];
  if (mapState === undefined) return [];

  const expiresAtTurn = state.turnCount + WALL_DURATION;
  const placed: TileCoord[] = [];
  for (const tile of freeTilesAround(state, entity.pos, WALL_RADIUS, content)) {
    if (placed.length >= WALL_COUNT) break;
    // addTempWall prueft die Besetzung noch einmal selbst.
    if (!addTempWall(state, mapState, tile, RIME_WALL_TILE, expiresAtTurn)) continue;
    placed.push(tile);
  }

  if (placed.length === 0) return [];
  return [{ type: 'message', text: `Der Erkaltete stellt ${placed.length} Eiswände` }];
}

export function rimeHandler(
  state: GameState,
  entity: Entity,
  def: EnemyDef,
  content: ContentDb
): GameEvent[] {
  const scene = bossScene(state, entity, content);
  if (scene === null) return [];

  const events: GameEvent[] = [];
  const lastWall = counter(entity, 'lastWall');
  const wounded = healthRatio(entity, content, state) < WOUNDED_RATIO;
  if (wounded && state.turnCount - lastWall >= WALL_INTERVAL) {
    const raised = raiseWalls(state, entity, content);
    if (raised.length > 0) {
      setCounter(entity, 'lastWall', state.turnCount);
      events.push(...raised);
    }
  }

  const lastBlink = counter(entity, 'lastBlink');
  if (scene.distance < BLINK_TRIGGER && state.turnCount - lastBlink >= BLINK_COOLDOWN) {
    const moved = blink(state, entity, content);
    if (moved.length > 0) {
      setCounter(entity, 'lastBlink', state.turnCount);
      return [...events, ...moved];
    }
  }

  if (scene.distance < MIN_RANGE) return [...events, ...stepToward(state, scene, entity, true)];
  if (scene.distance > MAX_RANGE) return [...events, ...stepToward(state, scene, entity)];

  if (!seesPlayer(state, scene, entity)) return [...events, ...stepToward(state, scene, entity)];

  const attack = bossAttack(state, entity, def, content);
  events.push(...attack);
  events.push(...effectOnHit(state, content, attack, 'chill'));
  return events;
}
