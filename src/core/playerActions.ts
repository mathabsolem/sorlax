/**
 * Einzelaktionen des Spielers. Jede Funktion prueft zuerst vollstaendig und
 * mutiert erst danach, damit ein ungueltiges Kommando den Zustand nicht anfasst.
 */
import { applySplash, resolveAttack } from './combat';
import type { SplashTarget } from './combat';
import { enemyActor, getDerivedStats, playerActor } from './derived';
import { applyEffectDefault } from './effects';
import { doorAt, enemyAt, isAlive, itemAt, removeEntity, vitalsOf } from './entities';
import { chebyshev, hasLineOfSight, stepFrom, tileKey } from './grid';
import { grantXp, spendAttributePoint } from './progression';
import { scaledXpReward } from './scaling';
import { loadRng, saveRng } from './state';
import { fireTriggers, hasUsableTrigger } from './triggers';
import { invalidatePlayerDerived, playerDerived, reapDead } from './turn';
import type {
  Attributes,
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

function scene(
  state: GameState,
  content: ContentDb
): { map: MapDef; mapState: MapRuntimeState } | null {
  const map = content.maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  if (map === undefined || mapState === undefined) return null;
  return { map, mapState };
}

/** Legt ein aufgesammeltes Item in das passende Inventarfach des Spielers. */
function stow(state: GameState, def: ItemDef): boolean {
  const player = state.player;
  switch (def.type) {
    case 'ammo':
      player.ammo[def.id] = (player.ammo[def.id] ?? 0) + def.amount;
      return true;
    case 'weapon':
      if (!player.weapons.includes(def.id)) player.weapons.push(def.id);
      return true;
    case 'key':
    case 'keyCard':
      if (!player.keys.includes(def.id)) player.keys.push(def.id);
      return true;
    case 'equipment':
      // Ausruestung wird erst in Phase 3.6 zu Instanzen gewuerfelt.
      return false;
    default:
      player.consumables[def.id] = (player.consumables[def.id] ?? 0) + def.amount;
      return true;
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
  if (!stow(state, def)) return [];

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
    const def = content.enemies[entity.defId];
    if (def === undefined) continue;
    reward += scaledXpReward(def, entity.monsterLevel ?? 1, state.difficulty);
  }
  reapDead(mapState);
  return reward > 0 ? grantXp(state.player, reward, content.progression) : [];
}

/** Alle moeglichen Ziele einer Explosion, Spieler eingeschlossen. */
function splashTargets(
  state: GameState,
  content: ContentDb,
  mapState: MapRuntimeState
): SplashTarget[] {
  const targets: SplashTarget[] = [
    {
      ref: 'player',
      stats: playerDerived(state, content),
      vitals: state.player,
      pos: state.player.pos,
    },
  ];
  for (const entity of [...mapState.entities]) {
    if (entity.kind !== 'enemy' || !isAlive(entity)) continue;
    const actor = enemyActor(entity, content);
    if (actor === null) continue;
    targets.push({
      ref: entity.id,
      stats: getDerivedStats(actor, content, state.difficulty),
      vitals: vitalsOf(entity),
      pos: entity.pos,
    });
  }
  return targets;
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
  const targetActor = enemyActor(target, content);
  if (targetActor === null) return { ok: false, reason: 'unknown enemy' };

  const distance = chebyshev(state.player.pos, target.pos);
  if (distance > weapon.maxRange) return { ok: false, reason: 'target out of range' };
  if (!hasLineOfSight(here.map, state.player.pos, target.pos, here.mapState)) {
    return { ok: false, reason: 'no line of sight' };
  }

  const playerStats = playerDerived(state, content);
  if (ammoType !== null) {
    const saved = weapon.ammoPerShot > 0 && playerStats.ammoSaveChance > 0;
    if (!saved) {
      state.player.ammo[ammoType] = (state.player.ammo[ammoType] ?? 0) - weapon.ammoPerShot;
    }
  }

  const rng = loadRng(state);
  const events = resolveAttack(
    rng,
    { ref: 'player', stats: playerStats, vitals: state.player },
    {
      ref: target.id,
      stats: getDerivedStats(targetActor, content, state.difficulty),
      vitals: vitalsOf(target),
    },
    weapon,
    distance
  );
  saveRng(state, rng);
  target.active = true;

  const hit = events.some((event) => event.type === 'attack' && event.hit);
  const effectId = weapon.appliesEffect;
  if (hit && effectId !== undefined && isAlive(target)) {
    events.push(...applyEffectDefault(targetActor, effectId, content, state.difficulty));
  }

  const splash = weapon.splash;
  if (splash !== undefined) {
    events.push(
      ...applySplash(
        splashTargets(state, content, here.mapState),
        target.pos,
        splash,
        weapon.damageType,
        'player'
      )
    );
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

/** Benutzt ein Verbrauchsgut. Questgegenstaende sind nicht benutzbar. */
export function useConsumableAction(
  state: GameState,
  content: ContentDb,
  itemId: string
): ActionResult {
  const player = state.player;
  if ((player.consumables[itemId] ?? 0) <= 0) return { ok: false, reason: 'item not in inventory' };
  const def = content.items[itemId];
  if (def === undefined) return { ok: false, reason: 'unknown item' };
  if (def.type === 'quest') return { ok: false, reason: 'quest item cannot be used' };

  const events: GameEvent[] = [];
  if (def.type === 'heal') {
    const maxHealth = playerDerived(state, content).maxHealth;
    player.health = Math.min(maxHealth, player.health + def.amount);
  }

  const effect = def.effect;
  if (effect !== undefined) {
    events.push(
      ...applyEffectDefault(playerActor(state), effect.id, content, state.difficulty)
    );
  }

  player.consumables[itemId] = (player.consumables[itemId] ?? 0) - 1;
  events.push({ type: 'message', text: `used ${def.id}` });
  return { ok: true, events };
}

/** Waffenwechsel. Kostet keine Runde, SPEC 3.2. */
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

/** Verteilt einen Attributpunkt. Kostet keine Runde, SPEC 3.2. */
export function spendAttributeAction(state: GameState, attr: keyof Attributes): ActionResult {
  if (!spendAttributePoint(state.player, attr)) {
    return { ok: false, reason: 'no attribute point available' };
  }
  // Der Rundencache haelt sonst die alten abgeleiteten Werte fest.
  invalidatePlayerDerived(state);
  return { ok: true, events: [{ type: 'message', text: `spent point on ${attr}` }] };
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
