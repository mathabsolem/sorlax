/**
 * Migrationskette fuer Spielstaende.
 *
 * Version 1 kannte `PlayerState.stats` als Wahrheit. Ab Version 2 sind nur noch
 * Attribute und `health` gespeichert, alles andere entsteht in getDerivedStats.
 * Version 3 ergaenzt `MapRuntimeState.tempWalls` (INTERFACES v1.2.1).
 *
 * Die Kette laeuft in Stufen: 1 auf 2, dann 2 auf 3. Jede Stufe kennt nur ihren
 * eigenen Schritt.
 */
import { EFFECT_DEFS, isEffectId } from './effectDefs';
import { CURRENT_SAVE_VERSION, START_ATTRIBUTE } from './state';
import type {
  ActiveEffect,
  Attributes,
  Entity,
  GameState,
  MapRuntimeState,
  PlayerState,
} from './types';

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

// --- Migration von Version 2 --------------------------------------------------

/** Version 2 kannte noch keine temporaeren Waende. */
type V2MapRuntime = Omit<MapRuntimeState, 'tempWalls'>;

type V2State = Omit<GameState, 'maps'> & { maps: Record<string, V2MapRuntime> };

function migrateV2(old: V2State): GameState {
  const maps: Record<string, MapRuntimeState> = {};
  for (const [id, runtime] of Object.entries(old.maps)) {
    maps[id] = { ...runtime, tempWalls: [] };
  }
  return { ...old, version: CURRENT_SAVE_VERSION, maps };
}

function migrateV1(old: LegacyState): V2State {
  const maps: Record<string, V2MapRuntime> = {};
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
    version: 2,
    difficulty: 'normal',
    unlockedDifficulties: ['normal'],
    nextItemUid: 1,
    player,
    maps,
  };
}

/**
 * Migrationskette. Jede Version wird ueber alle Zwischenstufen hochgezogen,
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
  if (version === 1) {
    return migrateV2(migrateV1(raw as LegacyState));
  }
  if (version === 2) {
    return migrateV2(raw as V2State);
  }
  if (version === CURRENT_SAVE_VERSION) {
    return raw as GameState;
  }
  throw new Error(`unknown savegame version: ${version}`);
}
