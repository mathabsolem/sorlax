/**
 * Statuseffekte nach SPEC v1.2 Abschnitt 4.5.
 * Reine Tabelle. Liegt getrennt, damit derived.ts und effects.ts sie beide lesen
 * koennen, ohne sich gegenseitig zu importieren.
 */
import type { DamageType } from './types';

export type EffectId = 'burn' | 'toxin' | 'chill' | 'jolt' | 'drain';

export type EffectDef = {
  id: EffectId;
  /** Element, gegen das die Resistenz des Ziels geprueft wird. */
  sourceType: DamageType;
  turns: number;
  /** Bedeutung je Effekt: Schaden pro Runde, Punkte, oder Prozent. */
  magnitude: number;
  /** Schaden pro Runde ignoriert Ruestung. */
  ignoresArmor: boolean;
};

/**
 * Feste Abarbeitungsreihenfolge aus SPEC 4.5. Nicht umsortieren, sonst aendert
 * sich das Ergebnis bei toedlichem Schaden.
 */
export const EFFECT_ORDER: readonly EffectId[] = ['burn', 'toxin', 'drain', 'chill', 'jolt'];

export const EFFECT_DEFS: Record<EffectId, EffectDef> = {
  burn: { id: 'burn', sourceType: 'fire', turns: 3, magnitude: 4, ignoresArmor: true },
  toxin: { id: 'toxin', sourceType: 'poison', turns: 6, magnitude: 2, ignoresArmor: true },
  chill: { id: 'chill', sourceType: 'ice', turns: 4, magnitude: 2, ignoresArmor: false },
  jolt: { id: 'jolt', sourceType: 'shock', turns: 3, magnitude: 8, ignoresArmor: false },
  drain: { id: 'drain', sourceType: 'void', turns: 5, magnitude: 15, ignoresArmor: false },
};

/** Ruestungsabzug von `drain`, SPEC 4.5. */
export const DRAIN_ARMOR_PENALTY = 3;

/** Ab dieser Resistenz greift ein Effekt gar nicht erst. */
export const EFFECT_RESIST_THRESHOLD = 50;

export function isEffectId(value: string): value is EffectId {
  return value in EFFECT_DEFS;
}
