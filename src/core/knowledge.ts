/**
 * Was der Spieler ueber Gegner gelernt hat, PHASE_4 Block 3.
 *
 * Die Zielanzeige zeigt eine Resistenz erst, wenn der Spieler den Gegner mit
 * dieser Schadensart mindestens einmal getroffen hat. Das Wissen liegt in
 * `state.flags`, damit es im Spielstand ueberlebt.
 */
import type { DamageType, GameState } from './types';

/** Schluessel einer erlebten Resistenz. */
export function knownResistanceKey(enemyDefId: string, damageType: DamageType): string {
  return `known_res_${enemyDefId}_${damageType}`;
}

/** Merkt sich einen erlebten Treffer. Liefert true, wenn das Wissen neu war. */
export function learnResistance(
  state: GameState,
  enemyDefId: string,
  damageType: DamageType
): boolean {
  const key = knownResistanceKey(enemyDefId, damageType);
  if (state.flags[key] === true) return false;
  state.flags[key] = true;
  return true;
}

/** Hat der Spieler diese Resistenz schon erlebt? */
export function knowsResistance(
  state: GameState,
  enemyDefId: string,
  damageType: DamageType
): boolean {
  return state.flags[knownResistanceKey(enemyDefId, damageType)] === true;
}
