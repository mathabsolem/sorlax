/**
 * `applyCommand` ist nach INTERFACES Abschnitt 4 der einzige Weg, den Zustand zu
 * aendern. Der Zustand wird in place mutiert, zurueck kommt die Ereignisliste.
 */
import { rotate, tileKey } from './grid';
import {
  attackAction,
  interactAction,
  moveAction,
  switchWeaponAction,
  useItemAction,
} from './playerActions';
import type { ActionResult } from './playerActions';
import { createMapRuntime, pushLog } from './state';
import { fireTriggers } from './triggers';
import { advanceRound } from './turn';
import type { Command, ContentDb, GameEvent, GameState } from './types';

function invalid(reason: string): GameEvent[] {
  return [{ type: 'invalid', reason }];
}

/** Schreibt die spielrelevanten Ereignisse in das gekuerzte Log. */
function logEvents(state: GameState, events: GameEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      case 'attack':
        pushLog(
          state,
          'combat',
          event.hit ? `hit for ${event.damage}${event.crit ? ' (crit)' : ''}` : 'missed'
        );
        break;
      case 'died':
        pushLog(state, 'combat', `${event.who === 'player' ? 'player' : `entity ${event.who}`} died`);
        break;
      case 'pickup':
        pushLog(state, 'pickup', `picked up ${event.defId} x${event.amount}`);
        break;
      case 'levelUp':
        pushLog(state, 'system', `reached level ${event.newLevel}`);
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
 * sonst die Gegnerrunde.
 */
function finishTurn(state: GameState, content: ContentDb, events: GameEvent[]): GameEvent[] {
  if (state.player.stats.health <= 0) {
    state.player.stats.health = 0;
    events.push({ type: 'died', who: 'player' });
    return events;
  }
  events.push(...advanceRound(state, content));
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
    runtime = createMapRuntime(target, content);
    state.maps[targetMapId] = runtime;
  }
  runtime.visited = true;

  state.currentMapId = targetMapId;
  state.player.pos = { x: target.spawn.pos.x, y: target.spawn.pos.y };
  state.player.facing = target.spawn.facing;
  const key = tileKey(state.player.pos);
  if (!runtime.explored.includes(key)) runtime.explored.push(key);

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
  events.push(...fireTriggers(state, content, state.player.pos, 'enter'));

  const map = content.maps[state.currentMapId];
  const exit = map?.exits.find(
    (candidate) => candidate.pos.x === state.player.pos.x && candidate.pos.y === state.player.pos.y
  );

  finishTurn(state, content, events);

  if (exit !== undefined && state.player.stats.health > 0) {
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
  if (state.player.stats.health <= 0) return invalid('player is dead');

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
    case 'move':
      events = handleMove(state, content, cmd.dir);
      break;
    case 'attack':
      events = fromResult(state, content, attackAction(state, content, cmd.targetId));
      break;
    case 'interact':
      events = fromResult(state, content, interactAction(state, content));
      break;
    case 'useItem':
      events = fromResult(state, content, useItemAction(state, content, cmd.itemId));
      break;
    case 'wait':
      events = fromResult(state, content, { ok: true, events: [] });
      break;
  }

  logEvents(state, events);
  return events;
}
