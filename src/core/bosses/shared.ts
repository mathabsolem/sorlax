/**
 * Gemeinsame Bausteine der Bossskripte.
 *
 * Bossskripte unterliegen denselben Regeln wie der Rest von core: kein eigener
 * Zufallsgenerator, kein Zustand in Modulvariablen. Alle Zaehler leben in
 * `entity.scriptState` und damit im Spielstand (INTERFACES Abschnitt 10).
 */
import { applyResistance, resolveAttack } from '../combat';
import { enemyActor, getDerivedStats, playerActor } from '../derived';
import { applyEffectDefault } from '../effects';
import { isAlive, vitalsOf } from '../entities';
import { chebyshev, hasLineOfSight, isSolid, isWalkable } from '../grid';
import { scaleWeapon } from '../scaling';
import type {
  ContentDb,
  DamageType,
  EnemyDef,
  Entity,
  EntityId,
  Facing,
  GameEvent,
  GameState,
  MapDef,
  MapRuntimeState,
  TileCoord,
} from '../types';
import { loadRng, saveRng } from '../rng';

export type BossScene = {
  map: MapDef;
  mapState: MapRuntimeState;
  distance: number;
};

/** Karte, Kartenzustand und Distanz zum Spieler, oder null bei kaputtem Zustand. */
export function bossScene(state: GameState, entity: Entity, content: ContentDb): BossScene | null {
  const map = content.maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  if (map === undefined || mapState === undefined) return null;
  return { map, mapState, distance: chebyshev(entity.pos, state.player.pos) };
}

/** Zaehler aus dem scriptState, 0 wenn er noch nie gesetzt wurde. */
export function counter(entity: Entity, key: string): number {
  return entity.scriptState?.[key] ?? 0;
}

/** Setzt einen Zaehler im scriptState und legt ihn bei Bedarf an. */
export function setCounter(entity: Entity, key: string, value: number): void {
  if (entity.scriptState === undefined) entity.scriptState = {};
  entity.scriptState[key] = value;
}

/** Anteil der verbliebenen Lebenspunkte, 0 bis 1. */
export function healthRatio(entity: Entity, content: ContentDb, state: GameState): number {
  const actor = enemyActor(entity, content);
  if (actor === null) return 1;
  const maxHealth = getDerivedStats(actor, content, state.difficulty).maxHealth;
  if (maxHealth <= 0) return 0;
  return (entity.health ?? 0) / maxHealth;
}

function facingFromDelta(dx: number, dy: number): Facing | null {
  if (dx === 0 && dy < 0) return 0;
  if (dx > 0 && dy === 0) return 1;
  if (dx === 0 && dy > 0) return 2;
  if (dx < 0 && dy === 0) return 3;
  return null;
}

/** Ein Schritt auf eine Zielkachel, wenn sie frei ist. */
export function stepOnto(
  state: GameState,
  scene: BossScene,
  entity: Entity,
  target: TileCoord
): GameEvent[] {
  if (target.x === state.player.pos.x && target.y === state.player.pos.y) return [];
  if (!isWalkable(scene.map, target.x, target.y, scene.mapState)) return [];
  const from = { x: entity.pos.x, y: entity.pos.y };
  const facing = facingFromDelta(target.x - from.x, target.y - from.y);
  if (facing !== null) entity.facing = facing;
  entity.pos = { x: target.x, y: target.y };
  return [{ type: 'moved', who: entity.id, from, to: { x: target.x, y: target.y } }];
}

/** Ein Schritt in Richtung Spieler, oder von ihm weg. */
export function stepToward(
  state: GameState,
  scene: BossScene,
  entity: Entity,
  away = false
): GameEvent[] {
  const sign = away ? -1 : 1;
  const dx = state.player.pos.x - entity.pos.x;
  const dy = state.player.pos.y - entity.pos.y;
  const alongX = { x: entity.pos.x + sign * Math.sign(dx), y: entity.pos.y };
  const alongY = { x: entity.pos.x, y: entity.pos.y + sign * Math.sign(dy) };
  const candidates = Math.abs(dx) >= Math.abs(dy) ? [alongX, alongY] : [alongY, alongX];

  for (const candidate of candidates) {
    if (candidate.x === entity.pos.x && candidate.y === entity.pos.y) continue;
    const events = stepOnto(state, scene, entity, candidate);
    if (events.length > 0) return events;
  }
  return [];
}

/** Blickrichtung auf den Spieler drehen. */
export function facePlayer(state: GameState, entity: Entity): void {
  const facing = facingFromDelta(
    Math.sign(state.player.pos.x - entity.pos.x),
    Math.sign(state.player.pos.y - entity.pos.y)
  );
  if (facing !== null) entity.facing = facing;
}

/** Regulaerer Waffenangriff des Bosses auf den Spieler. */
export function bossAttack(
  state: GameState,
  entity: Entity,
  def: EnemyDef,
  content: ContentDb
): GameEvent[] {
  const actor = enemyActor(entity, content);
  const weapon = content.weapons[def.weaponId];
  if (actor === null || weapon === undefined) return [];
  facePlayer(state, entity);

  const rng = loadRng(state);
  const events = resolveAttack(
    rng,
    {
      ref: entity.id,
      stats: getDerivedStats(actor, content, state.difficulty),
      vitals: vitalsOf(entity),
    },
    {
      ref: 'player',
      stats: getDerivedStats(playerActor(state), content, state.difficulty),
      vitals: state.player,
    },
    scaleWeapon(weapon, entity.monsterLevel ?? 1, state.difficulty),
    chebyshev(entity.pos, state.player.pos)
  );
  saveRng(state, rng);
  return events;
}

/** Legt einen Statuseffekt auf den Spieler, wenn der Angriff getroffen hat. */
export function effectOnHit(
  state: GameState,
  content: ContentDb,
  events: readonly GameEvent[],
  effectId: string
): GameEvent[] {
  const hit = events.some((event) => event.type === 'attack' && event.hit);
  if (!hit || state.player.health <= 0) return [];
  return applyEffectDefault(playerActor(state), effectId, content, state.difficulty);
}

/** Die bis zu `length` Kacheln vor dem Boss, bis eine solide Kachel blockiert. */
export function tilesAhead(
  scene: BossScene,
  entity: Entity,
  length: number
): TileCoord[] {
  const deltas: Record<Facing, TileCoord> = {
    0: { x: 0, y: -1 },
    1: { x: 1, y: 0 },
    2: { x: 0, y: 1 },
    3: { x: -1, y: 0 },
  };
  const delta = deltas[entity.facing];
  const tiles: TileCoord[] = [];
  for (let step = 1; step <= length; step++) {
    const pos = { x: entity.pos.x + delta.x * step, y: entity.pos.y + delta.y * step };
    // isSolid deckt Rand, Tueren und temporaere Waende gleichermassen ab.
    if (isSolid(scene.map, pos.x, pos.y, scene.mapState)) break;
    tiles.push(pos);
  }
  return tiles;
}

/** Lebende Gegner auf einer Kachelliste, plus der Spieler wenn er darauf steht. */
export function actorsOn(
  state: GameState,
  scene: BossScene,
  tiles: readonly TileCoord[]
): { player: boolean; enemies: Entity[] } {
  const keys = new Set(tiles.map((tile) => `${tile.x},${tile.y}`));
  const player = keys.has(`${state.player.pos.x},${state.player.pos.y}`);
  const enemies = scene.mapState.entities.filter(
    (entity) =>
      entity.kind === 'enemy' && isAlive(entity) && keys.has(`${entity.pos.x},${entity.pos.y}`)
  );
  return { player, enemies };
}

/**
 * Fester Schaden auf alle Akteure einer Kachelliste. Resistenz zaehlt,
 * Ruestung nicht: das ist kein Waffenangriff, sondern eine Flaeche.
 * Liefert die Ereignisse und legt bei Bedarf einen Effekt auf den Spieler.
 */
export function areaStrike(
  state: GameState,
  scene: BossScene,
  entity: Entity,
  content: ContentDb,
  tiles: readonly TileCoord[],
  damage: number,
  damageType: DamageType,
  effectId?: string
): GameEvent[] {
  const { player, enemies } = actorsOn(state, scene, tiles);
  const events: GameEvent[] = [];

  if (player) {
    const stats = getDerivedStats(playerActor(state), content, state.difficulty);
    const dealt = applyResistance(damage, stats.resistances[damageType]);
    events.push(strikeEvent(entity.id, 'player', dealt, damageType));
    state.player.health -= dealt;
    if (state.player.health <= 0) {
      state.player.health = 0;
      events.push({ type: 'died', who: 'player' });
    } else if (effectId !== undefined) {
      events.push(...applyEffectDefault(playerActor(state), effectId, content, state.difficulty));
    }
  }

  for (const other of enemies) {
    if (other.id === entity.id) continue;
    const actor = enemyActor(other, content);
    if (actor === null) continue;
    const stats = getDerivedStats(actor, content, state.difficulty);
    const dealt = applyResistance(damage, stats.resistances[damageType]);
    const vitals = vitalsOf(other);
    vitals.health -= dealt;
    events.push(strikeEvent(entity.id, other.id, dealt, damageType));
    if (vitals.health <= 0) {
      vitals.health = 0;
      events.push({ type: 'died', who: other.id });
    }
  }

  return events;
}

function strikeEvent(
  attacker: EntityId,
  target: EntityId | 'player',
  damage: number,
  damageType: DamageType
): GameEvent {
  return { type: 'attack', attacker, target, hit: true, damage, crit: false, damageType };
}

/** Sichtlinie vom Boss zum Spieler. */
export function seesPlayer(state: GameState, scene: BossScene, entity: Entity): boolean {
  return hasLineOfSight(scene.map, entity.pos, state.player.pos, scene.mapState);
}
