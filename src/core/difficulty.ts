/**
 * Schwierigkeitsgrade nach SPEC v1.2 Abschnitt 8 und RPG.md Abschnitt 6.
 * Reine Tabelle, damit derived.ts und scaling.ts dieselben Zahlen benutzen.
 */
import type { Difficulty } from './types';

export type DifficultyModifiers = {
  /** Stufenversatz auf die Sohlenbasis. */
  levelOffset: number;
  /** Aufschlag auf die Spielerresistenzen, negativ. */
  playerResistPenalty: number;
  healthFactor: number;
  damageFactor: number;
  xpFactor: number;
  /** Aufschlag auf die Gegnerresistenzen. */
  enemyResistBonus: number;
};

export const DIFFICULTY_MODIFIERS: Record<Difficulty, DifficultyModifiers> = {
  normal: {
    levelOffset: 0,
    playerResistPenalty: 0,
    healthFactor: 1.0,
    damageFactor: 1.0,
    xpFactor: 1.0,
    enemyResistBonus: 0,
  },
  hard: {
    levelOffset: 18,
    playerResistPenalty: -40,
    healthFactor: 1.9,
    damageFactor: 1.6,
    xpFactor: 2.0,
    enemyResistBonus: 25,
  },
  nightmare: {
    levelOffset: 36,
    playerResistPenalty: -100,
    healthFactor: 3.2,
    damageFactor: 2.4,
    xpFactor: 3.0,
    enemyResistBonus: 50,
  },
};

/** Reihenfolge der Freischaltung. Ein Grad wird durch Sorlax im vorherigen geoeffnet. */
export const DIFFICULTY_ORDER: readonly Difficulty[] = ['normal', 'hard', 'nightmare'];

export function modifiersFor(difficulty: Difficulty): DifficultyModifiers {
  return DIFFICULTY_MODIFIERS[difficulty];
}
