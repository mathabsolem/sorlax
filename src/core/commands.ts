/**
 * `applyCommand` ist nach INTERFACES v1.2 Abschnitt 7 der einzige Weg, den
 * Zustand zu aendern. Der Zustand wird in place mutiert, zurueck kommt die
 * Ereignisliste.
 *
 * Kostenfrei sind laut SPEC 3.2: Drehen, Anlegen, Ablegen, Punkte verteilen,
 * Menue und Karte. Der Waffenwechsel steht nicht in der Tabelle und wird hier
 * ebenfalls kostenfrei gefuehrt.
 */
import { rotate, tileKey } from './grid';
import { attackAction } from './attack';
import type { ActionResult } from './actionResult';
import { dropItemAction, equipAction, unequipAction } from './equipActions';
import { updateExplored } from './explore';
import {
  interactAction,
  moveAction,
  spendAttributeAction,
  switchWeaponAction,
  useConsumableAction,
} from './playerActions';
import { assignSkillSlotAction, spendSkillPointAction, useSkillAction } from './skillActions';
import { createMapRuntime, pushLog } from './state';
import { findItem } from './items';
import { rollMapLoot } from './loot';
import { SLOT_NAMES, damageTypeName, effectName } from './text';
import { fireTriggers } from './triggers';
import { advanceRound, hasDeath } from './turn';
import type { Command, ContentDb, GameEvent, GameState } from './types';

function invalid(reason: string): GameEvent[] {
  return [{ type: 'invalid', reason }];
}

/** Name eines Gegenstands, egal ob getragen, im Inventar oder auf dem Boden. */
function itemNameOf(state: GameState, content: ContentDb, uid: number): string {
  const carried = findItem(state, uid);
  if (carried !== null) return content.items[carried.baseId]?.name ?? carried.baseId;

  const mapState = state.maps[state.currentMapId];
  const dropped = mapState?.groundItems.find((entry) => entry.item.uid === uid);
  if (dropped !== undefined) {
    return content.items[dropped.item.baseId]?.name ?? dropped.item.baseId;
  }
  return `Gegenstand ${uid}`;
}

/** Schreibt die spielrelevanten Ereignisse in das gekuerzte Log, auf Deutsch. */
function logEvents(state: GameState, content: ContentDb, events: GameEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      case 'attack':
        pushLog(
          state,
          'combat',
          event.hit
            ? `${damageTypeName(event.damageType)} trifft für ${event.damage}${
                event.crit ? ' (kritisch)' : ''
              }`
            : 'Daneben'
        );
        break;
      case 'effectApplied':
        pushLog(state, 'combat', `${effectName(event.effectId)} für ${event.turns} Runden`);
        break;
      case 'effectTick':
        pushLog(state, 'combat', `${effectName(event.effectId)} verursacht ${event.damage}`);
        break;
      case 'died':
        pushLog(
          state,
          'combat',
          event.who === 'player' ? 'Der Spieler ist gefallen' : `Gegner ${event.who} ist gefallen`
        );
        break;
      case 'pickup':
        pushLog(
          state,
          'pickup',
          `${content.items[event.defId]?.name ?? event.defId} aufgenommen (${event.amount})`
        );
        break;
      case 'itemPickedUp':
        pushLog(state, 'pickup', `${itemNameOf(state, content, event.uid)} aufgenommen`);
        break;
      case 'itemDropped':
        pushLog(state, 'pickup', `${itemNameOf(state, content, event.uid)} fallen gelassen`);
        break;
      case 'equipped':
        pushLog(
          state,
          'pickup',
          `${itemNameOf(state, content, event.uid)} angelegt (${SLOT_NAMES[event.slot]})`
        );
        break;
      case 'unequipped':
        pushLog(
          state,
          'pickup',
          `${itemNameOf(state, content, event.uid)} abgelegt (${SLOT_NAMES[event.slot]})`
        );
        break;
      case 'levelUp':
        pushLog(state, 'system', `Stufe ${event.newLevel} erreicht`);
        break;
      case 'skillUsed':
        pushLog(
          state,
          'skill',
          `${content.skills[event.skillId]?.name ?? event.skillId} eingesetzt`
        );
        break;
      case 'message':
        pushLog(state, 'story', event.text);
        break;
      default:
        break;
    }
  }
}

/**
 * Schliesst eine zeitkostende Aktion ab: bei Tod des Spielers nur noch `died`,
 * sonst die Gegnerrunde. Eine freie Aktion laesst die Runde ganz entfallen.
 */
function finishTurn(state: GameState, content: ContentDb, events: GameEvent[]): GameEvent[] {
  if (state.player.health <= 0) {
    state.player.health = 0;
    if (!hasDeath(events, 'player')) events.push({ type: 'died', who: 'player' });
    return events;
  }
  const round = advanceRound(state, content);
  if (round !== null) events.push(...round);
  return events;
}

/**
 * Wechsel auf die Zielkarte. `targetSpawnId` bleibt ungenutzt, weil MapDef nur
 * einen einzigen `spawn` kennt.
 */
function changeMap(state: GameState, content: ContentDb, targetMapId: string): GameEvent[] {
  const target = content.maps[targetMapId];
  if (target === undefined) return invalid(`unknown map: ${targetMapId}`);

  let runtime = state.maps[targetMapId];
  if (runtime === undefined) {
    // Erstes Betreten der Sohle: hier wird das Gegnerlevel festgeschrieben.
    runtime = createMapRuntime(target, content, state.player.level, state.difficulty);
    state.maps[targetMapId] = runtime;
  }
  runtime.visited = true;
  // Ausruestung und Drops werden beim ersten Betreten festgeschrieben (SPEC 3.3).
  rollMapLoot(state, target, content);

  state.currentMapId = targetMapId;
  state.player.pos = { x: target.spawn.pos.x, y: target.spawn.pos.y };
  state.player.facing = target.spawn.facing;
  const key = tileKey(state.player.pos);
  if (!runtime.explored.includes(key)) runtime.explored.push(key);
  updateExplored(state, content);

  return [{ type: 'mapChange', mapId: targetMapId }];
}

function handleMove(
  state: GameState,
  content: ContentDb,
  dir: 'forward' | 'back' | 'left' | 'right'
): GameEvent[] {
  const result = moveAction(state, content, dir);
  if (!result.ok) return invalid(result.reason);

  const events = result.events;
  // Nach jedem Schritt wird die Umgebung fuer die Automap aufgedeckt
  // (PHASE_4 Block 5).
  updateExplored(state, content);
  events.push(...fireTriggers(state, content, state.player.pos, 'enter'));

  const map = content.maps[state.currentMapId];
  const exit = map?.exits.find(
    (candidate) => candidate.pos.x === state.player.pos.x && candidate.pos.y === state.player.pos.y
  );

  finishTurn(state, content, events);

  if (exit !== undefined && state.player.health > 0) {
    events.push(...changeMap(state, content, exit.targetMapId));
  }
  return events;
}

function fromResult(state: GameState, content: ContentDb, result: ActionResult): GameEvent[] {
  if (!result.ok) return invalid(result.reason);
  return finishTurn(state, content, result.events);
}

/** Einziger Mutationspunkt des Spielzustands. */
export function applyCommand(state: GameState, cmd: Command, content: ContentDb): GameEvent[] {
  if (content.maps[state.currentMapId] === undefined || state.maps[state.currentMapId] === undefined) {
    return invalid('unknown map');
  }
  if (state.player.health <= 0) return invalid('player is dead');

  let events: GameEvent[];
  switch (cmd.type) {
    case 'turn': {
      // Drehen kostet keine Zeit (SPEC 3.2) und startet daher keine Runde.
      state.player.facing = rotate(state.player.facing, cmd.dir === 'cw' ? 1 : -1);
      events = [{ type: 'turned', who: 'player', facing: state.player.facing }];
      break;
    }
    case 'switchWeapon': {
      const result = switchWeaponAction(state, content, cmd.weaponId);
      events = result.ok ? result.events : invalid(result.reason);
      break;
    }
    case 'spendAttribute': {
      const result = spendAttributeAction(state, cmd.attr);
      events = result.ok ? result.events : invalid(result.reason);
      break;
    }
    // Anlegen, Ablegen und Fallenlassen kosten keine Runde (SPEC 3.2).
    case 'equip': {
      const result = equipAction(state, content, cmd.uid);
      events = result.ok ? result.events : invalid(result.reason);
      break;
    }
    case 'unequip': {
      const result = unequipAction(state, content, cmd.slot);
      events = result.ok ? result.events : invalid(result.reason);
      break;
    }
    case 'dropItem': {
      const result = dropItemAction(state, content, cmd.uid);
      events = result.ok ? result.events : invalid(result.reason);
      break;
    }
    case 'spendSkillPoint': {
      const result = spendSkillPointAction(state, content, cmd.skillId);
      events = result.ok ? result.events : invalid(result.reason);
      break;
    }
    case 'assignSkillSlot': {
      const result = assignSkillSlotAction(state, content, cmd.index, cmd.skillId);
      events = result.ok ? result.events : invalid(result.reason);
      break;
    }
    case 'move':
      events = handleMove(state, content, cmd.dir);
      break;
    case 'attack':
      events = fromResult(state, content, attackAction(state, content, cmd.targetId));
      break;
    case 'interact':
      events = fromResult(state, content, interactAction(state, content));
      break;
    case 'useConsumable':
      events = fromResult(
        state,
        content,
        useConsumableAction(state, content, cmd.itemId, cmd.targetUid)
      );
      break;
    case 'useSkill':
      // Kostet eine Runde wie ein Angriff (SPEC 3.2).
      events = fromResult(state, content, useSkillAction(state, content, cmd.skillId, cmd.targetId));
      break;
    case 'wait':
      events = fromResult(state, content, { ok: true, events: [] });
      break;
  }

  logEvents(state, content, events);
  return events;
}
