/**
 * Aufloesung der aktiven Fertigkeiten nach INTERFACES Abschnitt 6.
 * Passive Fertigkeiten stehen hier nicht, sie wirken ueber `SkillDef.modifiers`
 * in getDerivedStats.
 */
import { breachHandler } from './breach';
import { sweepHandler } from './sweep';
import type { SkillHandler } from '../types';

export const SKILL_REGISTRY: Record<string, SkillHandler> = {
  breach: breachHandler,
  sweep: sweepHandler,
};
