/**
 * Charakterbogen und Fertigkeitenbaum, PHASE_4_5 Bloecke 5 und 6.
 */
import { describe, expect, it } from 'vitest';
import { getDerivedStats, playerActor } from '../src/core/derived';
import { createInstance,
  takeItemUid } from '../src/core/items';
import { deserialize, serialize } from '../src/core/state';
import {
  assignableSkills,
  nextPointPreview,
  skillNodeState,
  skillbarAssignment,
  skillbarSlots,
  statBreakdown,
  treeNodes,
} from '../src/ui/progressModel';
import { skillbarKey } from '../src/core/skillActions';
import type { ContentDb, GameState } from '../src/core/types';
import { setup } from './fixtures/world';

function learn(state: GameState, skillId: string, points: number): void {
  state.player.skills[skillId] = points;
}

function skillOf(content: ContentDb, id: string) {
  const def = content.skills[id];
  if (def === undefined) throw new Error(`keine Fertigkeit ${id}`);
  return def;
}

describe('skillNodeState', () => {
  // Test 7 aus PHASE_4_5
  it('meldet breach auf Stufe 5 gesperrt wegen reqLevel', () => {
    const { state, content } = setup();
    state.player.level = 5;
    learn(state, 'precise_strike', 2);

    expect(skillNodeState(state, skillOf(content, 'breach'), content)).toEqual({
      state: 'blocked',
      points: 0,
      maxPoints: 5,
      reason: 'reqLevel',
      needed: 6,
    });
  });

  // Test 8 aus PHASE_4_5
  it('meldet breach auf Stufe 6 mit einem Punkt gesperrt wegen reqPointsInTree', () => {
    const { state, content } = setup();
    state.player.level = 6;
    learn(state, 'precise_strike', 1);

    expect(skillNodeState(state, skillOf(content, 'breach'), content)).toEqual({
      state: 'blocked',
      points: 0,
      maxPoints: 5,
      reason: 'reqPointsInTree',
      needed: 2,
    });
  });

  it('gibt breach frei, sobald Stufe und Punkte reichen', () => {
    const { state, content } = setup();
    state.player.level = 6;
    learn(state, 'precise_strike', 2);

    expect(skillNodeState(state, skillOf(content, 'breach'), content)).toEqual({
      state: 'available',
      points: 0,
      maxPoints: 5,
    });
  });

  it('unterscheidet voll gelernt von gesperrtem Baum', () => {
    const { state, content } = setup();
    state.player.level = 20;
    learn(state, 'precise_strike', 5);

    expect(skillNodeState(state, skillOf(content, 'precise_strike'), content).state).toBe('maxed');
    expect(skillNodeState(state, skillOf(content, 'thick_skin'), content).state).toBe('locked');
    // Auch mit Punkten bleibt ein gesperrter Baum gesperrt.
    learn(state, 'thick_skin', 3);
    expect(skillNodeState(state, skillOf(content, 'thick_skin'), content).state).toBe('locked');
  });
});

describe('nextPointPreview', () => {
  // Test 9 aus PHASE_4_5
  it('liefert fuer precise_strike bei drei Punkten die Werte 9 und 12', () => {
    const { content } = setup();
    expect(nextPointPreview(skillOf(content, 'precise_strike'), 3)).toEqual({
      stat: 'accuracy',
      now: 9,
      next: 12,
    });
  });

  it('liefert null fuer Fertigkeiten ohne modifiers', () => {
    const { content } = setup();
    expect(nextPointPreview(skillOf(content, 'breach'), 2)).toBeNull();
    expect(nextPointPreview(skillOf(content, 'execution'), 0)).toBeNull();
  });
});

describe('statBreakdown', () => {
  // Test 10 aus PHASE_4_5, der wichtigste
  it('summiert Basis, Ausruestung und Fertigkeiten genau zum Wert aus getDerivedStats', () => {
    const { state, content } = setup();
    state.player.attributes.agility = 26;
    learn(state, 'precise_strike', 3);

    const gloves = createInstance(
      takeItemUid(state),
      'gloves_grip',
      20,
      'rare',
      [{ affixId: 'pre_honed', value: 6 }],
      content
    );
    if (gloves === null) throw new Error('kein Grundtyp');
    state.player.equipment['gloves'] = gloves;

    const breakdown = statBreakdown(state, content, 'accuracy');
    const actual = getDerivedStats(playerActor(state), content, state.difficulty).accuracy;

    expect(breakdown.total).toBe(actual);
    expect(breakdown.base + breakdown.equipment + breakdown.skills).toBeCloseTo(actual, 10);
    // Drei Punkte in precise_strike bringen 9 Genauigkeit.
    expect(breakdown.skills).toBe(9);
    // pre_honed 6 aus dem Affix, dazu kein Grundwert auf accuracy.
    expect(breakdown.equipment).toBe(6);
  });

  it('geht fuer jeden Wert aus DerivedStats auf', () => {
    const { state, content } = setup();
    state.player.attributes = { strength: 22, agility: 18, vitality: 30, focus: 24 };
    learn(state, 'heavy_hand', 2);
    learn(state, 'steady_aim', 3);

    const suit = createInstance(
      takeItemUid(state),
      'suit_overall',
      20,
      'rare',
      [{ affixId: 'suf_of_vigor', value: 25 }],
      content
    );
    if (suit === null) throw new Error('kein Grundtyp');
    state.player.equipment['suit'] = suit;

    const stats = getDerivedStats(playerActor(state), content, state.difficulty);
    for (const stat of ['maxHealth', 'armor', 'accuracy', 'evasion', 'meleeBonus', 'critBonus']) {
      const breakdown = statBreakdown(state, content, stat);
      expect(breakdown.base + breakdown.equipment + breakdown.skills).toBeCloseTo(
        (stats as unknown as Record<string, number>)[stat] ?? 0,
        10
      );
    }
  });
});

describe('treeNodes', () => {
  it('sortiert einen Baum nach Stufe und Id', () => {
    const { content } = setup();
    const gear = treeNodes(content, 'tree_gear');

    expect(gear.map((def) => def.id)).toEqual([
      'heavy_hand',
      'precise_strike',
      'breach',
      'steady_aim',
      'execution',
      'sweep',
    ]);
    expect(treeNodes(content, 'tree_endure').every((def) => def.locked)).toBe(true);
  });
});

describe('Fertigkeitsleiste', () => {
  it('kennt nur aktive, nicht gesperrte Fertigkeiten', () => {
    const { content } = setup();
    expect(assignableSkills(content).map((def) => def.id)).toEqual(['breach', 'sweep']);
  });

  // Test 12 aus PHASE_4_5
  it('ueberlebt Serialisieren und Deserialisieren', () => {
    const { state, content } = setup();
    state.flags[skillbarKey(2)] = 'sweep';

    const restored = deserialize(serialize(state));

    expect(skillbarAssignment(restored, content, 2)?.id).toBe('sweep');
    expect(skillbarSlots(restored, content).map((def) => def?.id ?? null)).toEqual([
      null,
      null,
      'sweep',
      null,
      null,
      null,
    ]);
  });

  it('liefert null fuer leere und fuer ungueltige Plaetze', () => {
    const { state, content } = setup();
    expect(skillbarAssignment(state, content, 0)).toBeNull();

    state.flags[skillbarKey(0)] = 'gibtsnicht';
    expect(skillbarAssignment(state, content, 0)).toBeNull();
    // Zahl und Wahrheitswert sind keine Belegung; alte Staende laufen so
    // folgenlos ins Leere.
    state.flags[skillbarKey(1)] = 3;
    expect(skillbarAssignment(state, content, 1)).toBeNull();
    state.flags[skillbarKey(3)] = true;
    expect(skillbarAssignment(state, content, 3)).toBeNull();
  });
});
