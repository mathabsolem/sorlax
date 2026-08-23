/**
 * Inhaltsabgleich gegen docs/BESTIARY.md v3, Abschnitt 6, 7 und 8.
 *
 * Die kanonischen Werte stehen hier als TypeScript-Konstanten, abgeschrieben
 * aus dem Bestiarium. Nur die Tabellen, die auch der Generator braucht, liegen
 * in scripts/canonical.ts.
 */
import { describe, expect, it } from 'vitest';
import enemiesJson from '../content/enemies.json';
import itemsJson from '../content/items.json';
import weaponsJson from '../content/weapons.json';
import { ELEMENT_EFFECTS } from '../scripts/canonical';
import type { WeaponRow } from '../scripts/canonical';
import { DAMAGE_TYPES } from '../src/core/types';
import type { EnemyDef, ItemDef, Resistances, WeaponDef } from '../src/core/types';
import { check } from './fixtures/lint';

const ENEMIES = enemiesJson as unknown as Record<string, EnemyDef>;
const ITEMS = itemsJson as unknown as Record<string, ItemDef>;
const WEAPONS = weaponsJson as unknown as Record<string, WeaponDef>;

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

/** Abschnitt 8, die Grundtypen je Steckplatz, mit den Namen aus der Tabelle. */
const GEAR: Record<string, { slot: string; heavy: boolean; name: string }> = {
  suit_overall: { slot: 'suit', heavy: false, name: 'Arbeitsoverall' },
  suit_plated: { slot: 'suit', heavy: true, name: 'Panzeranzug' },
  helmet_hardhat: { slot: 'helmet', heavy: false, name: 'Schutzhelm' },
  helmet_visor: { slot: 'helmet', heavy: true, name: 'Vollvisierhelm' },
  belt_tool: { slot: 'belt', heavy: false, name: 'Werkzeuggürtel' },
  belt_harness: { slot: 'belt', heavy: true, name: 'Traggeschirr' },
  boots_rubber: { slot: 'boots', heavy: false, name: 'Gummistiefel' },
  boots_steel: { slot: 'boots', heavy: true, name: 'Stahlkappenstiefel' },
  gloves_grip: { slot: 'gloves', heavy: false, name: 'Griffhandschuhe' },
  gloves_armored: { slot: 'gloves', heavy: true, name: 'Panzerhandschuhe' },
  guard_deflector: { slot: 'guard', heavy: false, name: 'Ablenkmodul' },
  guard_plate: { slot: 'guard', heavy: true, name: 'Schulterpanzer' },
  amulet_tag: { slot: 'amulet', heavy: false, name: 'Erkennungsmarke' },
  amulet_sigil: { slot: 'amulet', heavy: true, name: 'Fundsiegel' },
  // gauge_right nutzt laut Tabelle dieselben Grundtypen wie gauge_left.
  gauge_pressure: { slot: 'gauge_left', heavy: false, name: 'Druckmesser' },
  gauge_seismic: { slot: 'gauge_left', heavy: true, name: 'Seismograf' },
};

/** Abschnitt 7, die Namen der Spielerwaffen. */
const PLAYER_WEAPON_NAMES: Record<string, string> = {
  w_prybar: 'Brechstange',
  w_pistol: 'Grubenpistole 9 mm',
  w_shotgun: 'Bolzensetzflinte',
  w_riveter: 'Bolzenkarabiner',
  w_rod: 'Induktionsstab',
  w_charger: 'Sprengladungswerfer',
  w_lance: 'Brennlanze',
  w_sprayer: 'Toxinsprüher',
  w_drill: 'Frostbohrer',
  w_scepter: 'Zepter von Sorlax',
};

/** Abschnitt 6, die Namen der Bosse. Die Archetypnamen stehen in canonical.ts. */
const ENEMY_NAMES: Record<string, string> = {
  boss_halvern: 'Steiger Halvern',
  boss_sporemother: 'Mutter der Sporen',
  boss_rime: 'Der Erkaltete',
  boss_sorlax: 'Sorlax, der Angeschnittene',
};

/** Abschnitt 8, Voraussetzungen und Grundwerte je Gewichtsklasse. */
const GEAR_RULES = {
  light: { reqLevel: 1, reqStrength: 10, reqAgility: 14, armor: 2, evasion: 1 },
  heavy: { reqLevel: 8, reqStrength: 22, reqAgility: 10, armor: 6, evasion: -1 },
};

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
      check(problems, id, 'name', def.name, ENEMY_NAMES[id]);
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
    for (const [id, want] of Object.entries(PLAYER_WEAPONS)) {
      weaponRow(problems, id, want);
      check(problems, id, 'name', WEAPONS[id]?.name, PLAYER_WEAPON_NAMES[id]);
    }
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
      check(problems, item.id, 'slots', item.slots, ['weapon']);
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
      // Messgeraete passen laut BESTIARY Abschnitt 8 in beide Handgelenke.
      const wantSlots =
        want.slot === 'gauge_left' ? ['gauge_left', 'gauge_right'] : [want.slot];
      check(problems, id, 'slots', def.slots, wantSlots);
      check(problems, id, 'amount', def.amount, 1);
      check(problems, id, 'reqLevel', def.reqLevel, rule.reqLevel);
      check(problems, id, 'reqStrength', def.reqStrength, rule.reqStrength);
      check(problems, id, 'reqAgility', def.reqAgility, rule.reqAgility);
      check(problems, id, 'name', def.name, want.name);
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
   * Jedes Feld eines Bosses braucht eine Tabelle in docs/. Aggroreichweite,
   * bevorzugte Distanz, Spritebreite und Waffe liess BESTIARY Abschnitt 6
   * offen; CONTENT_TABLES Abschnitt 3 hat sie ratifiziert.
   * `guaranteedUniqueId` steht in CONTENT_TABLES Abschnitt 2.
   * Der Test haelt die Liste fest, damit sie nicht unbemerkt waechst.
   */
  const CANONICAL = new Set([
    'id', 'archetype', 'element', 'name', 'baseHealth', 'baseArmor', 'baseAccuracy',
    'baseEvasion', 'resistances', 'speed', 'behavior', 'scriptId', 'baseXp', 'frames',
    'dropTableId',
    // CONTENT_TABLES Abschnitt 3
    'aggroRange', 'preferredRange', 'weaponId', 'spriteWidth',
    // CONTENT_TABLES Abschnitt 2
    'guaranteedUniqueId',
  ]);

  it('fuehren die Bosse kein Feld, zu dem es keine Tabelle gibt', () => {
    const unexpected: string[] = [];
    for (const id of Object.keys(BOSSES)) {
      const def = ENEMIES[id];
      if (def === undefined) continue;
      for (const field of Object.keys(def)) {
        if (CANONICAL.has(field)) continue;
        unexpected.push(`${id}.${field}: neues Feld ohne Vorlage in docs/`);
      }
    }
    expect(unexpected).toEqual([]);
  });

  it('gibt jedem Boss sein garantiertes Stueck aus Abschnitt 2', () => {
    const problems: string[] = [];
    const want: Record<string, string> = {
      boss_halvern: 'uq_halvern_visier',
      boss_sporemother: 'uq_sporenlunge',
      boss_rime: 'uq_frostkern',
      boss_sorlax: 'uq_sorlax_auge',
    };
    for (const [id, uniqueId] of Object.entries(want)) {
      check(problems, id, 'guaranteedUniqueId', ENEMIES[id]?.guaranteedUniqueId, uniqueId);
    }
    expect(problems).toEqual([]);
  });
});
