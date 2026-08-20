/**
 * Regeln des Fertigkeitsbaums nach RPG.md Abschnitt 5 und PHASE_3_7 Block 4.
 * Reine Zahlen und Pruefungen, kein Zugriff auf Kampf oder Karte.
 */
import type { ContentDb, PlayerState, SkillDef, SkillTreeId } from '../types';

/** Hoechstzahl Punkte je Fertigkeit, RPG.md Abschnitt 5. */
export const MAX_SKILL_POINTS = 5;

/** Grundzuschlag von `execution` in Prozentpunkten. */
export const EXECUTION_BASE = 20;

/** Zuschlag von `execution` je Punkt, in Prozentpunkten. */
export const EXECUTION_PER_POINT = 5;

/** Grundanteil ignorierter Ruestung bei `breach`, in Prozentpunkten. */
export const BREACH_BASE = 40;

/** Zusaetzlich ignorierte Ruestung je Punkt, in Prozentpunkten. */
export const BREACH_PER_POINT = 8;

/** Grundanteil des Waffenschadens bei `sweep`, in Prozentpunkten. */
export const SWEEP_BASE = 70;

/** Zusaetzlicher Anteil je Punkt, in Prozentpunkten. */
export const SWEEP_PER_POINT = 6;

/** Punkte in einer Fertigkeit. */
export function skillPoints(player: PlayerState, skillId: string): number {
  return player.skills[skillId] ?? 0;
}

/**
 * Summe der Punkte in einem Baum. `reqPointsInTree` zaehlt laut PHASE_3_7
 * Block 4 die Fertigkeit selbst nicht mit, deshalb `exclude`.
 */
export function pointsInTree(
  player: PlayerState,
  tree: SkillTreeId,
  content: ContentDb,
  exclude?: string
): number {
  let total = 0;
  for (const [skillId, points] of Object.entries(player.skills)) {
    if (skillId === exclude) continue;
    if (content.skills[skillId]?.tree !== tree) continue;
    total += points;
  }
  return total;
}

/**
 * Darf ein Punkt in diese Fertigkeit? Liefert null wenn ja, sonst den Grund.
 * Getrennt vom Setzen, damit applyCommand denselben Text melden kann.
 */
export function skillPointBlocker(
  player: PlayerState,
  def: SkillDef,
  content: ContentDb
): string | null {
  if (def.locked) return `skill is locked: ${def.id}`;
  if (player.unspentSkillPoints <= 0) return 'no skill point available';
  if (player.level < def.reqLevel) return `requires level ${def.reqLevel}`;
  if (skillPoints(player, def.id) >= def.maxPoints) {
    return `already at ${def.maxPoints} points`;
  }
  const inTree = pointsInTree(player, def.tree, content, def.id);
  if (inTree < def.reqPointsInTree) {
    return `requires ${def.reqPointsInTree} points in ${def.tree}`;
  }
  return null;
}

/** Setzt einen Punkt. Der Aufrufer hat vorher `skillPointBlocker` geprueft. */
export function addSkillPoint(player: PlayerState, skillId: string): void {
  player.skills[skillId] = skillPoints(player, skillId) + 1;
  player.unspentSkillPoints -= 1;
}

/**
 * Zuschlag aus `execution` als Faktor, 0 ohne Punkte.
 * Ob das Ziel niedrig genug steht, entscheidet combat.ts.
 */
export function executionBonus(player: PlayerState, content: ContentDb): number {
  const points = skillPoints(player, 'execution');
  if (points <= 0 || content.skills['execution']?.locked !== false) return 0;
  return (EXECUTION_BASE + EXECUTION_PER_POINT * points) / 100;
}

/** Anteil der ignorierten Ruestung bei `breach`, als Faktor zwischen 0 und 1. */
export function breachPierce(points: number): number {
  return Math.min(1, (BREACH_BASE + BREACH_PER_POINT * points) / 100);
}

/** Anteil des Waffenschadens bei `sweep`, als Faktor. */
export function sweepFactor(points: number): number {
  return (SWEEP_BASE + SWEEP_PER_POINT * points) / 100;
}
