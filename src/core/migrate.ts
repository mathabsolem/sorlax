/**
 * Migrationskette fuer Spielstaende.
 *
 * Version 1 kannte `PlayerState.stats` als Wahrheit. Ab Version 2 sind nur noch
 * Attribute und `health` gespeichert, alles andere entsteht in getDerivedStats.
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
