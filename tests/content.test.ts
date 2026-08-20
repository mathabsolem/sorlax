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
  const gear = Object.values(EQUIPMENT).filter((def) => def.type === 'equipment');
  const weapons = Object.values(EQUIPMENT).filter((def) => def.type === 'weapon');

  it('bietet je Steckplatz einen leichten und einen schweren Grundtyp', () => {
    // BESTIARY Abschnitt 8: gauge_right nutzt dieselben Grundtypen wie links,
    // der Platz weapon wird durch die Waffen aus Abschnitt 7 belegt.
    const gearSlots = EQUIP_SLOTS.filter(
      (slot) => slot !== 'weapon' && slot !== 'gauge_right'
    );
    for (const slot of gearSlots) {
      const bases = gear.filter((def) => def.slot === slot);
      expect(bases).toHaveLength(2);

      const light = bases.filter((def) => def.reqLevel === 1);
      const heavy = bases.filter((def) => def.reqLevel > 1);
      expect(light).toHaveLength(1);
      expect(heavy).toHaveLength(1);
    }
  });

  it('setzt Voraussetzungen und Grundwerte nach BESTIARY Abschnitt 8', () => {
    for (const def of gear) {
      const heavy = def.reqLevel > 1;
      expect(def.reqLevel).toBe(heavy ? 8 : 1);
      expect(def.reqStrength).toBe(heavy ? 22 : 10);
      expect(def.reqAgility).toBe(heavy ? 10 : 14);
      expect(def.baseModifiers).toEqual([
        { stat: 'armor', mode: 'flat', value: heavy ? 6 : 2 },
        { stat: 'evasion', mode: 'flat', value: heavy ? -1 : 1 },
      ]);
    }
  });

  it('traegt bei jedem Eintrag Schluessel, Steckplatz und Menge', () => {
    for (const [key, def] of Object.entries(EQUIPMENT)) {
      expect(def.id).toBe(key);
      expect(['equipment', 'weapon']).toContain(def.type);
      expect(EQUIP_SLOTS).toContain(def.slot as EquipSlot);
      expect(def.amount).toBe(1);
      for (const mod of def.baseModifiers ?? []) expect(MODES).toContain(mod.mode);
    }
  });

  it('fuehrt die zehn Waffen aus BESTIARY Abschnitt 7', () => {
    expect(weapons).toHaveLength(10);
    for (const def of weapons) {
      expect(def.slot).toBe('weapon');
      expect(def.weaponId).toBe(def.id.replace(/^item_/, ''));
      // Nahkampf verlangt Kraft, Fernkampf Geschick (PHASE_3_8 Block 3).
      const melee = def.reqStrength > 0;
      expect(melee ? def.reqStrength : def.reqAgility).toBe(melee ? 12 : 14);
    }
    // Bosswaffen verlangen zusaetzlich die Sohle ihres Bosses.
    expect(EQUIPMENT['item_w_lance']?.reqLevel).toBe(4);
    expect(EQUIPMENT['item_w_sprayer']?.reqLevel).toBe(8);
    expect(EQUIPMENT['item_w_drill']?.reqLevel).toBe(12);
    expect(EQUIPMENT['item_w_scepter']?.reqLevel).toBe(16);
  });
});

describe('content/dropTables.json', () => {
  it('kennt common_drop und boss_drop mit vollstaendigen Gewichten', () => {
    expect(Object.keys(DROP_TABLES).sort()).toEqual(['boss_drop', 'common_drop']);

    for (const [key, table] of Object.entries(DROP_TABLES)) {
      expect(table.id).toBe(key);
      for (const rarity of RARITIES) expect(table.rarityWeights[rarity]).toBeGreaterThanOrEqual(0);
      // Der Waffenplatz wird nicht gewuerfelt, dort liegen keine Grundtypen.
      for (const slot of EQUIP_SLOTS) {
        if (slot === 'weapon') continue;
        expect(table.slotWeights[slot]).toBeGreaterThan(0);
      }
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
