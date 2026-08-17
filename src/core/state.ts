/**
 * Aufbau, Serialisierung und Migration des Spielzustands.
 */
import { Rng } from './rng';
import { tileKey } from './grid';
import type {
  ContentDb,
  Entity,
  GameState,
  LogEntry,
  MapDef,
  MapEntityDef,
  MapRuntimeState,
  PlayerState,
} from './types';

/** Version der Savegame-Struktur. Bei Aenderungen erhoehen und migrate erweitern. */
export const CURRENT_SAVE_VERSION = 1;

/** Obergrenze des Logs nach INTERFACES Abschnitt 3. */
export const MAX_LOG_ENTRIES = 100;

/** Startwerte des Spielers nach SPEC 5.1. */
const PLAYER_START_STATS = {
  health: 50,
  maxHealth: 50,
  armor: 0,
  accuracy: 10,
  evasion: 5,
} as const;

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

function instantiate(def: MapEntityDef, id: number, content: ContentDb): Entity | null {
  const facing = def.facing ?? 0;
  const base: Entity = {
    id,
    kind: def.kind,
    defId: def.defId,
    pos: { x: def.pos.x, y: def.pos.y },
    facing,
    actionPoints: 0,
    active: false,
    animation: { frame: 'idle', startedAtTurn: 0 },
  };

  if (def.kind === 'enemy') {
    const enemyDef = content.enemies[def.defId];
    if (enemyDef === undefined) return null;
    base.stats = { ...enemyDef.stats };
    return base;
  }
  if (def.kind === 'door') {
    base.state = def.locked === undefined ? 'closed' : 'locked';
    return base;
  }
  return base;
}

/** Frischer Laufzeitzustand einer Karte, Entitaeten aus der Kartendefinition. */
export function createMapRuntime(map: MapDef, content: ContentDb): MapRuntimeState {
  const entities: Entity[] = [];
  let nextEntityId = 1;
  for (const def of map.entities) {
    const entity = instantiate(def, nextEntityId, content);
    if (entity === null) continue;
    entities.push(entity);
    nextEntityId += 1;
  }
  return {
    entities,
    nextEntityId,
    openedDoors: [],
    takenItems: [],
    firedTriggers: [],
    visited: true,
    explored: [],
  };
}

function createPlayer(map: MapDef, equippedWeaponId: string): PlayerState {
  return {
    pos: { x: map.spawn.pos.x, y: map.spawn.pos.y },
    facing: map.spawn.facing,
    stats: { ...PLAYER_START_STATS },
    level: 1,
    xp: 0,
    actionPoints: 0,
    equippedWeaponId,
    weapons: [equippedWeaponId],
    ammo: {},
    items: {},
    keys: [],
    effects: [],
  };
}

/**
 * Neues Spiel auf `startMapId`.
 * Die Startwaffe ist der erste Eintrag in `content.weapons`; INTERFACES.md sieht
 * kein Feld fuer eine Startwaffe vor, deshalb diese Konvention.
 */
export function createNewGame(seed: number, content: ContentDb, startMapId: string): GameState {
  const map = content.maps[startMapId];
  if (map === undefined) throw new Error(`unknown map: ${startMapId}`);

  const firstWeaponId = Object.keys(content.weapons)[0];
  if (firstWeaponId === undefined) throw new Error('content has no weapons');

  const mapState = createMapRuntime(map, content);
  mapState.explored.push(tileKey(map.spawn.pos));

  return {
    version: CURRENT_SAVE_VERSION,
    rngState: new Rng(seed).getState(),
    turnCount: 0,
    playTimeMs: 0,
    player: createPlayer(map, firstWeaponId),
    currentMapId: startMapId,
    maps: { [startMapId]: mapState },
    flags: {},
    log: [],
  };
}

/** Zustand als JSON. */
export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * Migrationskette. Aktuell reicht die passende Version durch,
 * jede unbekannte Version ist ein Fehler.
 */
export function migrate(raw: unknown): GameState {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('savegame is not an object');
  }
  const version = (raw as { version?: unknown }).version;
  if (typeof version !== 'number') {
    throw new Error('savegame has no version');
  }
  if (version !== CURRENT_SAVE_VERSION) {
    throw new Error(`unknown savegame version: ${version}`);
  }
  return raw as GameState;
}

/** JSON zurueck in einen Zustand, inklusive Migration. */
export function deserialize(json: string): GameState {
  return migrate(JSON.parse(json));
}
