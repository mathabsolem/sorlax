import { describe, expect, it } from 'vitest';
import { grantXp, xpToNextLevel } from '../src/core/progression';
import { setup } from './fixtures/world';

const PROGRESSION = { xpThresholds: [10, 30, 60] };

describe('xpToNextLevel', () => {
  it('liest die Schwelle zur naechsten Stufe', () => {
    expect(xpToNextLevel(1, PROGRESSION)).toBe(10);
    expect(xpToNextLevel(3, PROGRESSION)).toBe(60);
  });

  it('liefert Infinity auf der Hoechststufe', () => {
    expect(xpToNextLevel(4, PROGRESSION)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('grantXp', () => {
  it('ignoriert nicht positive Betraege', () => {
    const { state } = setup();
    expect(grantXp(state.player, 0, PROGRESSION)).toEqual([]);
    expect(state.player.xp).toBe(0);
  });

  it('steigt auf und wendet die Zuwaechse aus SPEC 6 an', () => {
    const { state } = setup();
    state.player.stats.health = 5;
    const events = grantXp(state.player, 10, PROGRESSION);

    expect(events).toEqual([{ type: 'levelUp', newLevel: 2 }]);
    expect(state.player.level).toBe(2);
    expect(state.player.stats.maxHealth).toBe(60);
    expect(state.player.stats.accuracy).toBe(12);
    expect(state.player.stats.evasion).toBe(6);
    expect(state.player.stats.armor).toBe(1); // Stufe 2 ist gerade
    expect(state.player.stats.health).toBe(60); // voll aufgefuellt
  });

  it('steigt bei genug XP mehrfach auf', () => {
    const { state } = setup();
    const events = grantXp(state.player, 60, PROGRESSION);
    expect(events.map((event) => (event.type === 'levelUp' ? event.newLevel : 0))).toEqual([
      2, 3, 4,
    ]);
    expect(state.player.level).toBe(4);
    expect(state.player.stats.armor).toBe(2); // nur Stufe 2 und 4
  });

  it('steigt unterhalb der Schwelle nicht auf', () => {
    const { state } = setup();
    expect(grantXp(state.player, 9, PROGRESSION)).toEqual([]);
    expect(state.player.level).toBe(1);
    expect(state.player.xp).toBe(9);
  });
});
