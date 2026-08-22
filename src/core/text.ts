/**
 * Deutsche Benennungen fuer alles, was auf dem Bildschirm landet.
 *
 * Liegt in core, weil sowohl das Meldungsprotokoll aus commands.ts als auch
 * die Oberflaeche dieselben Woerter braucht. Bezeichner bleiben englisch,
 * die Ausgabe ist deutsch, mit echten Umlauten und Eszett.
 */
import type { Attributes, DamageType, Difficulty, EquipSlot } from './types';

export const DAMAGE_TYPE_NAMES: Record<DamageType, string> = {
  physical: 'physisch',
  fire: 'Feuer',
  poison: 'Gift',
  ice: 'Eis',
  shock: 'Schock',
  void: 'Leere',
};

/** Statuseffekte nach SPEC 4.5. */
export const EFFECT_NAMES: Record<string, string> = {
  burn: 'Brand',
  toxin: 'Vergiftung',
  chill: 'Unterkühlung',
  jolt: 'Störung',
  drain: 'Zehrung',
};

export const SLOT_NAMES: Record<EquipSlot, string> = {
  suit: 'Anzug',
  helmet: 'Helm',
  belt: 'Gürtel',
  boots: 'Stiefel',
  gloves: 'Handschuhe',
  weapon: 'Waffe',
  guard: 'Zusatzschutz',
  amulet: 'Amulett',
  gauge_left: 'Messgerät links',
  gauge_right: 'Messgerät rechts',
};

export const ATTRIBUTE_NAMES: Record<keyof Attributes, string> = {
  strength: 'Kraft',
  agility: 'Geschick',
  vitality: 'Konstitution',
  focus: 'Fokus',
};

export const DIFFICULTY_NAMES: Record<Difficulty, string> = {
  normal: 'Normal',
  hard: 'Schwer',
  nightmare: 'Alptraum',
};

/** Name eines Effekts, oder die Id, falls die Inhalte einen neuen mitbringen. */
export function effectName(effectId: string): string {
  return EFFECT_NAMES[effectId] ?? effectId;
}

/** Name einer Schadensart. */
export function damageTypeName(type: DamageType): string {
  return DAMAGE_TYPE_NAMES[type];
}
