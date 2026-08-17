/**
 * Stufenaufstieg nach SPEC Abschnitt 6. Die Schwellen stehen in den Inhalten,
 * nicht im Code.
 */
import type { GameEvent, PlayerState } from './types';

/**
 * Gesamt-XP, die fuer die naechste Stufe noetig sind.
 * `xpThresholds[level - 1]` ist die Schwelle von `level` nach `level + 1`.
 * Ohne weitere Schwelle ist die Hoechststufe erreicht, Rueckgabe Infinity.
 */
export function xpToNextLevel(level: number, progression: { xpThresholds: number[] }): number {
  const threshold = progression.xpThresholds[level - 1];
  return threshold ?? Number.POSITIVE_INFINITY;
}

/**
 * Vergibt XP und steigt so oft auf, wie die Schwellen es hergeben.
 * Pro Stufe: maxHealth +10, accuracy +2, evasion +1, armor +1 bei geraden Stufen.
 * Health wird jedes Mal voll aufgefuellt.
 */
export function grantXp(
  player: PlayerState,
  amount: number,
  progression: { xpThresholds: number[] }
): GameEvent[] {
  const events: GameEvent[] = [];
  if (amount <= 0) return events;

  player.xp += amount;

  while (player.xp >= xpToNextLevel(player.level, progression)) {
    player.level += 1;
    player.stats.maxHealth += 10;
    player.stats.accuracy += 2;
    player.stats.evasion += 1;
    if (player.level % 2 === 0) player.stats.armor += 1;
    player.stats.health = player.stats.maxHealth;
    events.push({ type: 'levelUp', newLevel: player.level });
  }

  return events;
}
