/**
 * `sorlax`, PHASE_3_7 Block 7.
 *
 * Drei Phasen nach Anteil der Lebenspunkte, Grenzen bei 66 und 33 Prozent.
 * Phase 1 Nahkampf mit `drain`, Phase 2 ohne Bewegung mit Verstaerkung,
 * Phase 3 Fernkampf mit einem Strahl jede zweite Runde.
 *
 * Ein Phasenwechsel findet hoechstens einmal je Runde statt: der Zaehler
 * springt immer nur eine Stufe weiter, auch wenn der Schaden zwei Grenzen auf
 * einmal reisst.
 */
import { isAlive } from '../entities';
import { freeTilesAround, spawnEnemy } from '../spawn';
import {
  areaStrike,
  bossAttack,
  bossScene,
  counter,
  effectOnHit,
  facePlayer,
  healthRatio,
  seesPlayer,
  setCounter,
  stepToward,
  tilesAhead,
} from './shared';
import type { ContentDb, EnemyDef, Entity, GameEvent, GameState } from '../types';

/** Grenzen der Phasen als Anteil der Lebenspunkte. */
export const PHASE_TWO_RATIO = 0.66;
export const PHASE_THREE_RATIO = 0.33;

/** Feste Liste der Archetypen, die Sorlax in Phase 2 ruft. */
export const SORLAX_MINIONS: readonly string[] = ['rat_physical', 'miner_physical'];

const SUMMON_INTERVAL = 3;
const SUMMON_COUNT = 2;
const MAX_MINIONS = 8;
const SUMMON_RADIUS = 4;

/** Reichweite des Strahls, MAX_VIEW_DIST aus SPEC Abschnitt 7. */
const BEAM_LENGTH = 16;
const BEAM_DAMAGE = 18;

/** Die Phase, die der aktuelle Lebensstand vorgibt. */
export function targetPhase(ratio: number): number {
  if (ratio > PHASE_TWO_RATIO) return 0;
  if (ratio > PHASE_THREE_RATIO) return 1;
  return 2;
}

/** Von Sorlax gerufene, noch lebende Gegner. */
function liveMinions(state: GameState): Entity[] {
  const mapState = state.maps[state.currentMapId];
  if (mapState === undefined) return [];
  return mapState.entities.filter(
    (entity) =>
      entity.kind === 'enemy' && SORLAX_MINIONS.includes(entity.defId) && isAlive(entity)
  );
}

function summon(state: GameState, entity: Entity, content: ContentDb): GameEvent[] {
  let alive = liveMinions(state).length;
  if (alive >= MAX_MINIONS) {
    return [{ type: 'message', text: 'the shaft answers sorlax, but nothing comes' }];
  }

  const events: GameEvent[] = [];
  const tiles = freeTilesAround(state, entity.pos, SUMMON_RADIUS, content);
  let index = 0;
  for (const tile of tiles) {
    if (alive >= MAX_MINIONS || events.length >= SUMMON_COUNT) break;
    const defId = SORLAX_MINIONS[index % SORLAX_MINIONS.length];
    if (defId === undefined) break;
    const spawned = spawnEnemy(state, defId, tile, content);
    if (spawned === null) continue;
    index += 1;
    alive += 1;
    events.push({ type: 'message', text: `sorlax calls ${defId} (${spawned.id})` });
  }
  return events;
}

function beamTurn(state: GameState, entity: Entity, content: ContentDb): GameEvent[] {
  const scene = bossScene(state, entity, content);
  if (scene === null) return [];
  facePlayer(state, entity);

  const step = counter(entity, 'beam') + 1;
  setCounter(entity, 'beam', step);

  // Ungerade Schritte warnen, gerade feuern. Damit liegt vor jedem Strahl genau
  // eine Warnrunde.
  if (step % 2 === 1) {
    return [{ type: 'message', text: 'sorlax gathers a void beam' }];
  }

  const tiles = tilesAhead(scene, entity, BEAM_LENGTH);
  return [
    { type: 'message', text: 'the void beam lashes out' },
    ...areaStrike(state, scene, entity, content, tiles, BEAM_DAMAGE, 'void', 'drain'),
  ];
}

export function sorlaxHandler(
  state: GameState,
  entity: Entity,
  def: EnemyDef,
  content: ContentDb
): GameEvent[] {
  const scene = bossScene(state, entity, content);
  if (scene === null) return [];

  const phase = counter(entity, 'phase');
  const wanted = targetPhase(healthRatio(entity, content, state));
  const events: GameEvent[] = [];
  // Hoechstens ein Wechsel je Runde, auch wenn der Schaden zwei Grenzen reisst.
  const active = wanted > phase ? phase + 1 : phase;
  setCounter(entity, 'phase', active);
  if (active !== phase) {
    events.push({ type: 'message', text: `sorlax shifts into phase ${active + 1}` });
  }

  if (active === 0) {
    if (scene.distance > 1) return [...events, ...stepToward(state, scene, entity)];
    const attack = bossAttack(state, entity, def, content);
    events.push(...attack);
    events.push(...effectOnHit(state, content, attack, 'drain'));
    return events;
  }

  if (active === 1) {
    const turns = counter(entity, 'summonTurns') + 1;
    setCounter(entity, 'summonTurns', turns);
    if (turns % SUMMON_INTERVAL === 0) events.push(...summon(state, entity, content));
    return events;
  }

  if (!seesPlayer(state, scene, entity)) return [...events, ...stepToward(state, scene, entity)];
  return [...events, ...beamTurn(state, entity, content)];
}
