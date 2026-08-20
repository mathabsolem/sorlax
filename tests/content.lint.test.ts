/**
 * Inhaltsabgleich gegen docs/BESTIARY.md v3.
 *
 * Die kanonischen Werte stehen hier als TypeScript-Konstanten, nicht als
 * Parser auf dem Markdown. Ein Parser wuerde mit jeder Formatierungsaenderung
 * brechen und im Zweifel schweigend nichts pruefen; abgeschriebene Konstanten
 * brechen laut, sobald content/ und Bestiarium auseinanderlaufen.
 *
 * Abgedeckt sind Abschnitt 4 (Archetypen), 5 (Gegnerwaffen), 6 (Bosse und ihre
 * Resistenzen), 7 (Spielerwaffen) und 8 (Ausruestungs-Grundtypen), dazu die
 * Hilfstabellen aus Abschnitt 2 (Resistenzprofile) und 3 (Elementmodifikator).
 *
 * Zu Abschnitt 4: content/enemies.json fuehrt bewusst nicht alle neun
 * Archetypen. Abschnitt 10 haelt fest, dass die 28 Gegnervarianten des
 * Sohlenplans vom Generator aus Phase 7 erzeugt werden, nicht von Hand.
 * Geprueft wird deshalb, dass jeder vorhandene Eintrag zu seiner Vorlage passt,
 * und dass kein Eintrag einen Archetyp benutzt, den es im Bestiarium nicht gibt.
 */
import { describe, expect, it } from 'vitest';
import enemiesJson from '../content/enemies.json';
import itemsJson from '../content/items.json';
import weaponsJson from '../content/weapons.json';
import { DAMAGE_TYPES } from '../src/core/types';
import type { DamageType, EnemyDef, ItemDef, Resistances, WeaponDef } from '../src/core/types';

const ENEMIES = enemiesJson as unknown as Record<string, EnemyDef>;
const ITEMS = itemsJson as unknown as Record<string, ItemDef>;
const WEAPONS = weaponsJson as unknown as Record<string, WeaponDef>;

// --- Kanonische Werte aus docs/BESTIARY.md v3 --------------------------------

/** Abschnitt 2, Resistenzprofile. */
const RESIST_PROFILES: Record<DamageType, Resistances> = {
  physical: { physical: 0, fire: 0, poison: 0, ice: 0, shock: 0, void: 0 },
  fire: { physical: 0, fire: 80, poison: 0, ice: -50, shock: 0, void: 0 },
  poison: { physical: 0, fire: 0, poison: 80, ice: 0, shock: -50, void: 0 },
  ice: { physical: 0, fire: -50, poison: 0, ice: 80, shock: 0, void: 0 },
  shock: { physical: 0, fire: 0, poison: -50, ice: 0, shock: 80, void: 0 },
  void: { physical: 40, fire: 0, poison: 0, ice: 0, shock: 0, void: 80 },
};

/** Abschnitt 3, Elementmodifikator auf die Basiswerte vor der Skalierung. */
const ELEMENT_MODIFIERS: Record<DamageType, { health: number; acc: number; eva: number }> = {
  physical: { health: 1.0, acc: 0, eva: 0 },
  fire: { health: 0.9, acc: 1, eva: 1 },
  poison: { health: 1.15, acc: 0, eva: -1 },
  ice: { health: 1.1, acc: -1, eva: -1 },
  shock: { health: 0.85, acc: 3, eva: 2 },
  void: { health: 1.25, acc: 2, eva: 0 },
};

/** Abschnitt 3, Effekt je Element fuer die geklonten Elementwaffen. */
const ELEMENT_EFFECTS: Partial<Record<DamageType, string>> = {
  fire: 'burn',
  poison: 'toxin',
  ice: 'chill',
  shock: 'jolt',
  void: 'drain',
};

type Archetype = {
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
const ARCHETYPES: Record<string, Archetype> = {
  rat: { behavior: 'charger', hp: 12, armor: 0, acc: 8, eva: 10, speed: 2.0, aggro: 6, pref: null, xp: 8, width: 0.5, weapon: 'nw_bite' },
  crawler: { behavior: 'charger', hp: 18, armor: 0, acc: 11, eva: 14, speed: 2.0, aggro: 7, pref: null, xp: 14, width: 0.6, weapon: 'nw_claw' },
  miner: { behavior: 'melee', hp: 26, armor: 1, acc: 10, eva: 4, speed: 1.0, aggro: 8, pref: null, xp: 15, width: 0.8, weapon: 'nw_pickaxe' },
  drone: { behavior: 'turret', hp: 20, armor: 3, acc: 14, eva: 0, speed: 1.0, aggro: 8, pref: 5, xp: 18, width: 0.6, weapon: 'nw_cutter' },
  spore: { behavior: 'ranged', hp: 32, armor: 2, acc: 11, eva: 3, speed: 1.0, aggro: 9, pref: 4, xp: 30, width: 0.9, weapon: 'nw_sporeburst' },
  chainrunner: { behavior: 'charger', hp: 44, armor: 2, acc: 12, eva: 6, speed: 1.0, aggro: 8, pref: null, xp: 40, width: 1.0, weapon: 'nw_chainlash' },
  cultist: { behavior: 'ranged', hp: 30, armor: 1, acc: 15, eva: 7, speed: 1.0, aggro: 12, pref: 6, xp: 35, width: 0.8, weapon: 'nw_boltpistol' },
  hauler: { behavior: 'melee', hp: 55, armor: 4, acc: 11, eva: 1, speed: 1.0, aggro: 7, pref: null, xp: 55, width: 1.1, weapon: 'nw_crush' },
  warden: { behavior: 'melee', hp: 95, armor: 7, acc: 13, eva: 0, speed: 0.5, aggro: 7, pref: null, xp: 90, width: 1.4, weapon: 'nw_slam' },
};

type WeaponRow = {
  dmgMin: number;
  dmgMax: number;
  crit: number;
  optimal: number;
  max: number;
  ammo: string | null;
  damageType: DamageType;
};

/** Abschnitt 5, Gegnerwaffen. Basiswerte vor der Skalierung, ohne Munition. */
const ENEMY_WEAPONS: Record<string, WeaponRow> = {
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

/** Abschnitt 7, die zehn Spielerwaffen. */
const PLAYER_WEAPONS: Record<string, WeaponRow> = {
  w_prybar: { dmgMin: 4, dmgMax: 9, crit: 0.12, optimal: 1, max: 1, ammo: null, damageType: 'physical' },
  w_pistol: { dmgMin: 6, dmgMax: 11, crit: 0.1, optimal: 5, max: 9, ammo: 'pistol', damageType: 'physical' },
  w_shotgun: { dmgMin: 12, dmgMax: 24, crit: 0.08, optimal: 2, max: 4, ammo: 'shell', damageType: 'physical' },
  w_riveter: { dmgMin: 9, dmgMax: 15, crit: 0.18, optimal: 8, max: 14, ammo: 'rivet', damageType: 'physical' },
  w_rod: { dmgMin: 13, dmgMax: 20, crit: 0.2, optimal: 6, max: 10, ammo: 'cell', damageType: 'shock' },
  w_charger: { dmgMin: 8, dmgMax: 14, crit: 0.05, optimal: 6, max: 10, ammo: 'charge', damageType: 'physical' },
  w_lance: { dmgMin: 14, dmgMax: 22, crit: 0.08, optimal: 3, max: 5, ammo: 'fuel', damageType: 'fire' },
  w_sprayer: { dmgMin: 10, dmgMax: 16, crit: 0.05, optimal: 4, max: 7, ammo: 'toxin_canister', damageType: 'poison' },
  w_drill: { dmgMin: 18, dmgMax: 28, crit: 0.1, optimal: 2, max: 4, ammo: 'coolant', damageType: 'ice' },
  w_scepter: { dmgMin: 26, dmgMax: 42, crit: 0.25, optimal: 7, max: 12, ammo: 'essence', damageType: 'void' },
};

/** Abschnitt 7, Sonderfaelle unter der Tabelle. */
const CHARGER_SPLASH = { radius: 2.5, baseDamage: 30 };

/** Abschnitt 6, die vier Bosse. */
const BOSSES: Record<
  string,
  {
    scriptId: string;
    depth: number;
    hp: number;
    armor: number;
    acc: number;
    eva: number;
    speed: number;
    xp: number;
    resistances: Resistances;
    reward: string;
  }
> = {
  boss_halvern: {
    scriptId: 'halvern', depth: 4, hp: 180, armor: 4, acc: 16, eva: 3, speed: 1.0, xp: 400,
    resistances: { physical: 0, fire: 90, poison: 0, ice: -60, shock: 0, void: 0 },
    reward: 'w_lance',
  },
  boss_sporemother: {
    scriptId: 'sporemother', depth: 8, hp: 260, armor: 3, acc: 14, eva: 0, speed: 1.0, xp: 900,
    resistances: { physical: 25, fire: 0, poison: 90, ice: 0, shock: -60, void: 0 },
    reward: 'w_sprayer',
  },
  boss_rime: {
    scriptId: 'rime', depth: 12, hp: 300, armor: 6, acc: 18, eva: 8, speed: 1.0, xp: 1600,
    resistances: { physical: 20, fire: -60, poison: 0, ice: 90, shock: 0, void: 0 },
    reward: 'w_drill',
  },
  boss_sorlax: {
    scriptId: 'sorlax', depth: 16, hp: 420, armor: 10, acc: 20, eva: 5, speed: 1.0, xp: 5000,
    resistances: { physical: 40, fire: 25, poison: 25, ice: 25, shock: 25, void: 90 },
    reward: 'w_scepter',
  },
};

/** Abschnitt 8, die Grundtypen je Steckplatz. */
const GEAR: Record<string, { slot: string; heavy: boolean }> = {
  suit_overall: { slot: 'suit', heavy: false },
  suit_plated: { slot: 'suit', heavy: true },
  helmet_hardhat: { slot: 'helmet', heavy: false },
  helmet_visor: { slot: 'helmet', heavy: true },
  belt_tool: { slot: 'belt', heavy: false },
  belt_harness: { slot: 'belt', heavy: true },
  boots_rubber: { slot: 'boots', heavy: false },
  boots_steel: { slot: 'boots', heavy: true },
  gloves_grip: { slot: 'gloves', heavy: false },
  gloves_armored: { slot: 'gloves', heavy: true },
  guard_deflector: { slot: 'guard', heavy: false },
  guard_plate: { slot: 'guard', heavy: true },
  amulet_tag: { slot: 'amulet', heavy: false },
  amulet_sigil: { slot: 'amulet', heavy: true },
  // gauge_right nutzt laut Tabelle dieselben Grundtypen wie gauge_left.
  gauge_pressure: { slot: 'gauge_left', heavy: false },
  gauge_seismic: { slot: 'gauge_left', heavy: true },
};

/** Abschnitt 8, Voraussetzungen und Grundwerte je Gewichtsklasse. */
const GEAR_RULES = {
  light: { reqLevel: 1, reqStrength: 10, reqAgility: 14, armor: 2, evasion: 1 },
  heavy: { reqLevel: 8, reqStrength: 22, reqAgility: 10, armor: 6, evasion: -1 },
};

// --- Vergleich ----------------------------------------------------------------

/** Sammelt Abweichungen als lesbare Zeilen: Feld, Ist und Soll. */
function check(into: string[], id: string, field: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  into.push(`${id}.${field}: ist ${JSON.stringify(actual)}, soll ${JSON.stringify(expected)}`);
}

function weaponRow(into: string[], id: string, want: WeaponRow): void {
  const def = WEAPONS[id];
  if (def === undefined) {
    into.push(`${id}: fehlt in content/weapons.json`);
    return;
  }
  check(into, id, 'dmgMin', def.dmgMin, want.dmgMin);
  check(into, id, 'dmgMax', def.dmgMax, want.dmgMax);
  check(into, id, 'critChance', def.critChance, want.crit);
  check(into, id, 'optimalRange', def.optimalRange, want.optimal);
  check(into, id, 'maxRange', def.maxRange, want.max);
  check(into, id, 'ammoType', def.ammoType, want.ammo);
  check(into, id, 'damageType', def.damageType, want.damageType);
}

describe('Abschnitt 4, Archetypen', () => {
  it('kennt jeder Gegner in content/ einen Archetyp aus dem Bestiarium', () => {
    const unknown = Object.values(ENEMIES)
      .filter((def) => def.behavior !== 'scripted')
      .filter((def) => ARCHETYPES[def.archetype] === undefined)
      .map((def) => `${def.id}: Archetyp ${def.archetype} steht nicht in Abschnitt 4`);
    expect(unknown).toEqual([]);
  });

  it('leitet jede Variante korrekt aus Archetyp und Elementmodifikator ab', () => {
    const problems: string[] = [];

    for (const def of Object.values(ENEMIES)) {
      if (def.behavior === 'scripted') continue;
      const base = ARCHETYPES[def.archetype];
      const modifier = ELEMENT_MODIFIERS[def.element];
      if (base === undefined) continue;

      check(problems, def.id, 'id', def.id, `${def.archetype}_${def.element}`);
      check(problems, def.id, 'behavior', def.behavior, base.behavior);
      check(problems, def.id, 'baseHealth', def.baseHealth, Math.round(base.hp * modifier.health));
      check(problems, def.id, 'baseArmor', def.baseArmor, base.armor);
      check(problems, def.id, 'baseAccuracy', def.baseAccuracy, base.acc + modifier.acc);
      check(problems, def.id, 'baseEvasion', def.baseEvasion, base.eva + modifier.eva);
      check(problems, def.id, 'speed', def.speed, base.speed);
      check(problems, def.id, 'aggroRange', def.aggroRange, base.aggro);
      check(problems, def.id, 'baseXp', def.baseXp, base.xp);
      check(problems, def.id, 'spriteWidth', def.spriteWidth, base.width);
      check(problems, def.id, 'resistances', def.resistances, RESIST_PROFILES[def.element]);
      check(problems, def.id, 'dropTableId', def.dropTableId, 'common_drop');

      // Abschnitt 4 laesst preferredRange bei melee und charger offen ("—"),
      // weil beide Verhalten den Wert nie lesen. Erwartet wird dort die 1.
      check(problems, def.id, 'preferredRange', def.preferredRange, base.pref ?? 1);

      // Abschnitt 5: die physische Grundform behaelt ihre Waffe, jede andere
      // traegt den Klon <waffe>_<element>.
      const wantWeapon =
        def.element === 'physical' || ENEMY_WEAPONS[base.weapon]?.damageType === def.element
          ? base.weapon
          : `${base.weapon}_${def.element}`;
      check(problems, def.id, 'weaponId', def.weaponId, wantWeapon);
    }

    expect(problems).toEqual([]);
  });
});

describe('Abschnitt 5, Gegnerwaffen', () => {
  it('fuehrt alle neun Grundformen mit den Werten der Tabelle', () => {
    const problems: string[] = [];
    for (const [id, want] of Object.entries(ENEMY_WEAPONS)) weaponRow(problems, id, want);
    expect(problems).toEqual([]);
  });

  it('baut jede Elementvariante als Klon ihrer Grundform', () => {
    const problems: string[] = [];

    for (const def of Object.values(WEAPONS)) {
      const match = /^(nw_[a-z]+)_([a-z]+)$/.exec(def.id);
      if (match === null) continue;
      const [, baseId, element] = match;
      if (baseId === undefined || element === undefined) continue;
      const base = WEAPONS[baseId];
      if (base === undefined) {
        problems.push(`${def.id}: Grundform ${baseId} fehlt`);
        continue;
      }

      check(problems, def.id, 'dmgMin', def.dmgMin, base.dmgMin);
      check(problems, def.id, 'dmgMax', def.dmgMax, base.dmgMax);
      check(problems, def.id, 'critChance', def.critChance, base.critChance);
      check(problems, def.id, 'optimalRange', def.optimalRange, base.optimalRange);
      check(problems, def.id, 'maxRange', def.maxRange, base.maxRange);
      check(problems, def.id, 'damageType', def.damageType, element);
      check(problems, def.id, 'appliesEffect', def.appliesEffect, ELEMENT_EFFECTS[element as DamageType]);
    }

    expect(problems).toEqual([]);
  });
});

describe('Abschnitt 6, Bosse', () => {
  it('fuehrt alle vier mit den Werten der Tabelle', () => {
    const problems: string[] = [];

    for (const [id, want] of Object.entries(BOSSES)) {
      const def = ENEMIES[id];
      if (def === undefined) {
        problems.push(`${id}: fehlt in content/enemies.json`);
        continue;
      }
      check(problems, id, 'behavior', def.behavior, 'scripted');
      check(problems, id, 'scriptId', def.scriptId, want.scriptId);
      check(problems, id, 'baseHealth', def.baseHealth, want.hp);
      check(problems, id, 'baseArmor', def.baseArmor, want.armor);
      check(problems, id, 'baseAccuracy', def.baseAccuracy, want.acc);
      check(problems, id, 'baseEvasion', def.baseEvasion, want.eva);
      check(problems, id, 'speed', def.speed, want.speed);
      check(problems, id, 'baseXp', def.baseXp, want.xp);
      check(problems, id, 'resistances', def.resistances, want.resistances);
      check(problems, id, 'dropTableId', def.dropTableId, 'boss_drop');
    }

    expect(problems).toEqual([]);
  });

  it('deckelt jede Bossresistenz auf die Obergrenze aus INTERFACES', () => {
    const problems: string[] = [];
    for (const [id, want] of Object.entries(BOSSES)) {
      for (const type of DAMAGE_TYPES) {
        const value = want.resistances[type];
        if (value > 90) problems.push(`${id}.resistances.${type}: ist ${value}, soll hoechstens 90`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('bindet die Belohnungswaffe jedes Bosses an seine Sohle', () => {
    const problems: string[] = [];
    for (const want of Object.values(BOSSES)) {
      const item = ITEMS[`item_${want.reward}`];
      if (item === undefined) {
        problems.push(`item_${want.reward}: fehlt in content/items.json`);
        continue;
      }
      // Abschnitt 7 nennt den Fundort, PHASE_3_8 Block 3 macht daraus reqLevel.
      check(problems, item.id, 'reqLevel', item.reqLevel, want.depth);
    }
    expect(problems).toEqual([]);
  });
});

describe('Abschnitt 7, Spielerwaffen', () => {
  it('fuehrt alle zehn mit den Werten der Tabelle', () => {
    const problems: string[] = [];
    for (const [id, want] of Object.entries(PLAYER_WEAPONS)) weaponRow(problems, id, want);
    expect(problems).toEqual([]);
  });

  it('gibt Elementwaffen den Effekt ihres Typs und dem Werfer seine Explosion', () => {
    const problems: string[] = [];

    for (const [id, want] of Object.entries(PLAYER_WEAPONS)) {
      const def = WEAPONS[id];
      if (def === undefined) continue;
      check(problems, id, 'appliesEffect', def.appliesEffect, ELEMENT_EFFECTS[want.damageType]);
    }
    check(problems, 'w_charger', 'splash', WEAPONS['w_charger']?.splash, CHARGER_SPLASH);

    expect(problems).toEqual([]);
  });

  it('legt zu jeder Waffe genau einen Grundtyp item_<id> an', () => {
    const problems: string[] = [];
    for (const id of Object.keys(PLAYER_WEAPONS)) {
      const item = ITEMS[`item_${id}`];
      if (item === undefined) {
        problems.push(`item_${id}: fehlt in content/items.json`);
        continue;
      }
      check(problems, item.id, 'type', item.type, 'weapon');
      check(problems, item.id, 'slot', item.slot, 'weapon');
      check(problems, item.id, 'weaponId', item.weaponId, id);
    }

    const strays = Object.values(ITEMS)
      .filter((item) => item.type === 'weapon')
      .filter((item) => PLAYER_WEAPONS[item.weaponId ?? ''] === undefined)
      .map((item) => `${item.id}: Waffe ohne Eintrag in Abschnitt 7`);

    expect([...problems, ...strays]).toEqual([]);
  });
});

describe('Abschnitt 8, Ausruestungs-Grundtypen', () => {
  it('fuehrt alle sechzehn mit Steckplatz, Voraussetzungen und Grundwerten', () => {
    const problems: string[] = [];

    for (const [id, want] of Object.entries(GEAR)) {
      const def = ITEMS[id];
      if (def === undefined) {
        problems.push(`${id}: fehlt in content/items.json`);
        continue;
      }
      const rule = want.heavy ? GEAR_RULES.heavy : GEAR_RULES.light;
      check(problems, id, 'type', def.type, 'equipment');
      check(problems, id, 'slot', def.slot, want.slot);
      check(problems, id, 'amount', def.amount, 1);
      check(problems, id, 'reqLevel', def.reqLevel, rule.reqLevel);
      check(problems, id, 'reqStrength', def.reqStrength, rule.reqStrength);
      check(problems, id, 'reqAgility', def.reqAgility, rule.reqAgility);
      check(problems, id, 'baseModifiers', def.baseModifiers, [
        { stat: 'armor', mode: 'flat', value: rule.armor },
        { stat: 'evasion', mode: 'flat', value: rule.evasion },
      ]);
    }

    expect(problems).toEqual([]);
  });

  it('fuehrt keinen Grundtyp, den Abschnitt 8 nicht kennt', () => {
    const strays = Object.values(ITEMS)
      .filter((item) => item.type === 'equipment')
      .filter((item) => GEAR[item.id] === undefined)
      .map((item) => `${item.id}: Grundtyp ohne Eintrag in Abschnitt 8`);
    expect(strays).toEqual([]);
  });
});

describe('Felder ohne Vorlage', () => {
  /**
   * Abschnitt 6 nennt fuer Bosse weder Aggroreichweite noch bevorzugte Distanz,
   * Spritebreite oder Waffe. Diese vier Felder sind gesetzt, nicht abgeleitet.
   * Der Test haelt die Liste fest, damit sie nicht unbemerkt waechst.
   */
  const CANONICAL = new Set([
    'id', 'archetype', 'element', 'name', 'baseHealth', 'baseArmor', 'baseAccuracy',
    'baseEvasion', 'resistances', 'speed', 'behavior', 'scriptId', 'baseXp', 'frames',
    'dropTableId',
  ]);
  const WITHOUT_SOURCE = new Set(['aggroRange', 'preferredRange', 'weaponId', 'spriteWidth']);

  it('haben die Bosse genau die vier bekannten Felder ohne Tabelle', () => {
    const unexpected: string[] = [];
    for (const id of Object.keys(BOSSES)) {
      const def = ENEMIES[id];
      if (def === undefined) continue;
      for (const field of Object.keys(def)) {
        if (CANONICAL.has(field) || WITHOUT_SOURCE.has(field)) continue;
        unexpected.push(`${id}.${field}: neues Feld ohne Vorlage in docs/`);
      }
    }
    expect(unexpected).toEqual([]);
    expect([...WITHOUT_SOURCE].sort()).toEqual([
      'aggroRange',
      'preferredRange',
      'spriteWidth',
      'weaponId',
    ]);
  });
});
