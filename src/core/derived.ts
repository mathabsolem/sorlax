/**
 * Abgeleitete Werte nach RPG.md Abschnitt 2 fuer den Spieler und
 * SPEC v1.2 Abschnitt 8 fuer Gegner.
 *
 * Reine Funktion ohne Mutation. Der Rundencache liegt in turn.ts, nicht hier.
 *
 * In dieser Phase tragen Ausruestung und Fertigkeiten null bei; die Stellen sind
 * markiert und werden in Phase 3.6 nachgezogen. Die Signatur ist final.
 */
import { modifiersFor } from './difficulty';
import { DRAIN_ARMOR_PENALTY } from './effectDefs';
import { DAMAGE_TYPES } from './types';
import type {
  ActiveEffect,
  Actor,
  Attributes,
  ContentDb,
  DerivedStats,
  Difficulty,
  Entity,
  GameState,
  Resistances,
} from './types';

/** Obergrenze der Spielerresistenz, RPG.md Abschnitt 6. */
export const PLAYER_RESIST_CAP = 75;

/**
 * Obergrenze der Gegnerresistenz. SPEC nennt nur die Spielergrenze; der
 * Wertebereich von `Resistances` in INTERFACES ist mit -100 bis 90 angegeben.
 */
export const ENEMY_RESIST_CAP = 90;

/** Sichtweite ohne Ausruestung, RPG.md Abschnitt 2. */
export const BASE_LIGHT_RADIUS = 4;

export function zeroResistances(): Resistances {
  return { physical: 0, fire: 0, poison: 0, ice: 0, shock: 0, void: 0 };
}

/** Deckelt eine Spielerresistenz nach oben. Nach unten ist sie unbegrenzt. */
export function clampPlayerResistance(value: number): number {
  return Math.min(PLAYER_RESIST_CAP, value);
}

function findEffect(effects: readonly ActiveEffect[], id: string): ActiveEffect | undefined {
  return effects.find((effect) => effect.id === id && effect.remainingTurns > 0);
}

/** Wirkung laufender Statuseffekte auf die abgeleiteten Werte, SPEC 4.5. */
function applyEffects(stats: DerivedStats, effects: readonly ActiveEffect[]): void {
  const jolt = findEffect(effects, 'jolt');
  if (jolt !== undefined) {
    stats.accuracy -= jolt.magnitude;
  }

  const drain = findEffect(effects, 'drain');
  if (drain !== undefined) {
    stats.maxHealth = Math.max(1, Math.round(stats.maxHealth * (1 - drain.magnitude / 100)));
    stats.armor -= DRAIN_ARMOR_PENALTY;
  }
}

function playerStats(attributes: Attributes, effects: readonly ActiveEffect[], difficulty: Difficulty): DerivedStats {
  const penalty = modifiersFor(difficulty).playerResistPenalty;
  const resistances = zeroResistances();
  for (const type of DAMAGE_TYPES) {
    // Grundwert 0 plus Ausruestung und Fertigkeiten (Phase 3.6), dann Gradstrafe.
    resistances[type] = clampPlayerResistance(0 + penalty);
  }

  const stats: DerivedStats = {
    maxHealth: 20 + 3 * attributes.vitality,
    accuracy: Math.floor(4 + 0.6 * attributes.agility),
    evasion: Math.floor(1 + 0.4 * attributes.agility),
    armor: 0,
    meleeBonus: 0.01 * (attributes.strength - 10),
    elemBonus: 0.01 * (attributes.focus - 10),
    critBonus: 0.002 * (attributes.focus - 10),
    resistances,
    lightRadius: BASE_LIGHT_RADIUS,
    freeActionChance: 0,
    ammoSaveChance: 0,
  };

  applyEffects(stats, effects);
  return stats;
}

function enemyStats(
  actor: Extract<Actor, { kind: 'enemy' }>,
  difficulty: Difficulty
): DerivedStats {
  const { def, monsterLevel } = actor;
  const mods = modifiersFor(difficulty);
  const factor = 1 + 0.045 * (monsterLevel - 1);

  const resistances = zeroResistances();
  for (const type of DAMAGE_TYPES) {
    const base = def.resistances[type] ?? 0;
    resistances[type] = Math.min(ENEMY_RESIST_CAP, base + mods.enemyResistBonus);
  }

  const stats: DerivedStats = {
    maxHealth: Math.round(def.baseHealth * factor * mods.healthFactor),
    accuracy: def.baseAccuracy + Math.floor(monsterLevel * 0.8),
    evasion: def.baseEvasion + Math.floor(monsterLevel / 3),
    armor: def.baseArmor + Math.floor(monsterLevel / 6),
    meleeBonus: 0,
    elemBonus: 0,
    critBonus: 0,
    resistances,
    // RPG.md Abschnitt 9: Sichtweite wird bei Gegnern auf aggroRange abgebildet.
    lightRadius: def.aggroRange,
    freeActionChance: 0,
    ammoSaveChance: 0,
  };

  applyEffects(stats, actor.entity.effects);
  return stats;
}

/**
 * Abgeleitete Werte eines Akteurs. Veraendert weder den Akteur noch die Inhalte.
 * Der zweite Parameter heisst in INTERFACES `content`; er wird erst ab Phase 3.6
 * fuer Affixe und Fertigkeiten ausgewertet und traegt bis dahin den Unterstrich.
 */
export function getDerivedStats(
  actor: Actor,
  _content: ContentDb,
  difficulty: Difficulty
): DerivedStats {
  if (actor.kind === 'player') {
    return playerStats(actor.state.attributes, actor.state.effects, difficulty);
  }
  return enemyStats(actor, difficulty);
}

/** Akteur des Spielers fuer getDerivedStats. */
export function playerActor(state: GameState): Actor {
  return { kind: 'player', state: state.player };
}

/**
 * Akteur eines Gegners. Liefert null, wenn die Definition fehlt oder die
 * Entitaet kein Gegner ist. `monsterLevel` wird beim Spawn festgeschrieben.
 */
export function enemyActor(entity: Entity, content: ContentDb): Actor | null {
  if (entity.kind !== 'enemy') return null;
  const def = content.enemies[entity.defId];
  if (def === undefined) return null;
  return { kind: 'enemy', entity, def, monsterLevel: entity.monsterLevel ?? 1 };
}
