/**
 * Aufbau, Serialisierung und Migration des Spielzustands.
 */
import { getDerivedStats, playerActor } from './derived';
import { migrate } from './migrate';
import { tileKey } from './grid';
import { Rng } from './rng';
import { monsterLevelFor, scaledHealth } from './scaling';
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
export const CURRENT_SAVE_VERSION = 2;

/** Obergrenze des Logs nach INTERFACES Abschnitt 4. */
export const MAX_LOG_ENTRIES = 100;

/** Startwert je Attribut, RPG.md Abschnitt 1. */
export const START_ATTRIBUTE = 10;

/** Obergrenze des Inventars, RPG.md Abschnitt 4. */
export const MAX_INVENTORY = 40;

export function startAttributes(): Attributes {
  return {
    strength: START_ATTRIBUTE,
    agility: START_ATTRIBUTE,
    vitality: START_ATTRIBUTE,
    focus: START_ATTRIBUTE,
  };
}

/** Laedt den RNG aus dem Zustand. */
export function loadRng(state: GameState): Rng {
  const rng = new Rng(0);
  rng.setState(state.rngState);
  return rng;
}

/** Schreibt den RNG-Zustand zurueck, damit der Spielverlauf reproduzierbar bleibt. */
export function saveRng(state: GameState, rng: Rng): void {
  state.rngState = rng.getState();
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
    base.rank = def.forceRank ?? 'common';
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
    rolled: false,
    visited: true,
    explored: [],
  };
}

function createPlayer(map: MapDef, equippedWeaponId: string): PlayerState {
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
    weapons: [equippedWeaponId],
    equippedWeaponId,
    ammo: {},
    consumables: {},
    keys: [],
    effects: [],
  };
}

/**
 * Neues Spiel auf `startMapId`.
 * Die Startwaffe ist der erste Eintrag in `content.weapons`; INTERFACES sieht
 * kein Feld fuer eine Startwaffe vor, deshalb diese Konvention.
 */
export function createNewGame(
  seed: number,
  content: ContentDb,
  startMapId: string,
  difficulty: Difficulty = 'normal'
): GameState {
  const map = content.maps[startMapId];
  if (map === undefined) throw new Error(`unknown map: ${startMapId}`);

  const firstWeaponId = Object.keys(content.weapons)[0];
  if (firstWeaponId === undefined) throw new Error('content has no weapons');

  const player = createPlayer(map, firstWeaponId);
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

  const mapState = createMapRuntime(map, content, player.level, difficulty);
  mapState.explored.push(tileKey(map.spawn.pos));
  state.maps[startMapId] = mapState;

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
