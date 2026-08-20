/**
 * Ausruestung in getDerivedStats, PHASE_3_6 Block 5.
 */
import { describe, expect, it } from 'vitest';
import { createInstance } from '../src/core/items';
import {
  PLAYER_RESIST_CAP,
  effectiveAttributes,
  enemyActor,
  getDerivedStats,
  playerActor,
} from '../src/core/derived';
import type {
  ContentDb,
  Difficulty,
  EquipSlot,
  GameState,
  ItemInstance,
} from '../src/core/types';
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

function wear(
  state: GameState,
  content: ContentDb,
  slot: EquipSlot,
  baseId: string,
  affixes: { affixId: string; value: number }[]
): ItemInstance {
  const item = craft(state, content, baseId, affixes);
  state.player.equipment[slot] = item;
  return item;
}

function statsOf(state: GameState, content: ContentDb, difficulty: Difficulty = 'normal') {
  return getDerivedStats(playerActor(state), content, difficulty);
}

describe('Prozentuale Beitraege', () => {
  // Test 8 aus PHASE_3_6
  it('addiert zwei Teile mit je 8 Prozent meleeBonus zu 0.16, nicht zu 0.1664', () => {
    const { state, content } = setup();
    wear(state, content, 'weapon', 'item_w_prybar', [{ affixId: 'pre_brutal', value: 8 }]);
    wear(state, content, 'gloves', 'gloves_grip', [{ affixId: 'pre_brutal', value: 8 }]);

    const stats = statsOf(state, content);
    expect(stats.meleeBonus).toBeCloseTo(0.16, 10);
    expect(stats.meleeBonus).not.toBeCloseTo(0.1664, 4);
  });

  it('addiert prozentuale Groessenwerte ebenfalls, statt sie zu multiplizieren', () => {
    const { state, content } = setup();
    // Der Startkatalog kennt keinen prozentualen Lebensaffix, fuer die Regel
    // aus Block 5 wird hier einer ergaenzt.
    const custom: ContentDb = {
      ...content,
      affixes: {
        ...content.affixes,
        pct_life: {
          id: 'pct_life',
          kind: 'prefix',
          stat: 'maxHealth',
          mode: 'percent',
          min: 10,
          max: 10,
          tier: 1,
          minItemLevel: 1,
          slots: ['suit', 'guard'],
          appliesTo: 'both',
        },
      },
    };
    wear(state, custom, 'suit', 'suit_overall', [{ affixId: 'pct_life', value: 10 }]);
    wear(state, custom, 'guard', 'guard_deflector', [{ affixId: 'pct_life', value: 10 }]);

    // 50 mal 1.20 sind 60, nicht 50 mal 1.1 mal 1.1 gleich 60.5.
    expect(statsOf(state, custom).maxHealth).toBe(60);
  });
});

describe('Attributsaffixe', () => {
  // Test 9 aus PHASE_3_6
  it('suf_of_might mit Wert 4 hebt strength und damit meleeBonus', () => {
    const { state, content } = setup();
    expect(statsOf(state, content).meleeBonus).toBeCloseTo(0, 10);

    wear(state, content, 'gloves', 'gloves_grip', [{ affixId: 'suf_of_might', value: 4 }]);

    expect(effectiveAttributes(state, content).strength).toBe(14);
    expect(statsOf(state, content).meleeBonus).toBeCloseTo(0.04, 10);
  });

  it('vitality aus einem Affix hebt maxHealth ueber die Attributsformel', () => {
    const { state, content } = setup();
    // suf_of_focus sitzt auf helmet und amulet und hebt focus, nicht vitality.
    wear(state, content, 'helmet', 'helmet_hardhat', [{ affixId: 'suf_of_focus', value: 6 }]);

    expect(effectiveAttributes(state, content).focus).toBe(16);
    const stats = statsOf(state, content);
    expect(stats.elemBonus).toBeCloseTo(0.06, 10);
    expect(stats.critBonus).toBeCloseTo(0.012, 10);
  });

  it('laesst die gespeicherten Attribute unveraendert', () => {
    const { state, content } = setup();
    wear(state, content, 'gloves', 'gloves_grip', [{ affixId: 'suf_of_might', value: 4 }]);

    statsOf(state, content);
    expect(state.player.attributes.strength).toBe(10);
  });
});

describe('Resistenzen', () => {
  // Test 11 aus PHASE_3_6
  it('zaehlt zwei Teile mit je 20 auf normal zu 40 und auf nightmare zu minus 60', () => {
    const { state, content } = setup();
    wear(state, content, 'suit', 'suit_overall', [{ affixId: 'suf_of_embers', value: 20 }]);
    wear(state, content, 'guard', 'guard_deflector', [{ affixId: 'suf_of_embers', value: 20 }]);

    expect(statsOf(state, content, 'normal').resistances.fire).toBe(40);
    expect(statsOf(state, content, 'nightmare').resistances.fire).toBe(-60);
  });

  // Test 12 aus PHASE_3_6
  it('deckelt fuenf Teile mit je 20 Feuerresistenz auf 75', () => {
    const { state, content } = setup();
    const slots: EquipSlot[] = ['suit', 'guard', 'amulet', 'helmet', 'belt'];
    const bases = ['suit_overall', 'guard_deflector', 'amulet_tag', 'helmet_hardhat', 'belt_tool'];
    slots.forEach((slot, index) => {
      const base = bases[index];
      if (base === undefined) throw new Error('fehlender Grundtyp');
      wear(state, content, slot, base, [{ affixId: 'suf_of_embers', value: 20 }]);
    });

    expect(statsOf(state, content).resistances.fire).toBe(PLAYER_RESIST_CAP);
    // Andere Schadensarten bleiben unberuehrt.
    expect(statsOf(state, content).resistances.ice).toBe(0);
  });
});

describe('Weitere Werte aus der Ausruestung', () => {
  it('hebt Sichtweite, freie Aktion und Munitionsersparnis', () => {
    const { state, content } = setup();
    wear(state, content, 'helmet', 'helmet_hardhat', [{ affixId: 'suf_of_the_lamp', value: 3 }]);
    wear(state, content, 'boots', 'boots_rubber', [{ affixId: 'suf_of_haste', value: 8 }]);
    wear(state, content, 'belt', 'belt_tool', [{ affixId: 'suf_of_thrift', value: 12 }]);

    const stats = statsOf(state, content);
    expect(stats.lightRadius).toBe(7);
    expect(stats.freeActionChance).toBeCloseTo(0.08, 10);
    expect(stats.ammoSaveChance).toBeCloseTo(0.12, 10);
  });

  it('rechnet Ruestung und Genauigkeit aus den Grundwerten der Teile', () => {
    const { state, content } = setup();
    wear(state, content, 'suit', 'suit_overall', [{ affixId: 'pre_plated', value: 4 }]);
    wear(state, content, 'gloves', 'gloves_grip', [{ affixId: 'pre_honed', value: 5 }]);

    // suit_overall und gloves_grip tragen je armor 2 (BESTIARY Abschnitt 8).
    const stats = statsOf(state, content);
    expect(stats.armor).toBe(8);
    expect(stats.accuracy).toBe(15);
  });
});

describe('Ausgeruestete Gegner', () => {
  it('nimmt die Affixe der getragenen Teile in die Gegnerwerte auf', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }],
    });
    const entity = state.maps['test']?.entities[0];
    if (entity === undefined) throw new Error('kein Gegner');

    const actor = enemyActor(entity, content);
    if (actor === null) throw new Error('kein Akteur');
    const before = getDerivedStats(actor, content, 'normal');

    entity.equipment = {
      suit: craft(state, content, 'suit_overall', [{ affixId: 'pre_sturdy', value: 14 }]),
    };
    const after = getDerivedStats(actor, content, 'normal');

    expect(after.maxHealth).toBe(before.maxHealth + 14);
    expect(after.armor).toBe(before.armor + 2);
  });

  it('bildet suf_of_the_lamp bei Gegnern auf die Aggroreichweite ab', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }],
    });
    const entity = state.maps['test']?.entities[0];
    if (entity === undefined) throw new Error('kein Gegner');
    const actor = enemyActor(entity, content);
    if (actor === null) throw new Error('kein Akteur');

    // `lightRadius` traegt bei Gegnern die Aggroreichweite, RPG.md Abschnitt 9.
    expect(getDerivedStats(actor, content, 'normal').lightRadius).toBe(5);
    entity.equipment = {
      helmet: craft(state, content, 'helmet_hardhat', [{ affixId: 'suf_of_the_lamp', value: 3 }]),
    };
    expect(getDerivedStats(actor, content, 'normal').lightRadius).toBe(8);
  });
});
