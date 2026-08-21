/**
 * Gegenstandsvergleich und Detailansicht, PHASE_4_5 Bloecke 1 bis 3.
 */
import { describe, expect, it } from 'vitest';
import { createInstance } from '../src/core/items';
import { serialize } from '../src/core/state';
import { canEquip, compareItems, isUpgrade, wornFor } from '../src/ui/itemModel';
import type { ContentDb, GameState, ItemInstance } from '../src/core/types';
import { setup } from './fixtures/world';

function craft(
  state: GameState,
  content: ContentDb,
  baseId: string,
  affixes: { affixId: string; value: number }[] = [],
  identified = true
): ItemInstance {
  const item = createInstance(state, baseId, 20, 'rare', affixes, content);
  if (item === null) throw new Error(`kein Grundtyp: ${baseId}`);
  item.identified = identified;
  return item;
}

describe('canEquip', () => {
  // Test 1 aus PHASE_4_5
  it('lehnt bei zu niedriger Kraft ab und nennt das fehlende Attribut', () => {
    const { state, content } = setup();
    state.player.level = 20;
    state.player.attributes.agility = 14;
    const heavy = craft(state, content, 'suit_plated');

    const check = canEquip(state.player, heavy, content);

    expect(check.ok).toBe(false);
    expect(check.missing).toEqual([{ field: 'strength', needed: 22, have: 10 }]);
  });

  it('nennt alle nicht erfuellten Voraussetzungen auf einmal', () => {
    const { state, content } = setup();
    const heavy = craft(state, content, 'suit_plated');

    const check = canEquip(state.player, heavy, content);

    expect(check.missing.map((entry) => entry.field)).toEqual(['level', 'strength']);
  });

  it('erlaubt ein Teil, dessen Voraussetzungen erfuellt sind', () => {
    const { state, content } = setup();
    state.player.attributes.agility = 14;
    expect(canEquip(state.player, craft(state, content, 'suit_overall'), content).ok).toBe(true);
  });

  it('rechnet mit uebergebenen Attributen, etwa aus der Ausruestung', () => {
    const { state, content } = setup();
    state.player.level = 20;
    const heavy = craft(state, content, 'suit_plated');

    expect(canEquip(state.player, heavy, content).ok).toBe(false);
    expect(
      canEquip(state.player, heavy, content, { ...state.player.attributes, strength: 22 }).ok
    ).toBe(true);
  });
});

describe('compareItems', () => {
  // Test 2 aus PHASE_4_5
  it('liefert fuer plus 20 gegen plus 8 Leben die Differenz plus 12', () => {
    const { state, content } = setup();
    const worn = craft(state, content, 'suit_overall', [{ affixId: 'suf_of_vigor', value: 8 }]);
    state.player.equipment['suit'] = worn;
    const candidate = craft(state, content, 'suit_overall', [
      { affixId: 'suf_of_vigor', value: 20 },
    ]);

    const comparison = compareItems(state, candidate, content);
    const health = comparison.perStat.find((entry) => entry.stat === 'maxHealth');

    expect(comparison.worn).toBe(worn);
    expect(health).toEqual({ stat: 'maxHealth', candidate: 20, worn: 8, delta: 12 });
    expect(comparison.derived.find((entry) => entry.stat === 'maxHealth')?.delta).toBe(12);
  });

  // Test 3 aus PHASE_4_5
  it('mutiert den uebergebenen Zustand nicht', () => {
    const { state, content } = setup();
    state.player.equipment['suit'] = craft(state, content, 'suit_overall');
    const candidate = craft(state, content, 'suit_plated', [
      { affixId: 'pre_reinforced', value: 10 },
    ]);

    const before = serialize(state);
    compareItems(state, candidate, content);

    expect(serialize(state)).toBe(before);
  });

  // Test 4 aus PHASE_4_5
  it('zaehlt einen Affix, den nur der Kandidat hat, gegen null', () => {
    const { state, content } = setup();
    state.player.equipment['suit'] = craft(state, content, 'suit_overall');
    const candidate = craft(state, content, 'suit_overall', [
      { affixId: 'suf_of_embers', value: 14 },
    ]);

    const comparison = compareItems(state, candidate, content);
    const fire = comparison.perStat.find((entry) => entry.stat === 'res_fire');

    expect(fire).toEqual({ stat: 'res_fire', candidate: 14, worn: 0, delta: 14 });
  });

  it('vergleicht auch gegen einen leeren Steckplatz', () => {
    const { state, content } = setup();
    const candidate = craft(state, content, 'suit_overall', [
      { affixId: 'suf_of_vigor', value: 15 },
    ]);

    const comparison = compareItems(state, candidate, content);

    expect(comparison.worn).toBeNull();
    // Grundwerte des Teils zaehlen mit: armor 2, evasion 1, dazu 15 Leben.
    expect(comparison.derived.find((entry) => entry.stat === 'maxHealth')?.delta).toBe(15);
    expect(comparison.derived.find((entry) => entry.stat === 'armor')?.delta).toBe(2);
  });

  it('nennt geaenderte Resistenzen in der Zusammenfassung', () => {
    const { state, content } = setup();
    const candidate = craft(state, content, 'suit_overall', [
      { affixId: 'suf_of_embers', value: 20 },
    ]);

    const derived = compareItems(state, candidate, content).derived;

    expect(derived.find((entry) => entry.stat === 'res_fire')).toEqual({
      stat: 'res_fire',
      before: 0,
      after: 20,
      delta: 20,
    });
    // Unveraenderte Resistenzen tauchen nicht auf.
    expect(derived.find((entry) => entry.stat === 'res_ice')).toBeUndefined();
  });
});

describe('isUpgrade', () => {
  // Test 11 aus PHASE_4_5
  it('erkennt ein besseres Teil und lehnt ein gleichwertiges ab', () => {
    const { state, content } = setup();
    const worn = craft(state, content, 'suit_overall', [{ affixId: 'suf_of_vigor', value: 15 }]);
    state.player.equipment['suit'] = worn;

    const better = craft(state, content, 'suit_overall', [{ affixId: 'suf_of_vigor', value: 30 }]);
    const same = craft(state, content, 'suit_overall', [{ affixId: 'suf_of_vigor', value: 15 }]);
    const worse = craft(state, content, 'suit_overall', [{ affixId: 'suf_of_vigor', value: 15 }]);
    worse.affixes = [{ affixId: 'suf_of_vigor', value: 15 }];
    worse.baseId = 'suit_overall';

    expect(isUpgrade(state, better, content)).toBe(true);
    expect(isUpgrade(state, same, content)).toBe(false);
    expect(isUpgrade(state, worse, content)).toBe(false);
  });

  it('wertet nur Leben, Ruestung, Genauigkeit und Ausweichen', () => {
    const { state, content } = setup();
    state.player.equipment['suit'] = craft(state, content, 'suit_overall');
    // Reine Feuerresistenz macht ein Teil nach dieser Regel nicht besser.
    const resistOnly = craft(state, content, 'suit_overall', [
      { affixId: 'suf_of_embers', value: 20 },
    ]);

    expect(isUpgrade(state, resistOnly, content)).toBe(false);
  });
});

describe('wornFor', () => {
  it('findet das getragene Teil, auch ueber den Zwillingsplatz', () => {
    const { state, content } = setup();
    const gauge = craft(state, content, 'gauge_pressure');
    state.player.equipment['gauge_right'] = gauge;

    expect(wornFor(state.player, craft(state, content, 'gauge_seismic'))).toBe(gauge);
    expect(wornFor(state.player, craft(state, content, 'suit_overall'))).toBeNull();
  });
});
