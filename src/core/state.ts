/**
 * Aufbau, Serialisierung und Migration des Spielzustands.
 */
import { getDerivedStats, playerActor } from './derived';
import { STARTER_WEAPON_ITEM, createInstance } from './items';
import { migrate } from './migrate';
import { tileKey } from './grid';
import { Rng } from './rng';
import { monsterLevelFor, scaledHealth } from './scaling';
import { rollMapLoot } from './loot';
import type {
  Attributes,
  ContentDb,
  Difficulty,
  Entity,
  GameState,
  LogEntry,
  MapDef,
  MapEntityDef,
  MapRuntimeState,
  PlayerState,
} from './types';

/** Version der Savegame-Struktur. Bei Aenderungen erhoehen und migrate erweitern. */
export const CURRENT_SAVE_VERSION = 4;

/** Obergrenze des Logs nach INTERFACES Abschnitt 4. */
export const MAX_LOG_ENTRIES = 100;

/** Obergrenze des Inventars. Liegt in items.ts, hier nur weitergereicht. */
export { MAX_INVENTORY } from './items';

/** RNG-Zugriff. Liegt in rng.ts, hier nur weitergereicht. */
export { loadRng, saveRng } from './rng';

/** Startwert je Attribut, RPG.md Abschnitt 1. */
export const START_ATTRIBUTE = 10;

export function startAttributes(): Attributes {
  return {
    strength: START_ATTRIBUTE,
    agility: START_ATTRIBUTE,
    vitality: START_ATTRIBUTE,
    focus: START_ATTRIBUTE,
  };
}

/** Haengt einen Logeintrag an und kuerzt vorne, sobald das Limit ueberschritten ist. */
export function pushLog(state: GameState, kind: LogEntry['kind'], text: string): void {
  state.log.push({ turn: state.turnCount, kind, text });
  if (state.log.length > MAX_LOG_ENTRIES) {
    state.log.splice(0, state.log.length - MAX_LOG_ENTRIES);
  }
}

function instantiate(
  def: MapEntityDef,
  id: number,
  content: ContentDb,
  monsterLevel: number,
  difficulty: Difficulty
): Entity | null {
  const facing = def.facing ?? 0;
  const base: Entity = {
    id,
    kind: def.kind,
    defId: def.defId,
    pos: { x: def.pos.x, y: def.pos.y },
    facing,
    actionPoints: 0,
    active: false,
    effects: [],
    animation: { frame: 'idle', startedAtTurn: 0 },
  };

  if (def.kind === 'enemy') {
    const enemyDef = content.enemies[def.defId];
    if (enemyDef === undefined) return null;
    base.monsterLevel = monsterLevel;
    base.health = scaledHealth(enemyDef, monsterLevel, difficulty);
    // Kein Vorgabewert: `undefined` heisst 'noch nicht gewuerfelt', und genau
    // daran erkennt rollMapLoot, wo forceRank Vorrang hat (PHASE_3_6 Block 6).
    if (def.forceRank !== undefined) base.rank = def.forceRank;
    if (enemyDef.behavior === 'scripted') base.scriptState = {};
    return base;
  }
  if (def.kind === 'door') {
    base.state = def.locked === undefined ? 'closed' : 'locked';
    return base;
  }
  return base;
}

/**
 * Frischer Laufzeitzustand einer Karte. Das Gegnerlevel wird hier einmal
 * bestimmt und in jeder Entitaet festgeschrieben (SPEC v1.2 Abschnitt 8).
 */
export function createMapRuntime(
  map: MapDef,
  content: ContentDb,
  playerLevel: number,
  difficulty: Difficulty
): MapRuntimeState {
  const monsterLevel = monsterLevelFor(map.depth, difficulty, playerLevel);
  const entities: Entity[] = [];
  let nextEntityId = 1;
  for (const def of map.entities) {
    const entity = instantiate(def, nextEntityId, content, monsterLevel, difficulty);
    if (entity === null) continue;
    entities.push(entity);
    nextEntityId += 1;
  }
  return {
    entities,
    nextEntityId,
    openedDoors: [],
    takenItems: [],
    groundItems: [],
    firedTriggers: [],
    tempWalls: [],
    rolled: false,
    visited: true,
    explored: [],
  };
}

function createPlayer(map: MapDef): PlayerState {
  return {
    pos: { x: map.spawn.pos.x, y: map.spawn.pos.y },
    facing: map.spawn.facing,
    health: 0, // wird gleich aus den abgeleiteten Werten gesetzt
    attributes: startAttributes(),
    unspentAttributePoints: 0,
    level: 1,
    xp: 0,
    actionPoints: 0,
    skills: {},
    unspentSkillPoints: 0,
    cooldowns: {},
    equipment: {},
    inventory: [],
    weapons: [],
    ammo: {},
    consumables: {},
    keys: [],
    effects: [],
  };
}

/**
 * Neues Spiel auf `startMapId`.
 * Der Spieler startet mit einer normalen Instanz der Brechstange im Platz
 * `weapon` (PHASE_3_8 Block 3, BESTIARY Abschnitt 7).
 */
export function createNewGame(
  seed: number,
  content: ContentDb,
  startMapId: string,
  difficulty: Difficulty = 'normal'
): GameState {
  const map = content.maps[startMapId];
  if (map === undefined) throw new Error(`unknown map: ${startMapId}`);

  const player = createPlayer(map);
  const state: GameState = {
    version: CURRENT_SAVE_VERSION,
    rngState: new Rng(seed).getState(),
    turnCount: 0,
    playTimeMs: 0,
    difficulty,
    unlockedDifficulties: ['normal'],
    nextItemUid: 1,
    player,
    currentMapId: startMapId,
    maps: {},
    flags: {},
    log: [],
  };

  const starter = createInstance(state, STARTER_WEAPON_ITEM, 1, 'normal', [], content);
  if (starter === null) throw new Error(`content has no ${STARTER_WEAPON_ITEM}`);
  player.equipment['weapon'] = starter;
  const starterWeaponId = content.items[STARTER_WEAPON_ITEM]?.weaponId;
  if (starterWeaponId !== undefined) player.weapons.push(starterWeaponId);

  const mapState = createMapRuntime(map, content, player.level, difficulty);
  mapState.explored.push(tileKey(map.spawn.pos));
  state.maps[startMapId] = mapState;
  rollMapLoot(state, map, content);

  player.health = getDerivedStats(playerActor(state), content, difficulty).maxHealth;
  return state;
}

/** Zustand als JSON. */
export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/** JSON zurueck in einen Zustand, inklusive Migration. */
export function deserialize(json: string): GameState {
  return migrate(JSON.parse(json));
}
