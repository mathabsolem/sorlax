/**
 * `breach` (Durchbruch), RPG.md Abschnitt 5.
 * Ein normaler Angriff, der einen Teil der gegnerischen Ruestung ignoriert.
 * Die Resistenz bleibt unberuehrt.
 */
import { attackAction } from '../attack';
import { breachPierce } from './rules';
import type { ContentDb, EntityId, GameEvent, GameState, SkillDef } from '../types';

export function breachHandler(
  state: GameState,
  _skill: SkillDef,
  points: number,
  targetId: EntityId | undefined,
  content: ContentDb
): GameEvent[] {
  const result = attackAction(state, content, targetId, {
    armorPierce: breachPierce(points),
  });
  return result.ok ? result.events : [{ type: 'invalid', reason: result.reason }];
}
