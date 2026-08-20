/**
 * Sammelt die Beitraege von Ausruestung zu den abgeleiteten Werten,
 * PHASE_3_6 Block 5 und RPG.md Abschnitt 2.
 *
 * Drei Arten von Zielwerten, die sich unterschiedlich verhalten:
 *
 * - Groessenwerte (`maxHealth`, `armor`, `accuracy`, `evasion`, `lightRadius`,
 *   `res_*`): flache Beitraege werden auf die Basis addiert, prozentuale
 *   aufsummiert und danach als ein einziger Faktor angewendet.
 * - Verhaeltniswerte (`meleeBonus`, `elemBonus`, `critBonus`,
 *   `freeActionChance`, `ammoSaveChance`): die stehen in DerivedStats schon als
 *   Faktor (0.12 heisst plus 12 Prozent). Ihre Beitraege sind Prozentpunkte und
 *   werden addiert, dann durch 100 geteilt. Genau das meint RPG.md Abschnitt 2
 *   mit `meleeBonus = 0.010 * (strength - 10) + prozent(Ausruestung)`: zwei
 *   Teile mit je 8 Prozent ergeben 0.16, nicht 0.1664.
 * - Attribute (`strength`, `agility`, `vitality`, `focus`): wirken auf die
 *   Attribute selbst und damit auf die Basis aller uebrigen Werte. Deshalb
 *   laeuft die Berechnung in zwei Durchgaengen.
 */
import { DAMAGE_TYPES, EQUIP_SLOTS } from './types';
import type {
  Attributes,
  ContentDb,
  DamageType,
  EquipSlot,
  ItemInstance,
} from './types';

/** Werte, die als Prozentpunkte gefuehrt und bei der Anwendung durch 100 geteilt werden. */
export const RATIO_STATS: readonly string[] = [
  'meleeBonus',
  'elemBonus',
  'critBonus',
  'freeActionChance',
  'ammoSaveChance',
];

/** Affixe, die auf die Attribute wirken und damit im ersten Durchgang zaehlen. */
export const ATTRIBUTE_STATS: readonly (keyof Attributes)[] = [
  'strength',
  'agility',
  'vitality',
  'focus',
];

/** Praefix der Resistenzaffixe, INTERFACES Abschnitt 5 (`stat`: 'res_fire' usw.). */
const RESIST_PREFIX = 'res_';

/** Schadensart hinter einem Resistenzaffix, oder null wenn es keiner ist. */
export function resistanceTypeOf(stat: string): DamageType | null {
  if (!stat.startsWith(RESIST_PREFIX)) return null;
  const rest = stat.slice(RESIST_PREFIX.length);
  return DAMAGE_TYPES.find((type) => type === rest) ?? null;
}

export type ModifierSums = {
  flat: Record<string, number>;
  percent: Record<string, number>;
};

function emptySums(): ModifierSums {
  return { flat: {}, percent: {} };
}

function add(sums: ModifierSums, stat: string, mode: 'flat' | 'percent', value: number): void {
  const bucket = mode === 'flat' ? sums.flat : sums.percent;
  bucket[stat] = (bucket[stat] ?? 0) + value;
}

/**
 * Beitraege aller angelegten Teile: Grundwerte aus `ItemDef.baseModifiers` und
 * gewuerfelte Affixe. Die Reihenfolge ist die feste Steckplatzreihenfolge aus
 * INTERFACES, damit das Ergebnis nicht von `Object.keys` abhaengt.
 */
export function collectEquipmentModifiers(
  equipment: Partial<Record<EquipSlot, ItemInstance>>,
  content: ContentDb
): ModifierSums {
  const sums = emptySums();

  for (const slot of EQUIP_SLOTS) {
    const item = equipment[slot];
    if (item === undefined) continue;

    const def = content.items[item.baseId];
    for (const mod of def?.baseModifiers ?? []) {
      add(sums, mod.stat, mod.mode, mod.value);
    }

    for (const rolled of item.affixes) {
      const affix = content.affixes[rolled.affixId];
      if (affix === undefined) continue;
      add(sums, affix.stat, affix.mode, rolled.value);
    }
  }

  return sums;
}

/** Summe der flachen Beitraege zu einem Wert. */
export function flatOf(sums: ModifierSums, stat: string): number {
  return sums.flat[stat] ?? 0;
}

/** Summe der prozentualen Beitraege zu einem Wert, in Prozentpunkten. */
export function percentOf(sums: ModifierSums, stat: string): number {
  return sums.percent[stat] ?? 0;
}

/**
 * Beitrag zu einem Verhaeltniswert. Flache und prozentuale Beitraege sind hier
 * dasselbe, naemlich Prozentpunkte, und werden addiert.
 */
export function ratioOf(sums: ModifierSums, stat: string): number {
  return (flatOf(sums, stat) + percentOf(sums, stat)) / 100;
}

/** Beitrag zu einem Groessenwert: erst flach addieren, dann ein Prozentfaktor. */
export function magnitudeOf(sums: ModifierSums, stat: string, base: number): number {
  return (base + flatOf(sums, stat)) * (1 + percentOf(sums, stat) / 100);
}

/** Attributszuschlaege aus der Ausruestung, erster Durchgang. */
export function attributeBonus(sums: ModifierSums, base: Attributes): Attributes {
  const result: Attributes = { ...base };
  for (const attr of ATTRIBUTE_STATS) {
    result[attr] = base[attr] + flatOf(sums, attr) + percentOf(sums, attr);
  }
  return result;
}
