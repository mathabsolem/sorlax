/**
 * Aufloesung der Bossskripte nach INTERFACES Abschnitt 10.
 *
 * Ein Gegner mit `behavior: 'scripted'` nennt in `scriptId` den Eintrag hier.
 * Fehlt er, handelt der Gegner nicht und meldet das (PHASE_3_7 Block 6).
 */
import { halvernHandler } from './halvern';
import { rimeHandler } from './rime';
import { sorlaxHandler } from './sorlax';
import { sporemotherHandler } from './sporemother';
import type { BossHandler } from '../types';

export const BOSS_REGISTRY: Record<string, BossHandler> = {
  halvern: halvernHandler,
  sporemother: sporemotherHandler,
  rime: rimeHandler,
  sorlax: sorlaxHandler,
};
