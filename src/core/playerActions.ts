/**
 * Einzelaktionen des Spielers. Jede Funktion prueft zuerst vollstaendig und
 * mutiert erst danach, damit ein ungueltiges Kommando den Zustand nicht anfasst.
 */
import { applySplash, resolveAttack } from './combat';
import { doorAt, enemyAt, isAlive, itemAt, removeEntity } from './entities';
import { chebyshev, hasLineOfSight, stepFrom, tileKey } from './grid';
import { grantXp } from './progression';
import { loadRng, saveRng } from './state';
import { fireTriggers, hasUsableTrigger } from './triggers';
import { reapDead } from './turn';
import type {
  ContentDb,
  Entity,
  EntityId,
  GameEvent,
  GameState,
  ItemDef,
  MapDef,
  MapRuntimeState,
  TileCoord,
} from './types';

/** Ergebnis einer Einzelaktion. `ok: false` fuehrt zu genau einem `invalid`-Event. */
export type ActionResult = { ok: true; events: GameEvent[] } | { ok: false; reason: string };

function scene(state: GameState, content: ContentDb): { map: MapDef; mapState: MapRuntimeState } | null {
  const map = content.maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  if (map === undefined || mapState === undefined) return null;
  return { map, mapState };
}

/** Legt ein aufgesammeltes Item in das passende Inventarfach des Spielers. */
function stow(state: GameState, def: ItemDef): void {
  const player = state.player;
  switch (def.type) {
    case 'ammo':
      player.ammo[def.id] = (player.ammo[def.id] ?? 0) + def.amount;
      return;
    case 'weapon':
      if (!player.weapons.includes(def.id)) player.weapons.push(def.id);
      return;
    case 'key':
    case 'keyCard':
      if (!player.keys.includes(def.id)) player.keys.push(def.id);
      return;
    default:
      player.items[def.id] = (player.items[def.id] ?? 0) + def.amount;
  }
}

/** Sammelt ein Item auf der Kachel ein, falls dort eines liegt. */
export function pickupAt(state: GameState, content: ContentDb, pos: TileCoord): GameEvent[] {
  const here = scene(state, content);
  if (here === null) return [];
  const entity = itemAt(here.mapState, pos.x, pos.y);
  if (entity === undefined) return [];
  const def = content.items[entity.defId];
  if (def === undefined) return [];

  stow(state, def);
  removeEntity(here.mapState, entity.id);
  const key = tileKey(pos);
  if (!here.mapState.takenItems.includes(key)) here.mapState.takenItems.push(key);
  return [{ type: 'pickup', defId: def.id, amount: def.amount }];
}

/** Naechster sichtbarer Gegner in Reichweite, bei Gleichstand die kleinere Id. */
function autoTarget(
  state: GameState,
  map: MapDef,
  mapState: MapRuntimeState,
  maxRange: number
): Entity | undefined {
  let best: Entity | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entity of mapState.entities) {
    if (entity.kind !== 'enemy' || !isAlive(entity)) continue;
    const distance = chebyshev(state.player.pos, entity.pos);
    if (distance > maxRange) continue;
    if (!hasLineOfSight(map, state.player.pos, entity.pos, mapState)) continue;
    if (distance < bestDistance || (distance === bestDistance && best !== undefined && entity.id < best.id)) {
      best = entity;
      bestDistance = distance;
    }
  }
  return best;
}

/** Vergibt XP fuer alle in `events` getoeteten Gegner und raeumt sie ab. */
function collectKills(
  state: GameState,
  content: ContentDb,
  mapState: MapRuntimeState,
  events: GameEvent[]
): GameEvent[] {
  let reward = 0;
  for (const event of events) {
    if (event.type !== 'died' || event.who === 'player') continue;
    const entity = mapState.entities.find((candidate) => candidate.id === event.who);
    if (entity === undefined || entity.kind !== 'enemy') continue;
    reward += content.enemies[entity.defId]?.xpReward ?? 0;
  }
  reapDead(mapState);
  return reward > 0 ? grantXp(state.player, reward, content.progression) : [];
}

/** Angriff auf ein Ziel oder auf den naechsten sichtbaren Gegner. */
export function attackAction(
  state: GameState,
  content: ContentDb,
  targetId?: EntityId
): ActionResult {
  const here = scene(state, content);
  if (here === null) return { ok: false, reason: 'unknown map' };
  const weapon = content.weapons[state.player.equippedWeaponId];
  if (weapon === undefined) return { ok: false, reason: 'no weapon equipped' };

  const ammoType = weapon.ammoType;
  if (ammoType !== null && (state.player.ammo[ammoType] ?? 0) < weapon.ammoPerShot) {
    return { ok: false, reason: 'out of ammo' };
  }

  const target =
    targetId === undefined
      ? autoTarget(state, here.map, here.mapState, weapon.maxRange)
      : here.mapState.entities.find((candidate) => candidate.id === targetId);
  if (target === undefined || target.kind !== 'enemy' || !isAlive(target)) {
    return { ok: false, reason: 'no target' };
  }
  const targetStats = target.stats;
  if (targetStats === undefined) return { ok: false, reason: 'target has no stats' };

  const distance = chebyshev(state.player.pos, target.pos);
  if (distance > weapon.maxRange) return { ok: false, reason: 'target out of range' };
  if (!hasLineOfSight(here.map, state.player.pos, target.pos, here.mapState)) {
    return { ok: false, reason: 'no line of sight' };
  }

  if (ammoType !== null) {
    state.player.ammo[ammoType] = (state.player.ammo[ammoType] ?? 0) - weapon.ammoPerShot;
  }

  const rng = loadRng(state);
  const events = resolveAttack(
    rng,
    { ref: 'player', stats: state.player.stats },
    { ref: target.id, stats: targetStats },
    weapon,
    distance
  );
  saveRng(state, rng);
  target.active = true;

  const splash = weapon.splash;
  if (splash !== undefined) {
    events.push(...applySplash(state.player, here.mapState, target.pos, splash, 'player'));
  }

  events.push(...collectKills(state, content, here.mapState, events));
  return { ok: true, events };
}

/** Tuer oder Schalter auf der Kachel direkt vor dem Spieler. */
export function interactAction(state: GameState, content: ContentDb): ActionResult {
  const here = scene(state, content);
  if (here === null) return { ok: false, reason: 'unknown map' };
  const front = stepFrom(state.player.pos, state.player.facing, 'forward');
  const door = doorAt(here.mapState, front.x, front.y);

  if (door !== undefined && door.state !== 'open') {
    const def = here.map.entities.find(
      (candidate) =>
        candidate.kind === 'door' && candidate.pos.x === front.x && candidate.pos.y === front.y
    );
    const lock = def?.locked;
    if (lock !== undefined && !state.player.keys.includes(lock)) {
      return { ok: true, events: [{ type: 'doorChanged', pos: front, state: 'blocked' }] };
    }
    door.state = 'open';
    const key = tileKey(front);
    if (!here.mapState.openedDoors.includes(key)) here.mapState.openedDoors.push(key);
    return { ok: true, events: [{ type: 'doorChanged', pos: front, state: 'open' }] };
  }

  if (hasUsableTrigger(state, content, front)) {
    return { ok: true, events: fireTriggers(state, content, front, 'use') };
  }

  return { ok: false, reason: 'nothing to interact with' };
}

/** Benutzt ein Item aus dem Inventar. Questgegenstaende sind nicht benutzbar. */
export function useItemAction(state: GameState, content: ContentDb, itemId: string): ActionResult {
  const player = state.player;
  if ((player.items[itemId] ?? 0) <= 0) return { ok: false, reason: 'item not in inventory' };
  const def = content.items[itemId];
  if (def === undefined) return { ok: false, reason: 'unknown item' };
  if (def.type === 'quest') return { ok: false, reason: 'quest item cannot be used' };

  const events: GameEvent[] = [];
  switch (def.type) {
    case 'heal':
      player.stats.health = Math.min(player.stats.maxHealth, player.stats.health + def.amount);
      break;
    case 'armor':
      player.stats.armor += def.amount;
      break;
    case 'ammo':
      player.ammo[def.id] = (player.ammo[def.id] ?? 0) + def.amount;
      break;
    case 'weapon':
      if (!player.weapons.includes(def.id)) player.weapons.push(def.id);
      break;
    case 'key':
    case 'keyCard':
      if (!player.keys.includes(def.id)) player.keys.push(def.id);
      break;
    default:
      break;
  }

  const effect = def.effect;
  if (effect !== undefined) {
    player.effects.push({
      id: effect.id,
      remainingTurns: effect.turns,
      magnitude: effect.magnitude,
    });
  }

  player.items[itemId] = (player.items[itemId] ?? 0) - 1;
  events.push({ type: 'message', text: `used ${def.id}` });
  return { ok: true, events };
}

/** Waffenwechsel. Kostet keine Runde, SPEC 3.2 fuehrt ihn nicht als Zeitkosten. */
export function switchWeaponAction(
  state: GameState,
  content: ContentDb,
  weaponId: string
): ActionResult {
  if (!state.player.weapons.includes(weaponId)) return { ok: false, reason: 'weapon not owned' };
  if (content.weapons[weaponId] === undefined) return { ok: false, reason: 'unknown weapon' };
  if (state.player.equippedWeaponId === weaponId) {
    return { ok: false, reason: 'weapon already equipped' };
  }
  state.player.equippedWeaponId = weaponId;
  return { ok: true, events: [{ type: 'message', text: `equipped ${weaponId}` }] };
}

/** Bewegungsziel pruefen und den Spieler versetzen. */
export function moveAction(
  state: GameState,
  content: ContentDb,
  dir: 'forward' | 'back' | 'left' | 'right'
): ActionResult {
  const here = scene(state, content);
  if (here === null) return { ok: false, reason: 'unknown map' };
  const target = stepFrom(state.player.pos, state.player.facing, dir);

  const door = doorAt(here.mapState, target.x, target.y);
  if (door !== undefined && door.state !== 'open') return { ok: false, reason: 'door is closed' };
  if (enemyAt(here.mapState, target.x, target.y) !== undefined) {
    return { ok: false, reason: 'tile occupied' };
  }
  const walls = here.map.walls[target.y * here.map.width + target.x];
  if (
    target.x < 0 ||
    target.y < 0 ||
    target.x >= here.map.width ||
    target.y >= here.map.height ||
    walls === undefined ||
    walls !== 0
  ) {
    return { ok: false, reason: 'blocked by wall' };
  }

  const from = { x: state.player.pos.x, y: state.player.pos.y };
  state.player.pos = { x: target.x, y: target.y };
  const key = tileKey(target);
  if (!here.mapState.explored.includes(key)) here.mapState.explored.push(key);

  const events: GameEvent[] = [{ type: 'moved', who: 'player', from, to: { ...target } }];
  events.push(...pickupAt(state, content, target));
  return { ok: true, events };
}
