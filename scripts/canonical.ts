/**
 * Kanonische Tabellen aus docs/BESTIARY.md v3.
 *
 * Einzige Quelle fuer den Gegner-Generator und fuer tests/content.lint.test.ts.
 * Die Werte sind abgeschrieben, nicht aus dem Markdown gelesen: ein Parser
 * wuerde bei jeder Formatierungsaenderung brechen und im Zweifel schweigend
 * nichts pruefen.
 *
 * Abgedeckt sind Abschnitt 2 (Resistenzprofile), 3 (Elementmodifikator),
 * 4 (Archetypen), 5 (Gegnerwaffen), 9 (Loot) und 10 (Sohlenplan).
 */
import type { DamageType, EnemyDef, Resistances } from '../src/core/types.ts';

/** Abschnitt 2, Resistenzprofile. */
export const RESIST_PROFILES: Record<DamageType, Resistances> = {
  physical: { physical: 0, fire: 0, poison: 0, ice: 0, shock: 0, void: 0 },
  fire: { physical: 0, fire: 80, poison: 0, ice: -50, shock: 0, void: 0 },
  poison: { physical: 0, fire: 0, poison: 80, ice: 0, shock: -50, void: 0 },
  ice: { physical: 0, fire: -50, poison: 0, ice: 80, shock: 0, void: 0 },
  shock: { physical: 0, fire: 0, poison: -50, ice: 0, shock: 80, void: 0 },
  void: { physical: 40, fire: 0, poison: 0, ice: 0, shock: 0, void: 80 },
};

/** Abschnitt 3, Elementmodifikator auf die Basiswerte vor der Skalierung. */
export const ELEMENT_MODIFIERS: Record<DamageType, { health: number; acc: number; eva: number }> = {
  physical: { health: 1.0, acc: 0, eva: 0 },
  fire: { health: 0.9, acc: 1, eva: 1 },
  poison: { health: 1.15, acc: 0, eva: -1 },
  ice: { health: 1.1, acc: -1, eva: -1 },
  shock: { health: 0.85, acc: 3, eva: 2 },
  void: { health: 1.25, acc: 2, eva: 0 },
};

/** Abschnitt 1, Effekt je Element fuer die geklonten Elementwaffen. */
export const ELEMENT_EFFECTS: Partial<Record<DamageType, string>> = {
  fire: 'burn',
  poison: 'toxin',
  ice: 'chill',
  shock: 'jolt',
  void: 'drain',
};

/**
 * Deutscher Zusatz je Element, Stamm ohne Endung. Die Endung richtet sich nach
 * dem Geschlecht des Archetypnamens: "Brennende Grubenratte", aber
 * "Brennender Deckenkriecher". `physical` traegt keinen Zusatz.
 */
export const ELEMENT_ADJECTIVES: Partial<Record<DamageType, string>> = {
  fire: 'Brennend',
  poison: 'Vergiftet',
  ice: 'Erfroren',
  shock: 'Geladen',
  void: 'Leer',
};

/** Deutscher Name eines Elementgegners, Abschnitt 3 und 4. */
export function variantName(archetype: string, element: DamageType): string {
  const base = ARCHETYPES[archetype];
  if (base === undefined) throw new Error(`unbekannter Archetyp: ${archetype}`);
  const stem = ELEMENT_ADJECTIVES[element];
  if (stem === undefined) return base.name;
  return `${stem}${base.article === 'die' ? 'e' : 'er'} ${base.name}`;
}

export type Archetype = {
  name: string;
  /** Geschlecht des Namens, nur fuer die Adjektivendung. */
  article: 'der' | 'die';
  behavior: EnemyDef['behavior'];
  hp: number;
  armor: number;
  acc: number;
  eva: number;
  speed: number;
  aggro: number;
  /** null steht fuer das "—" der Tabelle: melee und charger lesen den Wert nie. */
  pref: number | null;
  xp: number;
  width: number;
  weapon: string;
};

/** Abschnitt 4, die neun Archetypen. */
export const ARCHETYPES: Record<string, Archetype> = {
  rat: { name: 'Grubenratte', article: 'die', behavior: 'charger', hp: 12, armor: 0, acc: 8, eva: 10, speed: 2.0, aggro: 6, pref: null, xp: 8, width: 0.5, weapon: 'nw_bite' },
  crawler: { name: 'Deckenkriecher', article: 'der', behavior: 'charger', hp: 18, armor: 0, acc: 11, eva: 14, speed: 2.0, aggro: 7, pref: null, xp: 14, width: 0.6, weapon: 'nw_claw' },
  miner: { name: 'Verschütteter', article: 'der', behavior: 'melee', hp: 26, armor: 1, acc: 10, eva: 4, speed: 1.0, aggro: 8, pref: null, xp: 15, width: 0.8, weapon: 'nw_pickaxe' },
  drone: { name: 'Schürfdrohne SK-3', article: 'die', behavior: 'turret', hp: 20, armor: 3, acc: 14, eva: 0, speed: 1.0, aggro: 8, pref: 5, xp: 18, width: 0.6, weapon: 'nw_cutter' },
  spore: { name: 'Sporenträger', article: 'der', behavior: 'ranged', hp: 32, armor: 2, acc: 11, eva: 3, speed: 1.0, aggro: 9, pref: 4, xp: 30, width: 0.9, weapon: 'nw_sporeburst' },
  chainrunner: { name: 'Kettenläufer', article: 'der', behavior: 'charger', hp: 44, armor: 2, acc: 12, eva: 6, speed: 1.0, aggro: 8, pref: null, xp: 40, width: 1.0, weapon: 'nw_chainlash' },
  cultist: { name: 'Tiefenkultist', article: 'der', behavior: 'ranged', hp: 30, armor: 1, acc: 15, eva: 7, speed: 1.0, aggro: 12, pref: 6, xp: 35, width: 0.8, weapon: 'nw_boltpistol' },
  hauler: { name: 'Lastenläufer', article: 'der', behavior: 'melee', hp: 55, armor: 4, acc: 11, eva: 1, speed: 1.0, aggro: 7, pref: null, xp: 55, width: 1.1, weapon: 'nw_crush' },
  warden: { name: 'Grabungswächter', article: 'der', behavior: 'melee', hp: 95, armor: 7, acc: 13, eva: 0, speed: 0.5, aggro: 7, pref: null, xp: 90, width: 1.4, weapon: 'nw_slam' },
};

export type WeaponRow = {
  dmgMin: number;
  dmgMax: number;
  crit: number;
  optimal: number;
  max: number;
  ammo: string | null;
  damageType: DamageType;
};

/** Abschnitt 5, Gegnerwaffen. Basiswerte vor der Skalierung, ohne Munition. */
export const ENEMY_WEAPONS: Record<string, WeaponRow> = {
  nw_bite: { dmgMin: 2, dmgMax: 5, crit: 0.05, optimal: 1, max: 1, ammo: null, damageType: 'physical' },
  nw_claw: { dmgMin: 3, dmgMax: 7, crit: 0.12, optimal: 1, max: 1, ammo: null, damageType: 'physical' },
  nw_pickaxe: { dmgMin: 4, dmgMax: 9, crit: 0.08, optimal: 1, max: 1, ammo: null, damageType: 'physical' },
  nw_cutter: { dmgMin: 5, dmgMax: 8, crit: 0.05, optimal: 5, max: 7, ammo: null, damageType: 'physical' },
  nw_sporeburst: { dmgMin: 6, dmgMax: 11, crit: 0.05, optimal: 4, max: 7, ammo: null, damageType: 'poison' },
  nw_chainlash: { dmgMin: 7, dmgMax: 13, crit: 0.1, optimal: 1, max: 1, ammo: null, damageType: 'physical' },
  nw_boltpistol: { dmgMin: 6, dmgMax: 10, crit: 0.1, optimal: 6, max: 10, ammo: null, damageType: 'physical' },
  nw_crush: { dmgMin: 9, dmgMax: 16, crit: 0.05, optimal: 1, max: 1, ammo: null, damageType: 'physical' },
  nw_slam: { dmgMin: 14, dmgMax: 22, crit: 0.05, optimal: 1, max: 1, ammo: null, damageType: 'physical' },
};

/**
 * Abschnitt 5: die physische Grundform behaelt ihre Waffe. Jede andere Variante
 * traegt den Klon `<waffe>_<element>`, ausser die Grundform schiesst ohnehin
 * schon in diesem Element, wie der Sporenstoss.
 */
export function weaponFor(archetype: Archetype, element: DamageType): string {
  if (element === 'physical') return archetype.weapon;
  if (ENEMY_WEAPONS[archetype.weapon]?.damageType === element) return archetype.weapon;
  return `${archetype.weapon}_${element}`;
}

/**
 * Abschnitt 9, Stapelware je Archetyp. `units` ist die Menge aus der Tabelle,
 * also Schuss beziehungsweise Stueck. `EnemyDef.drops.amount` zaehlt dagegen
 * Stapel; die Stapelgroesse steht in `ItemDef.amount`.
 */
export const ARCHETYPE_DROPS: Record<string, { defId: string; units: number; chance: number }[]> = {
  rat: [{ defId: 'heal_small', units: 1, chance: 0.1 }],
  crawler: [{ defId: 'heal_small', units: 1, chance: 0.2 }],
  miner: [{ defId: 'ammo_pistol', units: 8, chance: 0.45 }],
  drone: [
    { defId: 'ammo_rivet', units: 6, chance: 0.5 },
    { defId: 'armor_plate', units: 1, chance: 0.15 },
  ],
  spore: [{ defId: 'antitoxin', units: 1, chance: 0.35 }],
  chainrunner: [{ defId: 'ammo_shell', units: 4, chance: 0.4 }],
  cultist: [
    { defId: 'ammo_rivet', units: 6, chance: 0.35 },
    { defId: 'ammo_pistol', units: 10, chance: 0.3 },
  ],
  hauler: [{ defId: 'armor_plate', units: 1, chance: 0.3 }],
  warden: [
    { defId: 'ammo_charge', units: 2, chance: 0.5 },
    { defId: 'heal_large', units: 1, chance: 0.3 },
  ],
};

/** Abschnitt 10, der Sohlenplan. Sohle 16 fuehrt nur Beschwoerungen. */
export const DEPTH_PLAN: Record<number, string[]> = {
  1: ['rat_physical', 'miner_physical'],
  2: ['rat_physical', 'miner_physical', 'drone_physical'],
  3: ['miner_physical', 'drone_physical', 'rat_fire'],
  4: ['miner_fire', 'rat_fire'],
  5: ['crawler_physical', 'spore_physical', 'miner_poison'],
  6: ['spore_poison', 'cultist_physical', 'crawler_physical'],
  7: ['cultist_physical', 'chainrunner_physical', 'spore_poison'],
  8: ['spore_poison', 'cultist_poison'],
  9: ['chainrunner_ice', 'hauler_physical', 'drone_ice'],
  10: ['hauler_ice', 'cultist_shock', 'crawler_ice'],
  11: ['warden_physical', 'chainrunner_ice', 'drone_shock'],
  12: ['warden_ice', 'hauler_ice'],
  13: ['cultist_void', 'warden_physical', 'crawler_void'],
  14: ['hauler_void', 'drone_void', 'chainrunner_shock'],
  15: ['warden_void', 'cultist_void', 'spore_void'],
};

/** Die 28 Kombinationen des Sohlenplans, ohne Wiederholungen, in Planreihenfolge. */
export const PLANNED_VARIANTS: string[] = [
  ...new Set(Object.keys(DEPTH_PLAN)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((depth) => DEPTH_PLAN[depth] ?? [])),
];
