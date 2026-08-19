/**
 * Aufbau, Serialisierung und Migration des Spielzustands.
 */
import { getDerivedStats, playerActor } from './derived';
import { EFFECT_DEFS, isEffectId } from './effectDefs';
import { tileKey } from './grid';
import { Rng } from './rng';
import { monsterLevelFor, scaledHealth } from './scaling';
import type {
  ActiveEffect,
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

// --- Migration von Version 1 --------------------------------------------------

/** Kampfwerte, wie Version 1 sie gespeichert hat. */
type LegacyStats = {
  health: number;
  maxHealth: number;
  armor: number;
  accuracy: number;
  evasion: number;
};

type LegacyEffect = { id: string; remainingTurns: number; magnitude: number };

type LegacyEntity = Omit<Entity, 'health' | 'effects'> & { stats?: LegacyStats };

type LegacyMapRuntime = Omit<MapRuntimeState, 'entities' | 'groundItems' | 'rolled'> & {
  entities: LegacyEntity[];
};

type LegacyPlayer = Omit<
  PlayerState,
  | 'health'
  | 'attributes'
  | 'unspentAttributePoints'
  | 'skills'
  | 'unspentSkillPoints'
  | 'cooldowns'
  | 'equipment'
  | 'inventory'
  | 'consumables'
  | 'effects'
> & {
  stats: LegacyStats;
  items: Record<string, number>;
  effects: LegacyEffect[];
};

type LegacyState = Omit<
  GameState,
  'player' | 'maps' | 'difficulty' | 'unlockedDifficulties' | 'nextItemUid'
> & {
  player: LegacyPlayer;
  maps: Record<string, LegacyMapRuntime>;
};

/**
 * Attribute aus den alten Kampfwerten zurueckrechnen. Die Umkehrung der Formeln
 * aus RPG.md Abschnitt 2, Kraft und Fokus gab es damals nicht.
 */
function attributesFromLegacy(stats: LegacyStats): Attributes {
  return {
    vitality: Math.round((stats.maxHealth - 20) / 3),
    agility: Math.round((stats.accuracy - 4) / 0.6),
    strength: START_ATTRIBUTE,
    focus: START_ATTRIBUTE,
  };
}

/** Alte Effekte kannten die Quelle nicht, sie kommt aus der Effekttabelle. */
function effectFromLegacy(effect: LegacyEffect): ActiveEffect {
  const sourceType = isEffectId(effect.id) ? EFFECT_DEFS[effect.id].sourceType : 'physical';
  return {
    id: effect.id,
    remainingTurns: effect.remainingTurns,
    magnitude: effect.magnitude,
    sourceType,
  };
}

function entityFromLegacy(entity: LegacyEntity): Entity {
  const { stats, ...rest } = entity;
  const migrated: Entity = { ...rest, effects: [] };
  if (stats !== undefined) {
    migrated.health = stats.health;
    migrated.monsterLevel = 1;
    migrated.rank = 'common';
  }
  return migrated;
}

function migrateV1(old: LegacyState): GameState {
  const maps: Record<string, MapRuntimeState> = {};
  for (const [id, runtime] of Object.entries(old.maps)) {
    maps[id] = {
      ...runtime,
      entities: runtime.entities.map(entityFromLegacy),
      groundItems: [],
      rolled: false,
    };
  }

  const { stats, items, effects, ...playerRest } = old.player;
  const player: PlayerState = {
    ...playerRest,
    health: stats.health,
    attributes: attributesFromLegacy(stats),
    unspentAttributePoints: 0,
    skills: {},
    unspentSkillPoints: 0,
    cooldowns: {},
    equipment: {},
    inventory: [],
    consumables: { ...items },
    effects: effects.map(effectFromLegacy),
  };

  const { player: _oldPlayer, maps: _oldMaps, ...rest } = old;
  return {
    ...rest,
    version: CURRENT_SAVE_VERSION,
    difficulty: 'normal',
    unlockedDifficulties: ['normal'],
    nextItemUid: 1,
    player,
    maps,
  };
}

/**
 * Migrationskette. Version 1 wird auf Attribute umgerechnet, Version 2 wird
 * durchgereicht, jede unbekannte Version ist ein Fehler.
 */
export function migrate(raw: unknown): GameState {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('savegame is not an object');
  }
  const version = (raw as { version?: unknown }).version;
  if (typeof version !== 'number') {
    throw new Error('savegame has no version');
  }
  if (version === 1) {
    return migrateV1(raw as LegacyState);
  }
  if (version === CURRENT_SAVE_VERSION) {
    return raw as GameState;
  }
  throw new Error(`unknown savegame version: ${version}`);
}

/** JSON zurueck in einen Zustand, inklusive Migration. */
export function deserialize(json: string): GameState {
  return migrate(JSON.parse(json));
}
