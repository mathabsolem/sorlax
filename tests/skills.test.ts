/**
 * Fertigkeitsbaum, passive Wirkung und aktive Fertigkeiten,
 * PHASE_3_7 Bloecke 2 bis 5.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { getDerivedStats, playerActor } from '../src/core/derived';
import { spendSkillPointAction } from '../src/core/skillActions';
import {
  MAX_SKILL_POINTS,
  addSkillPoint,
  pointsInTree,
  skillPointBlocker,
  skillPoints,
} from '../src/core/skills/rules';
import { collectSkillModifiers, flatOf, mergeModifiers, percentOf } from '../src/core/modifiers';
import { invalidatePlayerDerived } from '../src/core/turn';
import type { ContentDb, GameState } from '../src/core/types';
import { setup } from './fixtures/world';

/** Verteilt Punkte ohne die Vorbedingungen zu pruefen. */
function learn(state: GameState, skillId: string, points: number): void {
  state.player.skills[skillId] = points;
  invalidatePlayerDerived(state);
}

function statsOf(state: GameState, content: ContentDb) {
  return getDerivedStats(playerActor(state), content, state.difficulty);
}

describe('spendSkillPoint', () => {
  // Test 1 aus PHASE_3_7
  it('lehnt breach ohne zwei Punkte in Stufe 1 ab', () => {
    const { state, content } = setup();
    state.player.level = 20;
    state.player.unspentSkillPoints = 5;

    expect(applyCommand(state, { type: 'spendSkillPoint', skillId: 'breach' }, content)).toEqual([
      { type: 'invalid', reason: 'requires 2 points in tree_gear' },
    ]);
    expect(skillPoints(state.player, 'breach')).toBe(0);

    // Mit zwei Punkten in Stufe 1 geht es.
    learn(state, 'precise_strike', 2);
    expect(spendSkillPointAction(state, content, 'breach').ok).toBe(true);
    expect(skillPoints(state.player, 'breach')).toBe(1);
  });

  // Test 2 aus PHASE_3_7
  it('lehnt gesperrte Fertigkeiten ab', () => {
    const { state, content } = setup();
    state.player.level = 20;
    state.player.unspentSkillPoints = 5;

    expect(
      applyCommand(state, { type: 'spendSkillPoint', skillId: 'thick_skin' }, content)
    ).toEqual([{ type: 'invalid', reason: 'skill is locked: thick_skin' }]);
    expect(state.player.skills['thick_skin']).toBeUndefined();
  });

  // Test 3 aus PHASE_3_7
  it('lehnt den sechsten Punkt auf dieselbe Fertigkeit ab', () => {
    const { state, content } = setup();
    state.player.level = 20;
    state.player.unspentSkillPoints = 10;

    for (let index = 0; index < 5; index++) {
      expect(spendSkillPointAction(state, content, 'precise_strike').ok).toBe(true);
    }
    expect(spendSkillPointAction(state, content, 'precise_strike')).toEqual({
      ok: false,
      reason: 'already at 5 points',
    });
    expect(skillPoints(state.player, 'precise_strike')).toBe(5);
  });

  it('prueft Stufe, offene Punkte und unbekannte Fertigkeiten', () => {
    const { state, content } = setup();
    state.player.unspentSkillPoints = 1;

    expect(spendSkillPointAction(state, content, 'nixgibts')).toEqual({
      ok: false,
      reason: 'unknown skill: nixgibts',
    });
    learn(state, 'precise_strike', 2);
    expect(spendSkillPointAction(state, content, 'breach')).toEqual({
      ok: false,
      reason: 'requires level 6',
    });

    state.player.level = 20;
    state.player.unspentSkillPoints = 0;
    expect(spendSkillPointAction(state, content, 'breach')).toEqual({
      ok: false,
      reason: 'no skill point available',
    });
  });

  it('kostet keine Runde', () => {
    const { state, content } = setup();
    state.player.unspentSkillPoints = 1;
    applyCommand(state, { type: 'spendSkillPoint', skillId: 'precise_strike' }, content);
    expect(state.turnCount).toBe(0);
  });

  it('pointsInTree zaehlt die Fertigkeit selbst nicht mit', () => {
    const { state, content } = setup();
    learn(state, 'precise_strike', 3);
    learn(state, 'heavy_hand', 2);

    expect(pointsInTree(state.player, 'tree_gear', content)).toBe(5);
    expect(pointsInTree(state.player, 'tree_gear', content, 'heavy_hand')).toBe(3);
    expect(pointsInTree(state.player, 'tree_endure', content)).toBe(0);
  });
});

describe('passive Fertigkeiten', () => {
  // Test 4 aus PHASE_3_7
  it('drei Punkte in precise_strike heben accuracy um genau 9', () => {
    const { state, content } = setup();
    const before = statsOf(state, content).accuracy;

    learn(state, 'precise_strike', 3);

    expect(statsOf(state, content).accuracy).toBe(before + 9);
  });

  // Test 5 aus PHASE_3_7
  it('zwei Punkte in heavy_hand ergeben meleeBonus 0.08', () => {
    const { state, content } = setup();
    expect(statsOf(state, content).meleeBonus).toBeCloseTo(0, 10);

    learn(state, 'heavy_hand', 2);

    expect(statsOf(state, content).meleeBonus).toBeCloseTo(0.08, 10);
  });

  it('steady_aim zaehlt in Prozentpunkten auf critBonus', () => {
    const { state, content } = setup();
    learn(state, 'steady_aim', 3);
    expect(statsOf(state, content).critBonus).toBeCloseTo(0.06, 10);
  });

  it('gesperrte Baeume tragen auch mit Punkten nichts bei', () => {
    const { state, content } = setup();
    const before = statsOf(state, content).armor;
    learn(state, 'thick_skin', 5);
    expect(statsOf(state, content).armor).toBe(before);
  });
});

describe('Bausteine der Punktevergabe', () => {
  it('skillPointBlocker nennt den Grund und null wenn alles passt', () => {
    const { state, content } = setup();
    const def = content.skills['breach'];
    if (def === undefined) throw new Error('kein breach');

    expect(skillPointBlocker(state.player, def, content)).toBe('no skill point available');
    state.player.unspentSkillPoints = 2;
    expect(skillPointBlocker(state.player, def, content)).toBe('requires level 6');
    state.player.level = 10;
    expect(skillPointBlocker(state.player, def, content)).toBe('requires 2 points in tree_gear');
    learn(state, 'precise_strike', 2);
    expect(skillPointBlocker(state.player, def, content)).toBeNull();
  });

  it('addSkillPoint erhoeht die Punkte und verbraucht einen offenen', () => {
    const { state } = setup();
    state.player.unspentSkillPoints = 2;

    addSkillPoint(state.player, 'precise_strike');
    expect(state.player.skills['precise_strike']).toBe(1);
    expect(state.player.unspentSkillPoints).toBe(1);

    addSkillPoint(state.player, 'precise_strike');
    expect(state.player.skills['precise_strike']).toBe(2);
    expect(MAX_SKILL_POINTS).toBe(5);
  });
});

describe('collectSkillModifiers', () => {
  it('multipliziert perPoint mit der Punktzahl', () => {
    const { state, content } = setup();
    learn(state, 'precise_strike', 3);
    learn(state, 'heavy_hand', 2);

    const sums = collectSkillModifiers(state.player.skills, content);
    expect(flatOf(sums, 'accuracy')).toBe(9);
    expect(percentOf(sums, 'meleeBonus')).toBe(8);
  });

  it('ueberspringt gesperrte, unbekannte und leere Eintraege', () => {
    const { state, content } = setup();
    state.player.skills = { thick_skin: 5, gibtsnicht: 3, precise_strike: 0 };

    const sums = collectSkillModifiers(state.player.skills, content);
    expect(sums.flat).toEqual({});
    expect(sums.percent).toEqual({});
  });

  it('mergeModifiers fasst zwei Summen zusammen, ohne sie zu veraendern', () => {
    const first = { flat: { accuracy: 3 }, percent: { meleeBonus: 4 } };
    const second = { flat: { accuracy: 2, armor: 5 }, percent: { meleeBonus: 4 } };

    const merged = mergeModifiers(first, second);

    expect(flatOf(merged, 'accuracy')).toBe(5);
    expect(flatOf(merged, 'armor')).toBe(5);
    expect(percentOf(merged, 'meleeBonus')).toBe(8);
    expect(first.flat.accuracy).toBe(3);
    expect(second.flat.armor).toBe(5);
  });
});
