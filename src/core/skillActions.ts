/**
 * Spieleraktionen rund um Fertigkeiten, PHASE_3_7 Bloecke 4 und 5.
 *
 * Punkte verteilen kostet keine Runde, eine aktive Fertigkeit kostet eine Runde
 * wie ein Angriff (SPEC 3.2).
 */
import type { ActionResult } from './actionResult';
import { SKILL_REGISTRY } from './skills/registry';
import { addSkillPoint, skillPointBlocker, skillPoints } from './skills/rules';
import { invalidatePlayerDerived } from './turn';
import type { ContentDb, EntityId, GameEvent, GameState } from './types';

/** Verteilt einen Fertigkeitspunkt. */
export function spendSkillPointAction(
  state: GameState,
  content: ContentDb,
  skillId: string
): ActionResult {
  const def = content.skills[skillId];
  if (def === undefined) return { ok: false, reason: `unknown skill: ${skillId}` };

  const blocker = skillPointBlocker(state.player, def, content);
  if (blocker !== null) return { ok: false, reason: blocker };

  addSkillPoint(state.player, skillId);
  // Passive Fertigkeiten wirken in getDerivedStats, der Rundencache muss fallen.
  invalidatePlayerDerived(state);
  return {
    ok: true,
    events: [{ type: 'message', text: `Punkt auf ${def.name}` }],
  };
}

/**
 * Loest eine aktive Fertigkeit aus. Das `skillUsed`-Ereignis steht vor den
 * Schadensereignissen (PHASE_3_7 Block 5).
 */
export function useSkillAction(
  state: GameState,
  content: ContentDb,
  skillId: string,
  targetId: EntityId | undefined
): ActionResult {
  const def = content.skills[skillId];
  if (def === undefined) return { ok: false, reason: `unknown skill: ${skillId}` };
  if (def.locked) return { ok: false, reason: `skill is locked: ${skillId}` };
  if (!def.active) return { ok: false, reason: `skill is passive: ${skillId}` };

  const points = skillPoints(state.player, skillId);
  if (points <= 0) return { ok: false, reason: `skill not learned: ${skillId}` };
  if ((state.player.cooldowns[skillId] ?? 0) > 0) {
    return { ok: false, reason: `skill on cooldown: ${skillId}` };
  }

  const handler = SKILL_REGISTRY[skillId];
  if (handler === undefined) return { ok: false, reason: `no handler for skill: ${skillId}` };

  const result = handler(state, def, points, targetId, content);
  // Ein Handler, der die Aktion selbst verwirft, darf keine Runde und keine
  // Abklingzeit kosten.
  const rejected = result.find((event) => event.type === 'invalid');
  if (rejected !== undefined) return { ok: false, reason: rejected.reason };

  state.player.cooldowns[skillId] = def.cooldown;

  const events: GameEvent[] = [{ type: 'skillUsed', skillId, by: 'player' }, ...result];
  return { ok: true, events };
}

/** Hoechstzahl Plaetze der Fertigkeitsleiste, SPEC Abschnitt 12 (F1 bis F6). */
export const SKILLBAR_SLOTS = 6;

/** Schluessel eines Platzes der Leiste in `state.flags`. */
export function skillbarKey(index: number): string {
  return `skillbar_${index}`;
}

/**
 * Belegt einen Platz der Fertigkeitsleiste, INTERFACES v1.4.
 * Ein leerer `skillId` raeumt den Platz. Kostet keine Runde.
 */
export function assignSkillSlotAction(
  state: GameState,
  content: ContentDb,
  index: number,
  skillId: string
): ActionResult {
  if (!Number.isInteger(index) || index < 0 || index >= SKILLBAR_SLOTS) {
    return { ok: false, reason: `no such skill slot: ${index}` };
  }

  if (skillId === '') {
    delete state.flags[skillbarKey(index)];
    return { ok: true, events: [{ type: 'message', text: `Platz ${index + 1} geräumt` }] };
  }

  const def = content.skills[skillId];
  if (def === undefined) return { ok: false, reason: `unknown skill: ${skillId}` };
  if (def.locked) return { ok: false, reason: `skill is locked: ${skillId}` };
  if (!def.active) return { ok: false, reason: `skill is passive: ${skillId}` };
  if (skillPoints(state.player, skillId) <= 0) {
    return { ok: false, reason: `skill not learned: ${skillId}` };
  }

  // Eine Fertigkeit liegt hoechstens auf einem Platz.
  for (let other = 0; other < SKILLBAR_SLOTS; other++) {
    if (other !== index && state.flags[skillbarKey(other)] === skillId) {
      delete state.flags[skillbarKey(other)];
    }
  }
  state.flags[skillbarKey(index)] = skillId;

  return {
    ok: true,
    events: [{ type: 'message', text: `${def.name} auf Platz ${index + 1} gelegt` }],
  };
}
