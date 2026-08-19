/**
 * Stufenaufstieg nach SPEC v1.2 Abschnitt 5 und RPG.md Abschnitt 1 und 2.
 *
 * Der Aufstieg vergibt Punkte statt fester Werte: fuenf Attributpunkte und einen
 * Fertigkeitspunkt je Stufe. Die Werte selbst entstehen in getDerivedStats.
 * Die Schwellen stehen in content/progression.json, nicht im Code.
 */
import type { GameEvent, PlayerState } from './types';

/** Hoechste Spielerstufe, RPG.md Abschnitt 2. */
export const MAX_PLAYER_LEVEL = 60;

/** Attributpunkte je Stufenaufstieg, RPG.md Abschnitt 1. */
export const ATTRIBUTE_POINTS_PER_LEVEL = 5;

/** Fertigkeitspunkte je Stufenaufstieg, RPG.md Abschnitt 5. */
export const SKILL_POINTS_PER_LEVEL = 1;

/** Hoechster Wert je Attribut, RPG.md Abschnitt 1. */
export const MAX_ATTRIBUTE = 300;

/**
 * Gesamt-XP fuer die naechste Stufe. `xpThresholds[level - 1]` ist die Schwelle
 * von `level` nach `level + 1`. Auf der Hoechststufe unendlich.
 */
export function xpToNextLevel(level: number, progression: { xpThresholds: number[] }): number {
  if (level >= MAX_PLAYER_LEVEL) return Number.POSITIVE_INFINITY;
  const threshold = progression.xpThresholds[level - 1];
  return threshold ?? Number.POSITIVE_INFINITY;
}

/**
 * Vergibt XP und steigt so oft auf, wie die Schwellen es hergeben, hoechstens
 * bis Stufe 60. Health wird nicht mehr hier aufgefuellt: maxHealth haengt an den
 * Attributen, und die verteilt der Spieler selbst.
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
    player.unspentAttributePoints += ATTRIBUTE_POINTS_PER_LEVEL;
    player.unspentSkillPoints += SKILL_POINTS_PER_LEVEL;
    events.push({ type: 'levelUp', newLevel: player.level });
  }

  return events;
}

/**
 * Verteilt einen Attributpunkt. Liefert false, wenn keine Punkte offen sind oder
 * das Maximum erreicht ist.
 */
export function spendAttributePoint(
  player: PlayerState,
  attr: keyof PlayerState['attributes']
): boolean {
  if (player.unspentAttributePoints <= 0) return false;
  if (player.attributes[attr] >= MAX_ATTRIBUTE) return false;
  player.attributes[attr] += 1;
  player.unspentAttributePoints -= 1;
  return true;
}
