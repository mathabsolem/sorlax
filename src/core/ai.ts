/**
 * Gegnerverhalten nach SPEC 5.2 und Aktivierung nach SPEC 3.4.
 * Gegner oeffnen keine Tueren und sammeln keine Items ein.
 */
import { BOSS_REGISTRY } from './bosses/registry';
import { resolveAttack } from './combat';
import { enemyActor, getDerivedStats, playerActor } from './derived';
import { vitalsOf } from './entities';
import { chebyshev, hasLineOfSight, isWalkable } from './grid';
import { findPath } from './pathfinding';
import { scaleWeapon } from './scaling';
import { loadRng, saveRng } from './rng';
import type {
  ContentDb,
  Entity,
  EnemyDef,
  Facing,
  GameEvent,
  GameState,
  MapDef,
  MapRuntimeState,
  TileCoord,
  WeaponDef,
} from './types';

type Scene = {
  map: MapDef;
  mapState: MapRuntimeState;
  def: EnemyDef;
  weapon: WeaponDef;
  content: ContentDb;
};

function sceneFor(state: GameState, entity: Entity, content: ContentDb): Scene | null {
  const map = content.maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  const def = content.enemies[entity.defId];
  if (map === undefined || mapState === undefined || def === undefined) return null;
  const weapon = content.weapons[def.weaponId];
  if (weapon === undefined) return null;
  return { map, mapState, def, weapon, content };
}

function facingFromDelta(dx: number, dy: number): Facing | null {
  if (dx === 0 && dy < 0) return 0;
  if (dx > 0 && dy === 0) return 1;
  if (dx === 0 && dy > 0) return 2;
  if (dx < 0 && dy === 0) return 3;
  return null;
}

/**
 * Aktivierung: einmal aktiv bleibt ein Gegner aktiv. Sonst weckt ihn Sichtlinie
 * innerhalb der aggroRange. Schaden aktiviert ihn an der Stelle, an der er ihn nimmt.
 */
export function checkActivation(state: GameState, entity: Entity, content: ContentDb): boolean {
  if (entity.active) return true;
  const scene = sceneFor(state, entity, content);
  if (scene === null) return false;
  const distance = chebyshev(entity.pos, state.player.pos);
  if (distance > scene.def.aggroRange) return false;
  if (!hasLineOfSight(scene.map, entity.pos, state.player.pos, scene.mapState)) return false;
  entity.active = true;
  return true;
}

/** Schrittkandidaten in Richtung `to`, groessere Achsendifferenz zuerst. */
function stepCandidates(from: TileCoord, to: TileCoord, away: boolean): TileCoord[] {
  const sign = away ? -1 : 1;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const alongX = { x: from.x + sign * Math.sign(dx), y: from.y };
  const alongY = { x: from.x, y: from.y + sign * Math.sign(dy) };
  const candidates: TileCoord[] = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx !== 0) candidates.push(alongX);
    if (dy !== 0) candidates.push(alongY);
  } else {
    if (dy !== 0) candidates.push(alongY);
    if (dx !== 0) candidates.push(alongX);
  }
  return candidates;
}

/** Bewegt den Gegner auf `target`, wenn das Feld frei und nicht der Spieler ist. */
function moveTo(state: GameState, scene: Scene, entity: Entity, target: TileCoord): GameEvent[] {
  if (target.x === state.player.pos.x && target.y === state.player.pos.y) return [];
  if (!isWalkable(scene.map, target.x, target.y, scene.mapState)) return [];
  const from = { x: entity.pos.x, y: entity.pos.y };
  const facing = facingFromDelta(target.x - from.x, target.y - from.y);
  if (facing !== null) entity.facing = facing;
  entity.pos = { x: target.x, y: target.y };
  return [{ type: 'moved', who: entity.id, from, to: { x: target.x, y: target.y } }];
}

function stepAlongAxis(
  state: GameState,
  scene: Scene,
  entity: Entity,
  away: boolean
): GameEvent[] {
  for (const candidate of stepCandidates(entity.pos, state.player.pos, away)) {
    const events = moveTo(state, scene, entity, candidate);
    if (events.length > 0) return events;
  }
  return [];
}

function attackPlayer(state: GameState, scene: Scene, entity: Entity): GameEvent[] {
  const actor = enemyActor(entity, scene.content);
  if (actor === null) return [];
  const facing = facingFromDelta(
    Math.sign(state.player.pos.x - entity.pos.x),
    Math.sign(state.player.pos.y - entity.pos.y)
  );
  if (facing !== null) entity.facing = facing;

  const monsterLevel = entity.monsterLevel ?? 1;
  const weapon = scaleWeapon(scene.weapon, monsterLevel, state.difficulty);

  const rng = loadRng(state);
  const events = resolveAttack(
    rng,
    { ref: entity.id, stats: getDerivedStats(actor, scene.content, state.difficulty), vitals: vitalsOf(entity) },
    {
      ref: 'player',
      stats: getDerivedStats(playerActor(state), scene.content, state.difficulty),
      vitals: state.player,
    },
    weapon,
    chebyshev(entity.pos, state.player.pos)
  );
  saveRng(state, rng);
  return events;
}

function canShoot(state: GameState, scene: Scene, entity: Entity, distance: number): boolean {
  if (distance > scene.weapon.maxRange) return false;
  return hasLineOfSight(scene.map, entity.pos, state.player.pos, scene.mapState);
}

function meleeTurn(state: GameState, scene: Scene, entity: Entity, distance: number): GameEvent[] {
  if (distance <= 1) return attackPlayer(state, scene, entity);
  const path = findPath(scene.map, entity.pos, state.player.pos, scene.mapState);
  const step = path === null ? undefined : path[0];
  if (step === undefined) return [];
  return moveTo(state, scene, entity, step);
}

function rangedTurn(state: GameState, scene: Scene, entity: Entity, distance: number): GameEvent[] {
  if (distance < scene.def.preferredRange) return stepAlongAxis(state, scene, entity, true);
  if (distance > scene.def.preferredRange) return stepAlongAxis(state, scene, entity, false);
  if (canShoot(state, scene, entity, distance)) return attackPlayer(state, scene, entity);
  return [];
}

function chargerTurn(state: GameState, scene: Scene, entity: Entity, distance: number): GameEvent[] {
  if (distance <= 1) return attackPlayer(state, scene, entity);
  return stepAlongAxis(state, scene, entity, false);
}

function turretTurn(state: GameState, scene: Scene, entity: Entity, distance: number): GameEvent[] {
  if (canShoot(state, scene, entity, distance)) return attackPlayer(state, scene, entity);
  return [];
}

/**
 * Bossverhalten aus BOSS_REGISTRY (INTERFACES Abschnitt 10). Ein fehlender
 * Eintrag ist ein Datenfehler und wird gemeldet, nicht verschluckt; der Gegner
 * handelt dann nicht (PHASE_3_7 Block 6).
 */
function scriptedTurn(state: GameState, scene: Scene, entity: Entity): GameEvent[] {
  const scriptId = scene.def.scriptId;
  if (scriptId === undefined) {
    return [{ type: 'message', text: `scripted enemy without scriptId: ${scene.def.id}` }];
  }
  const handler = BOSS_REGISTRY[scriptId];
  if (handler === undefined) {
    return [{ type: 'message', text: `no boss script: ${scriptId}` }];
  }
  return handler(state, entity, scene.def, scene.content);
}

/** Eine einzelne Gegneraktion. Der Aufrufer verwaltet die Aktionspunkte. */
export function takeEnemyTurn(state: GameState, entity: Entity, content: ContentDb): GameEvent[] {
  if (entity.kind !== 'enemy') return [];
  const scene = sceneFor(state, entity, content);
  if (scene === null) return [];
  if (!checkActivation(state, entity, content)) return [];

  const distance = chebyshev(entity.pos, state.player.pos);
  switch (scene.def.behavior) {
    case 'melee':
      return meleeTurn(state, scene, entity, distance);
    case 'ranged':
      return rangedTurn(state, scene, entity, distance);
    case 'charger':
      return chargerTurn(state, scene, entity, distance);
    case 'turret':
      return turretTurn(state, scene, entity, distance);
    case 'scripted':
      return scriptedTurn(state, scene, entity);
  }
}
