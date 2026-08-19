import { describe, expect, it } from 'vitest';
import {
  ATTRIBUTE_POINTS_PER_LEVEL,
  MAX_PLAYER_LEVEL,
  SKILL_POINTS_PER_LEVEL,
  grantXp,
  spendAttributePoint,
  xpToNextLevel,
} from '../src/core/progression';
import { setup } from './fixtures/world';

import { TEST_XP_THRESHOLDS } from './fixtures/world';

const PROGRESSION = { xpThresholds: [...TEST_XP_THRESHOLDS] };

describe('xpToNextLevel', () => {
  it('liest die Schwelle zur naechsten Stufe', () => {
    expect(xpToNextLevel(1, PROGRESSION)).toBe(10);
    expect(xpToNextLevel(3, PROGRESSION)).toBe(60);
  });

  it('liefert Infinity auf der Hoechststufe', () => {
    expect(xpToNextLevel(MAX_PLAYER_LEVEL, PROGRESSION)).toBe(Number.POSITIVE_INFINITY);
    expect(MAX_PLAYER_LEVEL).toBe(60);
  });
});

describe('grantXp', () => {
  it('ignoriert nicht positive Betraege', () => {
    const { state } = setup();
    expect(grantXp(state.player, 0, PROGRESSION)).toEqual([]);
    expect(state.player.xp).toBe(0);
  });

  it('steigt auf und vergibt Punkte statt fester Werte', () => {
    const { state } = setup();
    const events = grantXp(state.player, 10, PROGRESSION);

    expect(events).toEqual([{ type: 'levelUp', newLevel: 2 }]);
    expect(state.player.level).toBe(2);
    expect(state.player.unspentAttributePoints).toBe(ATTRIBUTE_POINTS_PER_LEVEL);
    expect(state.player.unspentSkillPoints).toBe(SKILL_POINTS_PER_LEVEL);
    // Die Attribute selbst aendern sich erst durch spendAttribute.
    expect(state.player.attributes).toEqual({
      strength: 10,
      agility: 10,
      vitality: 10,
      focus: 10,
    });
  });

  it('steigt bei genug XP mehrfach auf', () => {
    const { state } = setup();
    const events = grantXp(state.player, 60, PROGRESSION);
    expect(events.map((event) => (event.type === 'levelUp' ? event.newLevel : 0))).toEqual([
      2, 3, 4,
    ]);
    expect(state.player.level).toBe(4);
    expect(state.player.unspentAttributePoints).toBe(3 * ATTRIBUTE_POINTS_PER_LEVEL);
  });

  it('steigt unterhalb der Schwelle nicht auf', () => {
    const { state } = setup();
    expect(grantXp(state.player, 9, PROGRESSION)).toEqual([]);
    expect(state.player.level).toBe(1);
    expect(state.player.xp).toBe(9);
  });
});

describe('spendAttributePoint', () => {
  it('verteilt einen Punkt und zieht ihn ab', () => {
    const { state } = setup();
    state.player.unspentAttributePoints = 2;
    expect(spendAttributePoint(state.player, 'vitality')).toBe(true);
    expect(state.player.attributes.vitality).toBe(11);
    expect(state.player.unspentAttributePoints).toBe(1);
  });

  it('lehnt ohne offene Punkte ab', () => {
    const { state } = setup();
    expect(spendAttributePoint(state.player, 'focus')).toBe(false);
    expect(state.player.attributes.focus).toBe(10);
  });

  it('lehnt am Attributmaximum ab', () => {
    const { state } = setup();
    state.player.unspentAttributePoints = 1;
    state.player.attributes.strength = 300;
    expect(spendAttributePoint(state.player, 'strength')).toBe(false);
  });
});
