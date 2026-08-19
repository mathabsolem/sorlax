/**
 * Gegnerlevel und Stufenskalierung nach SPEC v1.2 Abschnitt 8 und
 * RPG.md Abschnitt 7.
 *
 * `monsterLevel` wird beim ersten Betreten der Sohle berechnet und in
 * `Entity.monsterLevel` festgeschrieben. Es aendert sich danach nicht mehr, auch
 * nicht wenn der Spieler aufsteigt. Sonst wuerden Gegner mitten im Kampf
 * staerker, sobald der Spieler ein Level aufsteigt.
 */
import { modifiersFor } from './difficulty';
import type { Difficulty, EnemyDef, WeaponDef } from './types';

/** Wie weit ein Gegner ueber die Basis der Sohle hinauswachsen darf. */
export const MONSTER_LEVEL_HEADROOM = 6;

/** Grundstufe einer Sohle, vor der Anpassung an den Spieler. */
export function depthBaseLevel(depth: number, difficulty: Difficulty): number {
  return Math.round(depth * 1.6) + modifiersFor(difficulty).levelOffset;
}

/**
 * Stufe der Gegner einer Sohle. Waechst mit dem Spieler, aber hoechstens sechs
 * Stufen ueber die Basis hinaus, und faellt nie unter die Basis.
 */
export function monsterLevelFor(
  depth: number,
  difficulty: Difficulty,
  playerLevel: number
): number {
  const base = depthBaseLevel(depth, difficulty);
  return Math.min(base + MONSTER_LEVEL_HEADROOM, Math.max(base, playerLevel));
}

/** Startleben eines Gegners auf seiner Stufe. Deckt sich mit getDerivedStats. */
export function scaledHealth(
  def: EnemyDef,
  monsterLevel: number,
  difficulty: Difficulty
): number {
  const factor = 1 + 0.045 * (monsterLevel - 1);
  return Math.round(def.baseHealth * factor * modifiersFor(difficulty).healthFactor);
}

/** Waffenschaden eines Gegners auf seiner Stufe. Liefert eine Kopie. */
export function scaleWeapon(
  weapon: WeaponDef,
  monsterLevel: number,
  difficulty: Difficulty
): WeaponDef {
  const factor = (1 + 0.03 * (monsterLevel - 1)) * modifiersFor(difficulty).damageFactor;
  return {
    ...weapon,
    dmgMin: Math.round(weapon.dmgMin * factor),
    dmgMax: Math.round(weapon.dmgMax * factor),
  };
}

/** XP-Ertrag eines Gegners auf seiner Stufe. */
export function scaledXpReward(
  def: EnemyDef,
  monsterLevel: number,
  difficulty: Difficulty
): number {
  const factor = 1 + 0.1 * (monsterLevel - 1);
  return Math.round(def.baseXp * factor * modifiersFor(difficulty).xpFactor);
}
