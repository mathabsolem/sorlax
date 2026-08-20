/**
 * Abgeleitete Werte nach RPG.md Abschnitt 2 fuer den Spieler und
 * SPEC v1.2 Abschnitt 8 fuer Gegner.
 *
 * Reine Funktion ohne Mutation. Der Rundencache liegt in turn.ts, nicht hier.
 *
 * Die Berechnung laeuft in zwei Durchgaengen (PHASE_3_6 Block 5): erst die
 * Attributsaffixe, dann alles, was auf den Attributen aufbaut. Ein
 * Rekursionsproblem entsteht dabei nicht, weil Attributsaffixe selbst nicht von
 * abgeleiteten Werten abhaengen.
 *
 * Passive Fertigkeiten wirken ueber `SkillDef.modifiers` und werden mit den
 * Beitraegen der Ausruestung zusammengefasst. `execution` ist kein Wert in
 * DerivedStats, sondern ein Zuschlag im Kampf und liegt deshalb in combat.ts.
 */
import { modifiersFor } from './difficulty';
import { DRAIN_ARMOR_PENALTY } from './effectDefs';
import {
  attributeBonus,
  collectEquipmentModifiers,
  collectSkillModifiers,
  magnitudeOf,
  mergeModifiers,
  ratioOf,
} from './modifiers';
import type { ModifierSums } from './modifiers';
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
  PlayerState,
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

function clampChance(value: number): number {
  return Math.min(1, Math.max(0, value));
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

/**
 * Resistenzen eines Akteurs: Grundwert plus Ausruestung, dann die Gradstrafe
 * beziehungsweise der Gradbonus, zuletzt der Deckel (PHASE_3_6 Block 5).
 */
function resistancesFrom(
  sums: ModifierSums,
  base: (type: (typeof DAMAGE_TYPES)[number]) => number,
  offset: number,
  clamp: (value: number) => number
): Resistances {
  const resistances = zeroResistances();
  for (const type of DAMAGE_TYPES) {
    const withGear = magnitudeOf(sums, `res_${type}`, base(type));
    resistances[type] = clamp(Math.round(withGear + offset));
  }
  return resistances;
}

/** Deckelt eine Gegnerresistenz nach oben, siehe ENEMY_RESIST_CAP. */
function clampEnemyResistance(value: number): number {
  return Math.min(ENEMY_RESIST_CAP, value);
}

function playerStats(
  player: PlayerState,
  content: ContentDb,
  difficulty: Difficulty
): DerivedStats {
  // Ausruestung und passive Fertigkeiten tragen nach denselben Regeln bei
  // (PHASE_3_7 Block 3).
  const sums = mergeModifiers(
    collectEquipmentModifiers(player.equipment, content),
    collectSkillModifiers(player.skills, content)
  );
  const attributes = attributeBonus(sums, player.attributes);
  const penalty = modifiersFor(difficulty).playerResistPenalty;

  const stats: DerivedStats = {
    maxHealth: Math.round(magnitudeOf(sums, 'maxHealth', 20 + 3 * attributes.vitality)),
    accuracy: Math.floor(magnitudeOf(sums, 'accuracy', Math.floor(4 + 0.6 * attributes.agility))),
    evasion: Math.floor(magnitudeOf(sums, 'evasion', Math.floor(1 + 0.4 * attributes.agility))),
    armor: Math.floor(magnitudeOf(sums, 'armor', 0)),
    meleeBonus: 0.01 * (attributes.strength - 10) + ratioOf(sums, 'meleeBonus'),
    elemBonus: 0.01 * (attributes.focus - 10) + ratioOf(sums, 'elemBonus'),
    critBonus: 0.002 * (attributes.focus - 10) + ratioOf(sums, 'critBonus'),
    resistances: resistancesFrom(sums, () => 0, penalty, clampPlayerResistance),
    lightRadius: Math.round(magnitudeOf(sums, 'lightRadius', BASE_LIGHT_RADIUS)),
    freeActionChance: clampChance(ratioOf(sums, 'freeActionChance')),
    ammoSaveChance: clampChance(ratioOf(sums, 'ammoSaveChance')),
  };

  applyEffects(stats, player.effects);
  return stats;
}

function enemyStats(
  actor: Extract<Actor, { kind: 'enemy' }>,
  content: ContentDb,
  difficulty: Difficulty
): DerivedStats {
  const { def, monsterLevel } = actor;
  const mods = modifiersFor(difficulty);
  const factor = 1 + 0.045 * (monsterLevel - 1);
  const sums = collectEquipmentModifiers(actor.entity.equipment ?? {}, content);

  const stats: DerivedStats = {
    maxHealth: Math.round(
      magnitudeOf(sums, 'maxHealth', def.baseHealth * factor * mods.healthFactor)
    ),
    accuracy: Math.floor(
      magnitudeOf(sums, 'accuracy', def.baseAccuracy + Math.floor(monsterLevel * 0.8))
    ),
    evasion: Math.floor(
      magnitudeOf(sums, 'evasion', def.baseEvasion + Math.floor(monsterLevel / 3))
    ),
    armor: Math.floor(magnitudeOf(sums, 'armor', def.baseArmor + Math.floor(monsterLevel / 6))),
    meleeBonus: ratioOf(sums, 'meleeBonus'),
    elemBonus: ratioOf(sums, 'elemBonus'),
    critBonus: ratioOf(sums, 'critBonus'),
    resistances: resistancesFrom(
      sums,
      (type) => def.resistances[type] ?? 0,
      mods.enemyResistBonus,
      clampEnemyResistance
    ),
    // RPG.md Abschnitt 9: Sichtweite wird bei Gegnern auf aggroRange abgebildet.
    // Deshalb wirkt `suf_of_the_lamp` hier auf die Aggroreichweite.
    lightRadius: Math.round(magnitudeOf(sums, 'lightRadius', def.aggroRange)),
    freeActionChance: clampChance(ratioOf(sums, 'freeActionChance')),
    ammoSaveChance: clampChance(ratioOf(sums, 'ammoSaveChance')),
  };

  applyEffects(stats, actor.entity.effects);
  return stats;
}

/**
 * Abgeleitete Werte eines Akteurs. Veraendert weder den Akteur noch die Inhalte.
 */
export function getDerivedStats(
  actor: Actor,
  content: ContentDb,
  difficulty: Difficulty
): DerivedStats {
  if (actor.kind === 'player') {
    return playerStats(actor.state, content, difficulty);
  }
  return enemyStats(actor, content, difficulty);
}

/**
 * Attribute des Spielers einschliesslich der Zuschlaege aus der Ausruestung.
 * Das sind die Werte, gegen die `reqStrength` und `reqAgility` gepruefen werden.
 */
export function effectiveAttributes(state: GameState, content: ContentDb): Attributes {
  const sums = mergeModifiers(
    collectEquipmentModifiers(state.player.equipment, content),
    collectSkillModifiers(state.player.skills, content)
  );
  return attributeBonus(sums, state.player.attributes);
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
