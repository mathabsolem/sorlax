/**
 * `halvern`, PHASE_3_7 Block 7.
 *
 * Zwei Phasen im Wechsel: Ansturm und Flammenwand.
 * - Ansturm: 3 Runden, zwei Schritte je Aktion Richtung Spieler, Angriff bei
 *   Distanz 1 mit `burn`. Unter 40 Prozent Leben dauert er nur 2 Runden.
 * - Flammenwand: 2 Runden ohne Bewegung, trifft alle Akteure auf den bis zu
 *   drei Feldern in gerader Blickrichtung.
 */
import {
  areaStrike,
  bossAttack,
  bossScene,
  counter,
  effectOnHit,
  facePlayer,
  healthRatio,
  setCounter,
  stepToward,
  tilesAhead,
} from './shared';
import type { ContentDb, EnemyDef, Entity, GameEvent, GameState } from '../types';

/** Runden im Ansturm, bei angeschlagenem Boss eine weniger. */
const CHARGE_TURNS = 3;
const CHARGE_TURNS_WOUNDED = 2;
const WALL_TURNS = 2;

/** Ab diesem Anteil Leben verkuerzt sich der Ansturm. */
const WOUNDED_RATIO = 0.4;

/** Reichweite der Flammenwand in Kacheln. */
const WALL_LENGTH = 3;

/** Schaden der Flammenwand je Akteur, vor Resistenz. */
const WALL_DAMAGE = 12;

function chargeLength(entity: Entity, content: ContentDb, state: GameState): number {
  return healthRatio(entity, content, state) < WOUNDED_RATIO
    ? CHARGE_TURNS_WOUNDED
    : CHARGE_TURNS;
}

/** Die Flammenwand: fester Schaden auf die Kacheln in Blickrichtung. */
function flameWall(state: GameState, entity: Entity, content: ContentDb): GameEvent[] {
  const scene = bossScene(state, entity, content);
  if (scene === null) return [];
  facePlayer(state, entity);

  const tiles = tilesAhead(scene, entity, WALL_LENGTH);
  return [
    { type: 'message', text: 'halvern raises a wall of flame' },
    ...areaStrike(state, scene, entity, content, tiles, WALL_DAMAGE, 'fire', 'burn'),
  ];
}

/** Ansturm: bis zu zwei Schritte, danach ein Angriff bei Distanz 1. */
function charge(state: GameState, entity: Entity, def: EnemyDef, content: ContentDb): GameEvent[] {
  const events: GameEvent[] = [];
  for (let step = 0; step < 2; step++) {
    const scene = bossScene(state, entity, content);
    if (scene === null) break;
    if (scene.distance <= 1) break;
    const moved = stepToward(state, scene, entity);
    if (moved.length === 0) break;
    events.push(...moved);
  }

  const scene = bossScene(state, entity, content);
  if (scene !== null && scene.distance <= 1) {
    const attack = bossAttack(state, entity, def, content);
    events.push(...attack);
    events.push(...effectOnHit(state, content, attack, 'burn'));
  }
  return events;
}

export function halvernHandler(
  state: GameState,
  entity: Entity,
  def: EnemyDef,
  content: ContentDb
): GameEvent[] {
  const phase = counter(entity, 'phase');
  const phaseTurns = counter(entity, 'phaseTurns');
  const events = phase === 0 ? charge(state, entity, def, content) : flameWall(state, entity, content);

  const next = phaseTurns + 1;
  const limit = phase === 0 ? chargeLength(entity, content, state) : WALL_TURNS;
  if (next >= limit) {
    setCounter(entity, 'phase', phase === 0 ? 1 : 0);
    setCounter(entity, 'phaseTurns', 0);
  } else {
    setCounter(entity, 'phaseTurns', next);
  }

  return events;
}
