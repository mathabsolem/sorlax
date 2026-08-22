/**
 * Anzeigetexte fuer Gegenstaende, PHASE_4_5 Block 3.
 * Aus itemModel.test.ts herausgeloest.
 */
import { describe, expect, it } from 'vitest';
import { createInstance } from '../src/core/items';
import {
  affixLines,
  baseLines,
  formatAffix,
  itemDetail,
  playerStats,
  rarityClass,
  resistanceList,
  statLabel,
} from '../src/ui/itemText';
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

describe('formatAffix und affixLines', () => {
  // Test 5 aus PHASE_4_5
  it('erzeugt fuer suf_of_embers mit Wert 14 die erwartete Zeichenkette', () => {
    const { content } = setup();
    const affix = content.affixes['suf_of_embers'];
    if (affix === undefined) throw new Error('kein Affix');

    expect(formatAffix(affix, 14)).toBe('+14 Widerstand Feuer');
  });

  it('kennzeichnet prozentuale Affixe und negative Werte', () => {
    const { content } = setup();
    const brutal = content.affixes['pre_brutal'];
    const sturdy = content.affixes['pre_sturdy'];
    if (brutal === undefined || sturdy === undefined) throw new Error('kein Affix');

    expect(formatAffix(brutal, 8)).toBe('+8 % Nahkampfschaden');
    expect(formatAffix(sturdy, -3)).toBe('−3 Leben');
  });

  // Test 6 aus PHASE_4_5
  it('zeigt bei nicht identifizierten Teilen keine Affixwerte', () => {
    const { state, content } = setup();
    const affixes = [
      { affixId: 'suf_of_vigor', value: 22 },
      { affixId: 'suf_of_embers', value: 14 },
    ];

    expect(affixLines(craft(state, content, 'suit_overall', affixes, true), content)).toHaveLength(2);
    expect(affixLines(craft(state, content, 'suit_overall', affixes, false), content)).toEqual([]);
  });

  it('ueberspringt unbekannte Affixe', () => {
    const { state, content } = setup();
    const item = craft(state, content, 'suit_overall', [{ affixId: 'gibtsnicht', value: 5 }]);
    expect(affixLines(item, content)).toEqual([]);
  });
});

describe('itemDetail', () => {
  it('zeigt Grundwerte, Affixe und nicht erfuellte Voraussetzungen', () => {
    const { state, content } = setup();
    state.player.level = 20;
    const item = craft(state, content, 'suit_plated', [{ affixId: 'suf_of_vigor', value: 18 }]);

    const detail = itemDetail(state, item, content);

    expect(detail?.name).toBe('Panzeranzug');
    expect(detail?.slot).toBe('suit');
    expect(detail?.itemLevel).toBe(20);
    expect(detail?.base).toEqual(['+6 Rüstung', '−1 Ausweichen']);
    expect(detail?.affixes).toEqual(['+18 Leben']);
    expect(detail?.requirements).toEqual([
      { text: 'Stufe 8', met: true },
      { text: 'Kraft 22', met: false },
      { text: 'Geschick 10', met: true },
    ]);
  });

  it('verschweigt bei nicht identifizierten Teilen die Affixe', () => {
    const { state, content } = setup();
    const item = craft(state, content, 'suit_overall', [{ affixId: 'suf_of_vigor', value: 18 }], false);

    const detail = itemDetail(state, item, content);

    expect(detail?.identified).toBe(false);
    expect(detail?.affixes).toEqual([]);
    expect(detail?.base.length).toBeGreaterThan(0);
  });

  it('liefert null fuer einen unbekannten Grundtyp', () => {
    const { state, content } = setup();
    const item = craft(state, content, 'suit_overall');
    item.baseId = 'gibtsnicht';
    expect(itemDetail(state, item, content)).toBeNull();
  });
});

describe('Hilfsfunktionen', () => {
  it('statLabel, baseLines und rarityClass liefern die Anzeigetexte', () => {
    const { content } = setup();
    expect(statLabel('maxHealth')).toBe('Leben');
    expect(statLabel('res_fire')).toBe('Widerstand Feuer');
    expect(statLabel('gibtsnicht')).toBe('gibtsnicht');

    const def = content.items['guard_plate'];
    if (def === undefined) throw new Error('kein Grundtyp');
    expect(baseLines(def)).toEqual(['+6 Rüstung', '−1 Ausweichen']);

    expect(rarityClass('unique')).toBe('sx-rarity--unique');
  });

  it('playerStats und resistanceList lesen die abgeleiteten Werte', () => {
    const { state, content } = setup();
    const stats = playerStats(state, content);

    expect(stats.maxHealth).toBe(50);
    expect(resistanceList(stats).map((entry) => entry.type)).toEqual([
      'physical',
      'fire',
      'poison',
      'ice',
      'shock',
      'void',
    ]);
  });
});
