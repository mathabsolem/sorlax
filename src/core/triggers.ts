/**
 * Kartentrigger nach INTERFACES Abschnitt 6.
 */
import { createEnemyEntity, doorAt } from './entities';
import { tileKey } from './grid';
import type {
  ContentDb,
  GameEvent,
  GameState,
  MapRuntimeState,
  TileCoord,
  TriggerAction,
} from './types';

function runAction(
  state: GameState,
  mapState: MapRuntimeState,
  content: ContentDb,
  action: TriggerAction
): GameEvent[] {
  switch (action.type) {
    case 'openDoor': {
      const door = doorAt(mapState, action.pos.x, action.pos.y);
      if (door === undefined || door.state === 'open') return [];
      door.state = 'open';
      const key = tileKey(action.pos);
      if (!mapState.openedDoors.includes(key)) mapState.openedDoors.push(key);
      return [{ type: 'doorChanged', pos: { x: action.pos.x, y: action.pos.y }, state: 'open' }];
    }
    case 'spawn': {
      const def = content.enemies[action.defId];
      if (def === undefined) return [];
      const entity = createEnemyEntity(
        mapState.nextEntityId,
        action.defId,
        action.pos,
        0,
        def.stats
      );
      mapState.nextEntityId += 1;
      mapState.entities.push(entity);
      return [];
    }
    case 'message':
      return [{ type: 'message', text: action.text }];
    case 'setFlag':
      state.flags[action.key] = action.value;
      return [];
    case 'damage':
      state.player.stats.health -= action.amount;
      return [{ type: 'message', text: `took ${action.amount} damage` }];
  }
}

/**
 * Feuert alle passenden Trigger auf einer Kachel.
 * `once`-Trigger werden in `firedTriggers` vermerkt und danach uebersprungen.
 */
export function fireTriggers(
  state: GameState,
  content: ContentDb,
  pos: TileCoord,
  on: 'enter' | 'use'
): GameEvent[] {
  const map = content.maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  if (map === undefined || mapState === undefined) return [];

  const events: GameEvent[] = [];
  for (const trigger of map.triggers) {
    if (trigger.on !== on) continue;
    if (trigger.pos.x !== pos.x || trigger.pos.y !== pos.y) continue;
    if (trigger.once && mapState.firedTriggers.includes(trigger.id)) continue;
    if (trigger.once) mapState.firedTriggers.push(trigger.id);
    for (const action of trigger.actions) {
      events.push(...runAction(state, mapState, content, action));
    }
  }
  return events;
}

/** Gibt es auf dieser Kachel einen noch feuerbereiten `use`-Trigger? */
export function hasUsableTrigger(state: GameState, content: ContentDb, pos: TileCoord): boolean {
  const map = content.maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  if (map === undefined || mapState === undefined) return false;
  return map.triggers.some(
    (trigger) =>
      trigger.on === 'use' &&
      trigger.pos.x === pos.x &&
      trigger.pos.y === pos.y &&
      !(trigger.once && mapState.firedTriggers.includes(trigger.id))
  );
}
