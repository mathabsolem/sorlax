/**
 * Inhaltsabgleich gegen docs/CONTENT_TABLES.md v1.1, Abschnitt 1 und 2.
 *
 * Die Werte stehen hier als Konstanten, abgeschrieben aus der Tabelle. Der
 * Test haette die falsche Art von `antitoxin` und die zweideutige Bedeutung
 * von `amount` sofort gezeigt.
 */
import { describe, expect, it } from 'vitest';
import itemsJson from '../content/items.json';
import uniquesJson from '../content/uniques.json';
import type { ItemDef, UniqueDef } from '../src/core/types';
import { check } from './fixtures/lint';

const ITEMS = itemsJson as unknown as Record<string, ItemDef>;
const UNIQUES = uniquesJson as unknown as Record<string, UniqueDef>;

type Consumable = {
  name: string;
  type: ItemDef['type'];
  amount: number;
  ammoType?: string;
  effect?: { id: string; turns: number; magnitude: number };
};

/** Abschnitt 1, die vierzehn Stapelgueter. */
const CONSUMABLES: Record<string, Consumable> = {
  heal_small: { name: 'Notverband', type: 'heal', amount: 25 },
  heal_large: { name: 'Trauma-Kit', type: 'heal', amount: 60 },
  antitoxin: {
    name: 'Antitoxin',
    type: 'heal',
    amount: 10,
    effect: { id: 'cure_toxin', turns: 0, magnitude: 0 },
  },
  armor_plate: {
    name: 'Panzerplatte',
    type: 'powerup',
    amount: 1,
    effect: { id: 'plating', turns: 20, magnitude: 10 },
  },
  scanner_charge: { name: 'Prüfzelle', type: 'powerup', amount: 1 },
  ammo_pistol: { name: '9-mm-Magazin', type: 'ammo', amount: 8, ammoType: 'pistol' },
  ammo_rivet: { name: 'Bolzenstreifen', type: 'ammo', amount: 6, ammoType: 'rivet' },
  ammo_shell: { name: 'Setzpatronen', type: 'ammo', amount: 4, ammoType: 'shell' },
  ammo_charge: { name: 'Vortriebsladung', type: 'ammo', amount: 2, ammoType: 'charge' },
  ammo_fuel: { name: 'Brennstoffpatrone', type: 'ammo', amount: 6, ammoType: 'fuel' },
  ammo_toxin_canister: {
    name: 'Toxinkanister',
    type: 'ammo',
    amount: 5,
    ammoType: 'toxin_canister',
  },
  ammo_coolant: { name: 'Kühlmittelzelle', type: 'ammo', amount: 4, ammoType: 'coolant' },
  ammo_cell: { name: 'Induktionszelle', type: 'ammo', amount: 6, ammoType: 'cell' },
  ammo_essence: { name: 'Essenzsplitter', type: 'ammo', amount: 3, ammoType: 'essence' },
};

/** Abschnitt 2, die acht einzigartigen Gegenstaende. */
const UNIQUE_ROWS: Record<
  string,
  { baseId: string; name: string; minItemLevel: number; bossExclusive: boolean; affixes: [string, number][] }
> = {
  uq_halvern_visier: {
    baseId: 'helmet_visor', name: 'Halverns Brandvisier', minItemLevel: 6, bossExclusive: true,
    affixes: [['suf_of_embers', 35], ['pre_plated', 5], ['suf_of_the_lamp', 2]],
  },
  uq_sporenlunge: {
    baseId: 'suit_overall', name: 'Sporenlunge', minItemLevel: 13, bossExclusive: true,
    affixes: [['suf_of_spores', 35], ['suf_of_vigor', 28], ['pre_plated', 4]],
  },
  uq_frostkern: {
    baseId: 'guard_deflector', name: 'Frostkern', minItemLevel: 19, bossExclusive: true,
    affixes: [['suf_of_rime', 35], ['pre_reinforced', 11], ['suf_of_embers', 15]],
  },
  uq_sorlax_auge: {
    baseId: 'amulet_sigil', name: 'Das Auge von Sorlax', minItemLevel: 26, bossExclusive: true,
    affixes: [['suf_of_focus', 6], ['pre_charged', 9], ['suf_of_vigor', 30]],
  },
  uq_stollenschritt: {
    baseId: 'boots_rubber', name: 'Stollenschritt', minItemLevel: 8, bossExclusive: false,
    affixes: [['suf_of_evasion', 6], ['suf_of_haste', 7]],
  },
  uq_greifer: {
    baseId: 'gloves_grip', name: 'Der Greifer', minItemLevel: 10, bossExclusive: false,
    affixes: [['pre_honed', 8], ['suf_of_precision', 5]],
  },
  uq_pruefblei: {
    baseId: 'gauge_pressure', name: 'Prüfblei', minItemLevel: 14, bossExclusive: false,
    affixes: [['suf_of_might', 6], ['pre_plated', 5]],
  },
  uq_wetterglas: {
    baseId: 'gauge_seismic', name: 'Wetterglas', minItemLevel: 20, bossExclusive: false,
    affixes: [['suf_of_focus', 6], ['pre_honed', 7]],
  },
};

describe('Abschnitt 1, Verbrauchsgueter', () => {
  it('fuehrt alle vierzehn mit Art, Menge und Munitionssorte', () => {
    const problems: string[] = [];
    for (const [id, want] of Object.entries(CONSUMABLES)) {
      const def = ITEMS[id];
      if (def === undefined) {
        problems.push(`${id}: fehlt in content/items.json`);
        continue;
      }
      check(problems, id, 'name', def.name, want.name);
      check(problems, id, 'type', def.type, want.type);
      check(problems, id, 'amount', def.amount, want.amount);
      check(problems, id, 'ammoType', def.ammoType, want.ammoType);
      check(problems, id, 'effect', def.effect, want.effect);
    }
    expect(problems).toEqual([]);
  });

  it('fuehrt kein Stapelgut, das Abschnitt 1 nicht kennt', () => {
    const strays = Object.values(ITEMS)
      .filter((def) => def.type === 'ammo' || def.type === 'heal' || def.type === 'powerup')
      .filter((def) => CONSUMABLES[def.id] === undefined)
      .map((def) => `${def.id}: Stapelgut ohne Eintrag in Abschnitt 1`);
    expect(strays).toEqual([]);
  });
});

describe('Abschnitt 2, einzigartige Gegenstaende', () => {
  it('fuehrt alle acht mit Grundtyp, Stufe, Bossbindung und Affixen', () => {
    const problems: string[] = [];
    for (const [id, want] of Object.entries(UNIQUE_ROWS)) {
      const def = UNIQUES[id];
      if (def === undefined) {
        problems.push(`${id}: fehlt in content/uniques.json`);
        continue;
      }
      check(problems, id, 'baseId', def.baseId, want.baseId);
      check(problems, id, 'name', def.name, want.name);
      check(problems, id, 'minItemLevel', def.minItemLevel, want.minItemLevel);
      check(problems, id, 'bossExclusive', def.bossExclusive, want.bossExclusive);
      check(
        problems,
        id,
        'affixes',
        def.affixes,
        want.affixes.map(([affixId, value]) => ({ affixId, value }))
      );
    }
    expect(problems).toEqual([]);
  });

  it('fuehrt keinen Eintrag, den Abschnitt 2 nicht kennt', () => {
    const strays = Object.keys(UNIQUES)
      .filter((id) => UNIQUE_ROWS[id] === undefined)
      .map((id) => `${id}: einzigartiger Gegenstand ohne Eintrag in Abschnitt 2`);
    expect(strays).toEqual([]);
  });
});
