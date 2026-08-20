/**
 * Beitraege der Ausruestung zu den abgeleiteten Werten, PHASE_3_6 Block 5.
 */
import { describe, expect, it } from 'vitest';
import {
  ATTRIBUTE_STATS,
  RATIO_STATS,
  attributeBonus,
  collectEquipmentModifiers,
  flatOf,
  magnitudeOf,
  percentOf,
  ratioOf,
  resistanceTypeOf,
} from '../src/core/modifiers';
import type { ModifierSums } from '../src/core/modifiers';
import { createInstance } from '../src/core/items';
import { startAttributes } from '../src/core/state';
import type { ContentDb, GameState, ItemInstance } from '../src/core/types';
import { setup } from './fixtures/world';

function craft(
  state: GameState,
  content: ContentDb,
  baseId: string,
  affixes: { affixId: string; value: number }[]
): ItemInstance {
  const item = createInstance(state, baseId, 20, 'rare', affixes, content);
  if (item === null) throw new Error(`kein Grundtyp: ${baseId}`);
  return item;
}

describe('resistanceTypeOf', () => {
  it('erkennt die Resistenzaffixe und sonst nichts', () => {
    expect(resistanceTypeOf('res_fire')).toBe('fire');
    expect(resistanceTypeOf('res_void')).toBe('void');
    expect(resistanceTypeOf('maxHealth')).toBeNull();
    expect(resistanceTypeOf('res_nonsense')).toBeNull();
    expect(resistanceTypeOf('res_')).toBeNull();
  });
});

describe('collectEquipmentModifiers', () => {
  it('summiert Grundwerte und Affixe ueber alle Steckplaetze', () => {
    const { state, content } = setup();
    // Leichte Teile tragen laut BESTIARY Abschnitt 8 armor 2 und evasion 1.
    state.player.equipment['suit'] = craft(state, content, 'suit_overall', [
      { affixId: 'pre_sturdy', value: 10 },
    ]);
    state.player.equipment['guard'] = craft(state, content, 'guard_deflector', [
      { affixId: 'pre_plated', value: 3 },
    ]);

    const sums = collectEquipmentModifiers(state.player.equipment, content);
    expect(flatOf(sums, 'armor')).toBe(7);
    expect(flatOf(sums, 'maxHealth')).toBe(10);
    expect(flatOf(sums, 'evasion')).toBe(2);
  });

  it('trennt flache von prozentualen Beitraegen', () => {
    const { state, content } = setup();
    // Waffen haben keine baseModifiers, der Beitrag kommt allein aus dem Affix.
    state.player.equipment['weapon'] = craft(state, content, 'item_w_prybar', [
      { affixId: 'pre_brutal', value: 8 },
      { affixId: 'pre_honed', value: 5 },
    ]);

    const sums = collectEquipmentModifiers(state.player.equipment, content);
    expect(percentOf(sums, 'meleeBonus')).toBe(8);
    expect(flatOf(sums, 'meleeBonus')).toBe(0);
    expect(flatOf(sums, 'accuracy')).toBe(5);
  });

  it('ueberspringt unbekannte Affixe und Grundtypen', () => {
    const { state, content } = setup();
    const item = craft(state, content, 'suit_overall', [{ affixId: 'gibtsnicht', value: 99 }]);
    item.baseId = 'auchnicht';
    state.player.equipment['suit'] = item;

    const sums = collectEquipmentModifiers(state.player.equipment, content);
    expect(flatOf(sums, 'armor')).toBe(0);
    expect(sums.flat).toEqual({});
  });

  it('liefert fuer leere Ausruestung leere Summen', () => {
    const { content } = setup();
    const sums = collectEquipmentModifiers({}, content);
    expect(flatOf(sums, 'armor')).toBe(0);
    expect(percentOf(sums, 'armor')).toBe(0);
  });
});

describe('Anwendung der Summen', () => {
  const sums: ModifierSums = {
    flat: { maxHealth: 20, critBonus: 3 },
    percent: { maxHealth: 10, meleeBonus: 8 },
  };

  it('magnitudeOf addiert flach und wendet die Prozente als einen Faktor an', () => {
    expect(magnitudeOf(sums, 'maxHealth', 100)).toBeCloseTo(132, 10);
    expect(magnitudeOf(sums, 'armor', 5)).toBe(5);
  });

  it('ratioOf zaehlt flache und prozentuale Beitraege als Prozentpunkte', () => {
    expect(ratioOf(sums, 'critBonus')).toBeCloseTo(0.03, 10);
    expect(ratioOf(sums, 'meleeBonus')).toBeCloseTo(0.08, 10);
    expect(ratioOf(sums, 'ammoSaveChance')).toBe(0);
  });

  it('nennt die Verhaeltniswerte vollstaendig', () => {
    expect([...RATIO_STATS]).toEqual([
      'meleeBonus',
      'elemBonus',
      'critBonus',
      'freeActionChance',
      'ammoSaveChance',
    ]);
  });
});

describe('attributeBonus', () => {
  it('legt Attributsaffixe auf die Grundattribute', () => {
    const base = startAttributes();
    const sums: ModifierSums = { flat: { strength: 4, focus: 2 }, percent: {} };

    expect(attributeBonus(sums, base)).toEqual({
      strength: 14,
      agility: 10,
      vitality: 10,
      focus: 12,
    });
    // Die Grundattribute bleiben unangetastet.
    expect(base.strength).toBe(10);
  });

  it('kennt genau die vier Attribute', () => {
    expect([...ATTRIBUTE_STATS]).toEqual(['strength', 'agility', 'vitality', 'focus']);
  });
});
