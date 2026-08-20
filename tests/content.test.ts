/**
 * Der Startkatalog aus content/, PHASE_3_6 Block 3.
 * Prueft, dass die JSON-Dateien den Vertrag aus INTERFACES Abschnitt 5 und 8
 * einhalten. Die Fixtures ziehen dieselben Dateien und verlassen sich darauf.
 */
import { describe, expect, it } from 'vitest';
import { EQUIP_SLOTS } from '../src/core/types';
import type { EquipSlot, Rarity } from '../src/core/types';
import { AFFIXES, DROP_TABLES, EQUIPMENT } from './fixtures/world';

const KINDS = ['prefix', 'suffix'];
const MODES = ['flat', 'percent'];
const APPLIES = ['player', 'enemy', 'both'];
const RARITIES: Rarity[] = ['normal', 'magic', 'rare', 'unique'];

describe('content/affixes.json', () => {
  it('enthaelt genau die achtzehn Eintraege des Startkatalogs', () => {
    expect(Object.keys(AFFIXES)).toHaveLength(18);
    expect(Object.keys(AFFIXES)).toEqual(
      expect.arrayContaining([
        'pre_sturdy',
        'pre_plated',
        'pre_honed',
        'pre_brutal',
        'pre_charged',
        'pre_reinforced',
        'suf_of_vigor',
        'suf_of_evasion',
        'suf_of_embers',
        'suf_of_spores',
        'suf_of_rime',
        'suf_of_current',
        'suf_of_precision',
        'suf_of_the_lamp',
        'suf_of_haste',
        'suf_of_thrift',
        'suf_of_might',
        'suf_of_focus',
      ])
    );
  });

  it('haelt Schluessel, Art, Grenzen und Steckplaetze ein', () => {
    for (const [key, def] of Object.entries(AFFIXES)) {
      expect(def.id).toBe(key);
      expect(KINDS).toContain(def.kind);
      expect(MODES).toContain(def.mode);
      expect(APPLIES).toContain(def.appliesTo);
      expect(def.min).toBeLessThanOrEqual(def.max);
      expect(def.tier).toBeGreaterThanOrEqual(1);
      expect(def.tier).toBeLessThanOrEqual(6);
      expect(def.minItemLevel).toBeGreaterThanOrEqual(1);
      expect(def.slots.length).toBeGreaterThan(0);
      for (const slot of def.slots) expect(EQUIP_SLOTS).toContain(slot);
    }
  });

  it('gibt suf_of_the_lamp nur an den Spieler', () => {
    expect(AFFIXES['suf_of_the_lamp']?.appliesTo).toBe('player');
    expect(AFFIXES['suf_of_haste']?.appliesTo).toBe('player');
    expect(AFFIXES['suf_of_thrift']?.appliesTo).toBe('player');
  });

  it('fuehrt critBonus, freeActionChance und ammoSaveChance in Prozentpunkten', () => {
    // Ganze Zahlen, damit in JSON keine Fliesskommawerte stehen.
    for (const id of ['suf_of_precision', 'suf_of_haste', 'suf_of_thrift']) {
      const def = AFFIXES[id];
      expect(def?.mode).toBe('flat');
      expect(Number.isInteger(def?.min)).toBe(true);
      expect(Number.isInteger(def?.max)).toBe(true);
      expect(def?.min).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('content/items.json', () => {
  it('bietet je Steckplatz einen einfachen und einen schweren Grundtyp', () => {
    for (const slot of EQUIP_SLOTS) {
      const bases = Object.values(EQUIPMENT).filter((def) => def.slot === slot);
      expect(bases).toHaveLength(2);

      const simple = bases.filter((def) => def.reqLevel === 1);
      const heavy = bases.filter((def) => def.reqLevel > 1);
      expect(simple).toHaveLength(1);
      expect(heavy).toHaveLength(1);
      // Der schwere Grundtyp verlangt mehr als der einfache.
      const heavyDef = heavy[0];
      expect((heavyDef?.reqStrength ?? 0) + (heavyDef?.reqAgility ?? 0)).toBeGreaterThan(0);
    }
  });

  it('ist durchgehend vom Typ equipment und traegt einen Steckplatz', () => {
    for (const [key, def] of Object.entries(EQUIPMENT)) {
      expect(def.id).toBe(key);
      expect(def.type).toBe('equipment');
      expect(EQUIP_SLOTS).toContain(def.slot as EquipSlot);
      expect(def.amount).toBe(1);
      for (const mod of def.baseModifiers ?? []) expect(MODES).toContain(mod.mode);
    }
  });
});

describe('content/dropTables.json', () => {
  it('kennt common_drop und boss_drop mit vollstaendigen Gewichten', () => {
    expect(Object.keys(DROP_TABLES).sort()).toEqual(['boss_drop', 'common_drop']);

    for (const [key, table] of Object.entries(DROP_TABLES)) {
      expect(table.id).toBe(key);
      for (const rarity of RARITIES) expect(table.rarityWeights[rarity]).toBeGreaterThanOrEqual(0);
      for (const slot of EQUIP_SLOTS) expect(table.slotWeights[slot]).toBeGreaterThan(0);
    }
  });

  it('verteilt common_drop nach RPG.md Abschnitt 4', () => {
    expect(DROP_TABLES['common_drop']?.rarityWeights).toEqual({
      normal: 62,
      magic: 28,
      rare: 9,
      unique: 1,
    });
  });

  it('gibt boss_drop zwanzig Prozent selten und acht Prozent einzigartig', () => {
    const weights = DROP_TABLES['boss_drop']?.rarityWeights;
    const total = RARITIES.reduce((sum, rarity) => sum + (weights?.[rarity] ?? 0), 0);
    expect(total).toBe(100);
    expect(weights?.rare).toBe(20);
    expect(weights?.unique).toBe(8);
  });
});
