/**
 * Abgeleitete Werte nach RPG.md Abschnitt 2 und SPEC v1.2 Abschnitt 8.
 */
import { describe, expect, it } from 'vitest';
import {
  BASE_LIGHT_RADIUS,
  ENEMY_RESIST_CAP,
  PLAYER_RESIST_CAP,
  clampPlayerResistance,
  enemyActor,
  getDerivedStats,
  playerActor,
} from '../src/core/derived';
import { DAMAGE_TYPES } from '../src/core/types';
import { setup } from './fixtures/world';

describe('Spieler', () => {
  // Test 1 aus PHASE_3_5
  it('erreicht mit Startattributen von je 10 die alten Startwerte', () => {
    const { state, content } = setup();
    const stats = getDerivedStats(playerActor(state), content, 'normal');

    expect(stats.maxHealth).toBe(50);
    expect(stats.accuracy).toBe(10);
    expect(stats.evasion).toBe(5);
    expect(stats.armor).toBe(0);
    expect(stats.lightRadius).toBe(BASE_LIGHT_RADIUS);
  });

  it('rechnet die Formeln aus RPG.md Abschnitt 2', () => {
    const { state, content } = setup();
    state.player.attributes = { strength: 30, agility: 25, vitality: 40, focus: 60 };
    const stats = getDerivedStats(playerActor(state), content, 'normal');

    expect(stats.maxHealth).toBe(20 + 3 * 40);
    expect(stats.accuracy).toBe(Math.floor(4 + 0.6 * 25));
    expect(stats.evasion).toBe(Math.floor(1 + 0.4 * 25));
    expect(stats.meleeBonus).toBeCloseTo(0.01 * 20, 10);
    expect(stats.elemBonus).toBeCloseTo(0.01 * 50, 10);
    expect(stats.critBonus).toBeCloseTo(0.002 * 50, 10);
  });

  // Test 2 aus PHASE_3_5
  it('ist rein: zweimaliger Aufruf liefert dasselbe und mutiert nichts', () => {
    const { state, content } = setup();
    const before = JSON.stringify(state);

    const first = getDerivedStats(playerActor(state), content, 'normal');
    const second = getDerivedStats(playerActor(state), content, 'normal');

    expect(second).toEqual(first);
    expect(JSON.stringify(state)).toBe(before);

    // Das Ergebnis ist eine Kopie, kein geteilter Verweis.
    first.resistances.fire = 42;
    expect(getDerivedStats(playerActor(state), content, 'normal').resistances.fire).toBe(0);
  });

  it('hat ohne Ausruestung auf normal keine Resistenzen', () => {
    const { state, content } = setup();
    const stats = getDerivedStats(playerActor(state), content, 'normal');
    for (const type of DAMAGE_TYPES) expect(stats.resistances[type]).toBe(0);
  });

  // Test 7 aus PHASE_3_5
  it('liegt auf nightmare ohne Ausruestung bei minus 100', () => {
    const { state, content } = setup({ difficulty: 'nightmare' });
    const stats = getDerivedStats(playerActor(state), content, 'nightmare');
    for (const type of DAMAGE_TYPES) expect(stats.resistances[type]).toBe(-100);
  });

  it('liegt auf hard bei minus 40', () => {
    const { state, content } = setup({ difficulty: 'hard' });
    const stats = getDerivedStats(playerActor(state), content, 'hard');
    expect(stats.resistances.fire).toBe(-40);
  });

  // Test 6 aus PHASE_3_5
  it('deckelt die Resistenz bei 75, auch bei hoeherem Beitrag', () => {
    // Ausruestung traegt in dieser Phase noch nichts bei, deshalb wird die
    // Deckelung an der Funktion selbst geprueft. Ab Phase 3.6 greift sie
    // ueber getDerivedStats.
    expect(PLAYER_RESIST_CAP).toBe(75);
    expect(clampPlayerResistance(90)).toBe(75);
    expect(clampPlayerResistance(75)).toBe(75);
    expect(clampPlayerResistance(10)).toBe(10);
    // Nach unten ist sie unbegrenzt.
    expect(clampPlayerResistance(-250)).toBe(-250);
  });

  it('senkt maxHealth und Ruestung bei drain', () => {
    const { state, content } = setup();
    const before = getDerivedStats(playerActor(state), content, 'normal');
    state.player.effects.push({
      id: 'drain',
      remainingTurns: 5,
      magnitude: 15,
      sourceType: 'void',
    });
    const after = getDerivedStats(playerActor(state), content, 'normal');

    expect(after.maxHealth).toBe(Math.round(before.maxHealth * 0.85));
    expect(after.armor).toBe(before.armor - 3);
  });

  it('senkt die Genauigkeit bei jolt', () => {
    const { state, content } = setup();
    const before = getDerivedStats(playerActor(state), content, 'normal').accuracy;
    state.player.effects.push({
      id: 'jolt',
      remainingTurns: 3,
      magnitude: 8,
      sourceType: 'shock',
    });
    expect(getDerivedStats(playerActor(state), content, 'normal').accuracy).toBe(before - 8);
  });
});

describe('Gegner', () => {
  function firstEnemy(difficulty: 'normal' | 'hard' | 'nightmare' = 'normal') {
    const world = setup({
      difficulty,
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }],
    });
    const entity = world.state.maps['test']?.entities[0];
    if (entity === undefined) throw new Error('missing enemy');
    const actor = enemyActor(entity, world.content);
    if (actor === null) throw new Error('missing actor');
    return { ...world, entity, actor };
  }

  it('skaliert nach SPEC Abschnitt 8', () => {
    const { actor, content, entity } = firstEnemy();
    const level = entity.monsterLevel ?? 0;
    const stats = getDerivedStats(actor, content, 'normal');

    expect(level).toBeGreaterThan(0);
    expect(stats.maxHealth).toBe(Math.round(10 * (1 + 0.045 * (level - 1))));
    expect(stats.accuracy).toBe(5 + Math.floor(level * 0.8));
    expect(stats.evasion).toBe(0 + Math.floor(level / 3));
    expect(stats.armor).toBe(0 + Math.floor(level / 6));
  });

  it('bekommt auf hoeheren Graden mehr Leben und Resistenz', () => {
    const normal = firstEnemy('normal');
    const nightmare = firstEnemy('nightmare');

    const a = getDerivedStats(normal.actor, normal.content, 'normal');
    const b = getDerivedStats(nightmare.actor, nightmare.content, 'nightmare');
    expect(b.maxHealth).toBeGreaterThan(a.maxHealth);
    expect(b.resistances.fire).toBe(50);
  });

  it('deckelt die Gegnerresistenz nach oben', () => {
    const world = setup({
      difficulty: 'nightmare',
      entities: [{ kind: 'enemy', defId: 'fireproof', pos: { x: 3, y: 1 } }],
    });
    const entity = world.state.maps['test']?.entities[0];
    if (entity === undefined) throw new Error('missing enemy');
    const actor = enemyActor(entity, world.content);
    if (actor === null) throw new Error('missing actor');

    // 60 aus der Definition plus 50 vom Grad waeren 110.
    expect(getDerivedStats(actor, world.content, 'nightmare').resistances.fire).toBe(
      ENEMY_RESIST_CAP
    );
  });

  it('bildet die Sichtweite auf aggroRange ab', () => {
    const { actor, content } = firstEnemy();
    expect(getDerivedStats(actor, content, 'normal').lightRadius).toBe(5);
  });
});
