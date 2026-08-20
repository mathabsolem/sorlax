/**
 * Affixauswahl und Gegenstandswuerfel, PHASE_3_6 Block 2.
 */
import { describe, expect, it } from 'vitest';
import { MAX_PREFIXES, MAX_SUFFIXES, RARITIES, eligibleAffixes, rollItem } from '../src/core/affixes';
import { Rng } from '../src/core/rng';
import type { ContentDb, DropTableDef, GameState, ItemInstance, Rarity } from '../src/core/types';
import { setup } from './fixtures/world';

const ALL_SLOTS: DropTableDef['slotWeights'] = {
  suit: 10,
  helmet: 10,
  belt: 10,
  boots: 10,
  gloves: 10,
  weapon: 10,
  guard: 10,
  amulet: 10,
  gauge_left: 10,
  gauge_right: 10,
};

function table(weights: Record<Rarity, number>): DropTableDef {
  return { id: 'test_table', rarityWeights: weights, slotWeights: { ...ALL_SLOTS } };
}

const RARE_ONLY = table({ normal: 0, magic: 0, rare: 1, unique: 0 });
const MAGIC_ONLY = table({ normal: 0, magic: 1, rare: 0, unique: 0 });
const UNIQUE_ONLY = table({ normal: 0, magic: 0, rare: 0, unique: 1 });

/** Wuerfelt `count` Gegenstaende auf demselben Grundtyp. */
function rollMany(
  content: ContentDb,
  state: GameState,
  baseId: string,
  itemLevel: number,
  forEnemy: boolean,
  count: number,
  drops: DropTableDef = RARE_ONLY
): ItemInstance[] {
  const rng = new Rng(4242);
  const items: ItemInstance[] = [];
  for (let index = 0; index < count; index++) {
    items.push(rollItem(rng, baseId, itemLevel, drops, content, forEnemy, state));
  }
  return items;
}

describe('eligibleAffixes', () => {
  it('filtert nach Steckplatz, Stufe und Traeger und sortiert nach id', () => {
    const { content } = setup();
    const ids = eligibleAffixes('suit', 1, false, content).map((affix) => affix.id);

    expect(ids).toEqual([...ids].sort());
    expect(ids).toContain('pre_sturdy');
    expect(ids).toContain('suf_of_embers');
    // pre_reinforced braucht Stufe 16, suf_of_precision sitzt nicht auf `suit`.
    expect(ids).not.toContain('pre_reinforced');
    expect(ids).not.toContain('suf_of_precision');
  });

  // Test 3 aus PHASE_3_6
  it('laesst auf Stufe 1 keinen Affix mit minItemLevel 16 zu', () => {
    const { state, content } = setup();
    expect(eligibleAffixes('suit', 1, false, content).map((a) => a.id)).not.toContain(
      'pre_reinforced'
    );
    expect(eligibleAffixes('suit', 16, false, content).map((a) => a.id)).toContain(
      'pre_reinforced'
    );

    for (const item of rollMany(content, state, 'suit_liner', 1, false, 200)) {
      for (const rolled of item.affixes) {
        const def = content.affixes[rolled.affixId];
        expect(def?.minItemLevel).toBeLessThanOrEqual(1);
      }
    }
  });

  // Test 6 aus PHASE_3_6
  it('schliesst suf_of_the_lamp bei Gegnern aus', () => {
    const { state, content } = setup();
    expect(eligibleAffixes('helmet', 20, false, content).map((a) => a.id)).toContain(
      'suf_of_the_lamp'
    );
    expect(eligibleAffixes('helmet', 20, true, content).map((a) => a.id)).not.toContain(
      'suf_of_the_lamp'
    );

    const ids = rollMany(content, state, 'helmet_cap', 20, true, 200).flatMap((item) =>
      item.affixes.map((affix) => affix.affixId)
    );
    expect(ids).not.toContain('suf_of_the_lamp');
    expect(ids.length).toBeGreaterThan(0);
  });
});

describe('rollItem', () => {
  // Test 2 aus PHASE_3_6
  it('liefert bei gleichem RNG-Zustand exakt dasselbe Ergebnis', () => {
    const once = () => {
      const { state, content } = setup();
      const rng = new Rng(31337);
      return [
        rollItem(rng, 'suit_liner', 20, RARE_ONLY, content, false, state),
        rollItem(rng, 'suit_liner', 20, RARE_ONLY, content, false, state),
      ];
    };
    expect(once()).toEqual(once());
  });

  it('zieht die Raritaet aus rarityWeights', () => {
    const { state, content } = setup();
    const rng = new Rng(5);
    for (let index = 0; index < 20; index++) {
      expect(rollItem(rng, 'suit_liner', 20, MAGIC_ONLY, content, false, state).rarity).toBe(
        'magic'
      );
    }
    expect(RARITIES).toEqual(['normal', 'magic', 'rare', 'unique']);
  });

  it('gibt normalen Gegenstaenden keine Affixe und magischen ein bis zwei', () => {
    const { state, content } = setup();
    const normals = rollMany(
      content,
      state,
      'suit_liner',
      20,
      false,
      20,
      table({ normal: 1, magic: 0, rare: 0, unique: 0 })
    );
    for (const item of normals) expect(item.affixes).toEqual([]);

    for (const item of rollMany(content, state, 'suit_liner', 20, false, 50, MAGIC_ONLY)) {
      expect(item.affixes.length).toBeGreaterThanOrEqual(1);
      expect(item.affixes.length).toBeLessThanOrEqual(2);
    }
  });

  // Test 4 aus PHASE_3_6
  it('vergibt keinen Affix zweimal', () => {
    const { state, content } = setup();
    for (const item of rollMany(content, state, 'suit_liner', 40, false, 300)) {
      const ids = item.affixes.map((affix) => affix.affixId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  // Test 5 aus PHASE_3_6
  it('haelt hoechstens drei Praefixe und drei Suffixe', () => {
    const { state, content } = setup();
    const items = [
      ...rollMany(content, state, 'suit_liner', 40, false, 150),
      ...rollMany(content, state, 'gloves_wrap', 40, false, 150),
    ];

    for (const item of items) {
      let prefixes = 0;
      let suffixes = 0;
      for (const rolled of item.affixes) {
        const def = content.affixes[rolled.affixId];
        if (def?.kind === 'prefix') prefixes += 1;
        else suffixes += 1;
      }
      expect(prefixes).toBeLessThanOrEqual(MAX_PREFIXES);
      expect(suffixes).toBeLessThanOrEqual(MAX_SUFFIXES);
    }
  });

  it('haelt die Affixwerte in den Grenzen der Definition', () => {
    const { state, content } = setup();
    for (const item of rollMany(content, state, 'suit_liner', 40, false, 200)) {
      for (const rolled of item.affixes) {
        const def = content.affixes[rolled.affixId];
        if (def === undefined) throw new Error(`unbekannter Affix ${rolled.affixId}`);
        expect(rolled.value).toBeGreaterThanOrEqual(def.min);
        expect(rolled.value).toBeLessThanOrEqual(def.max);
      }
    }
  });

  it('ersetzt bei einzigartigen Gegenstaenden den Grundtyp und die Affixliste', () => {
    const { state, content } = setup();
    const item = rollItem(new Rng(11), 'suit_plate', 20, UNIQUE_ONLY, content, false, state);

    expect(item.rarity).toBe('unique');
    expect(item.baseId).toBe('suit_liner');
    expect(item.affixes).toEqual(content.uniques['uniq_ember_shell']?.affixes);
  });

  it('faellt auf selten zurueck, wenn kein passender einzigartiger Gegenstand da ist', () => {
    const { state, content } = setup();
    const withoutUniques: ContentDb = { ...content, uniques: {} };
    const item = rollItem(new Rng(11), 'suit_liner', 20, UNIQUE_ONLY, withoutUniques, false, state);

    expect(item.rarity).toBe('rare');
    expect(item.affixes.length).toBeGreaterThanOrEqual(1);
  });

  it('wirft bei einem Grundtyp ohne Steckplatz', () => {
    const { state, content } = setup();
    expect(() => rollItem(new Rng(1), 'medkit', 1, RARE_ONLY, content, false, state)).toThrow();
    expect(() => rollItem(new Rng(1), 'nix', 1, RARE_ONLY, content, false, state)).toThrow();
  });
});
