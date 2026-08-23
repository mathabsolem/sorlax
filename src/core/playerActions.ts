/**
 * Einzelaktionen des Spielers. Jede Funktion prueft zuerst vollstaendig und
 * mutiert erst danach, damit ein ungueltiges Kommando den Zustand nicht anfasst.
 */
import { currentScene } from './actionResult';
import type { ActionResult } from './actionResult';
import { playerActor } from './derived';
import { applyBoon, applyEffect, removeEffect } from './effects';
import { BOON_STATS, EFFECT_DEFS, curedEffectId } from './effectDefs';
import type { EffectId } from './effectDefs';
import { doorAt, enemyAt, entitiesAt, removeEntity } from './entities';
import { isSolid, stepFrom, tileKey } from './grid';
import {
  IDENTIFY_ITEM_ID,
  addToInventory,
  createInstance,
  takeItemUid,
  findItem,
  groundItemsAt,
  removeGroundItem,
} from './items';
import { spendAttributePoint } from './progression';
import { ATTRIBUTE_NAMES } from './text';
import { fireTriggers, hasUsableTrigger } from './triggers';
import { invalidatePlayerDerived, playerDerived } from './turn';
import type {
  Attributes,
  ContentDb,
  GameEvent,
  GameState,
  ItemDef,
  MapRuntimeState,
  TileCoord,
} from './types';

/** Legt ein aufgesammeltes Item in das passende Inventarfach des Spielers. */
function stow(state: GameState, def: ItemDef, content: ContentDb): boolean {
  const player = state.player;
  switch (def.type) {
    case 'ammo': {
      // `ammoType` ist bei dieser Art Pflicht (INTERFACES v1.6). Fehlt sie,
      // gehoert der Gegenstand zu keiner Waffe und wird nicht eingesammelt.
      const ammoType = def.ammoType;
      if (ammoType === undefined) return false;
      player.ammo[ammoType] = (player.ammo[ammoType] ?? 0) + def.amount;
      return true;
    }
    case 'weapon': {
      // Eine gefundene Waffe wird zur Instanz im Inventar. `weapons` fuehrt
      // daneben die Grundtypen fuer die Waffenleiste (PHASE_3_8 Block 3).
      const instance = createInstance(takeItemUid(state), def.id, 1, 'normal', [], content);
      if (instance === null || !addToInventory(state, instance)) return false;
      const weaponId = def.weaponId;
      if (weaponId !== undefined && !player.weapons.includes(weaponId)) {
        player.weapons.push(weaponId);
      }
      return true;
    }
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

/**
 * Sammelt die Stapelware auf der Kachel ein. Mehrere Eintraege werden alle
 * genommen: ein getoeteter Gegner kann mehr als einen Stapel hinterlassen
 * (PHASE_3_6 Block 6).
 */
export function pickupAt(state: GameState, content: ContentDb, pos: TileCoord): GameEvent[] {
  const here = currentScene(state, content);
  if (here === null) return [];

  const events: GameEvent[] = [];
  for (const entity of entitiesAt(here.mapState, pos.x, pos.y)) {
    if (entity.kind !== 'item') continue;
    const def = content.items[entity.defId];
    if (def === undefined) continue;
    if (!stow(state, def, content)) continue;

    removeEntity(here.mapState, entity.id);
    const key = tileKey(pos);
    if (!here.mapState.takenItems.includes(key)) here.mapState.takenItems.push(key);
    events.push({ type: 'pickup', defId: def.id, amount: def.amount });
  }
  return events;
}

/**
 * Nimmt die Ausruestungsinstanzen auf, die auf der Kachel liegen, PHASE_3_6
 * Block 4. Mehrere Teile werden nacheinander aufgenommen, bis das Inventar voll
 * ist; der Rest bleibt liegen.
 */
export function pickupGroundItems(
  state: GameState,
  mapState: MapRuntimeState,
  pos: TileCoord
): GameEvent[] {
  const events: GameEvent[] = [];
  for (const entry of groundItemsAt(mapState, pos)) {
    if (!addToInventory(state, entry.item)) {
      events.push({ type: 'message', text: 'Das Inventar ist voll' });
      break;
    }
    removeGroundItem(mapState, entry.item.uid);
    events.push({ type: 'itemPickedUp', uid: entry.item.uid });
  }
  return events;
}

/** Tuer oder Schalter auf der Kachel direkt vor dem Spieler. */
export function interactAction(state: GameState, content: ContentDb): ActionResult {
  const here = currentScene(state, content);
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

/**
 * Benutzt ein Verbrauchsgut. Questgegenstaende sind nicht benutzbar.
 *
 * `targetUid` kommt aus INTERFACES v1.4 und benennt den Gegenstand, auf den
 * sich das Verbrauchsgut bezieht. Bisher braucht das nur `scanner_charge`.
 */
export function useConsumableAction(
  state: GameState,
  content: ContentDb,
  itemId: string,
  targetUid?: number
): ActionResult {
  const player = state.player;
  if ((player.consumables[itemId] ?? 0) <= 0) return { ok: false, reason: 'item not in inventory' };
  const def = content.items[itemId];
  if (def === undefined) return { ok: false, reason: 'unknown item' };
  if (def.type === 'quest') return { ok: false, reason: 'quest item cannot be used' };

  if (itemId === IDENTIFY_ITEM_ID) return identifyAction(state, content, targetUid);

  const events: GameEvent[] = [];
  if (def.type === 'heal') {
    const maxHealth = playerDerived(state, content).maxHealth;
    player.health = Math.min(maxHealth, player.health + def.amount);
  }

  const effect = def.effect;
  if (effect !== undefined) {
    const cured = curedEffectId(effect.id);
    if (cured !== null) {
      // `cure_toxin` entfernt `toxin` (CONTENT_TABLES Abschnitt 1).
      events.push(...removeEffect(playerActor(state), cured));
    } else if (BOON_STATS[effect.id] !== undefined) {
      events.push(
        ...applyBoon(playerActor(state), effect.id, effect.turns, effect.magnitude)
      );
    } else {
      events.push(
        ...applyEffect(
          playerActor(state),
          effect.id,
          EFFECT_DEFS[effect.id as EffectId]?.sourceType ?? 'physical',
          effect.magnitude,
          content,
          state.difficulty
        )
      );
    }
  }

  player.consumables[itemId] = (player.consumables[itemId] ?? 0) - 1;
  events.push({ type: 'message', text: `${def.name} benutzt` });
  return { ok: true, events };
}

/**
 * Identifiziert einen Gegenstand, RPG.md Abschnitt 4. Kostet eine Runde wie
 * jedes andere Verbrauchsgut.
 */
function identifyAction(
  state: GameState,
  content: ContentDb,
  targetUid?: number
): ActionResult {
  if (targetUid === undefined) return { ok: false, reason: 'no target for identify' };
  const target = findItem(state, targetUid);
  if (target === null) return { ok: false, reason: 'unknown item' };
  if (target.identified) return { ok: false, reason: 'item already identified' };

  target.identified = true;
  state.player.consumables[IDENTIFY_ITEM_ID] =
    (state.player.consumables[IDENTIFY_ITEM_ID] ?? 0) - 1;
  const name = content.items[target.baseId]?.name ?? target.baseId;
  return { ok: true, events: [{ type: 'message', text: `${name} untersucht` }] };
}

/**
 * Waffenwechsel, PHASE_3_8 Block 3. Sucht im Inventar die erste `ItemInstance`,
 * deren Grundtyp auf diesen `WeaponDef` verweist, und legt sie in den Platz
 * `weapon`. Die bisherige Waffe wandert zurueck ins Inventar.
 * Kostet keine Runde, SPEC 3.2.
 */
export function switchWeaponAction(
  state: GameState,
  content: ContentDb,
  weaponId: string
): ActionResult {
  if (content.weapons[weaponId] === undefined) return { ok: false, reason: 'unknown weapon' };

  const current = state.player.equipment['weapon'];
  if (current !== undefined && content.items[current.baseId]?.weaponId === weaponId) {
    return { ok: false, reason: 'weapon already equipped' };
  }

  const index = state.player.inventory.findIndex(
    (item) => content.items[item.baseId]?.weaponId === weaponId
  );
  if (index < 0) return { ok: false, reason: 'weapon not owned' };

  const [next] = state.player.inventory.splice(index, 1);
  if (next === undefined) return { ok: false, reason: 'weapon not owned' };
  state.player.equipment['weapon'] = next;
  // Der Platz im Inventar ist gerade frei geworden, die alte Waffe passt immer.
  if (current !== undefined) state.player.inventory.push(current);

  return { ok: true, events: [{ type: 'equipped', slot: 'weapon', uid: next.uid }] };
}

/** Verteilt einen Attributpunkt. Kostet keine Runde, SPEC 3.2. */
export function spendAttributeAction(state: GameState, attr: keyof Attributes): ActionResult {
  if (!spendAttributePoint(state.player, attr)) {
    return { ok: false, reason: 'no attribute point available' };
  }
  // Der Rundencache haelt sonst die alten abgeleiteten Werte fest.
  invalidatePlayerDerived(state);
  return {
    ok: true,
    events: [{ type: 'message', text: `Punkt auf ${ATTRIBUTE_NAMES[attr]}` }],
  };
}

/** Bewegungsziel pruefen und den Spieler versetzen. */
export function moveAction(
  state: GameState,
  content: ContentDb,
  dir: 'forward' | 'back' | 'left' | 'right'
): ActionResult {
  const here = currentScene(state, content);
  if (here === null) return { ok: false, reason: 'unknown map' };
  const target = stepFrom(state.player.pos, state.player.facing, dir);

  const door = doorAt(here.mapState, target.x, target.y);
  if (door !== undefined && door.state !== 'open') return { ok: false, reason: 'door is closed' };
  if (enemyAt(here.mapState, target.x, target.y) !== undefined) {
    return { ok: false, reason: 'tile occupied' };
  }
  // isSolid deckt Rand, Wand, Tuer und temporaere Wand gleichermassen ab
  // (PHASE_3_7 Block 1). Kein direkter Zugriff mehr auf `map.walls`.
  if (isSolid(here.map, target.x, target.y, here.mapState)) {
    return { ok: false, reason: 'blocked by wall' };
  }

  const from = { x: state.player.pos.x, y: state.player.pos.y };
  state.player.pos = { x: target.x, y: target.y };
  const key = tileKey(target);
  if (!here.mapState.explored.includes(key)) here.mapState.explored.push(key);

  const events: GameEvent[] = [{ type: 'moved', who: 'player', from, to: { ...target } }];
  events.push(...pickupAt(state, content, target));
  events.push(...pickupGroundItems(state, here.mapState, target));
  return { ok: true, events };
}
