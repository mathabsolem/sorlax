/**
 * Gegnerlevel und Stufenskalierung nach SPEC v1.2 Abschnitt 8.
 */
import { describe, expect, it } from 'vitest';
import { enemyActor, getDerivedStats } from '../src/core/derived';
import { grantXp } from '../src/core/progression';
import {
  MONSTER_LEVEL_HEADROOM,
  depthBaseLevel,
  monsterLevelFor,
  scaleWeapon,
  scaledHealth,
  scaledXpReward,
} from '../src/core/scaling';
import { WEAPONS, setup } from './fixtures/world';

describe('depthBaseLevel', () => {
  it('folgt der Formel und dem Gradversatz', () => {
    expect(depthBaseLevel(1, 'normal')).toBe(2);
    expect(depthBaseLevel(10, 'normal')).toBe(16);
    expect(depthBaseLevel(10, 'hard')).toBe(16 + 18);
    expect(depthBaseLevel(10, 'nightmare')).toBe(16 + 36);
  });
});

describe('monsterLevelFor', () => {
  it('faellt nie unter die Basis der Sohle', () => {
    expect(monsterLevelFor(10, 'normal', 1)).toBe(16);
  });

  it('waechst mit dem Spieler', () => {
    expect(monsterLevelFor(10, 'normal', 19)).toBe(19);
  });

  it('waechst hoechstens sechs Stufen ueber die Basis hinaus', () => {
    expect(monsterLevelFor(10, 'normal', 60)).toBe(16 + MONSTER_LEVEL_HEADROOM);
    expect(MONSTER_LEVEL_HEADROOM).toBe(6);
  });
});

describe('Skalierung', () => {
  it('erhoeht Leben mit Stufe und Grad', () => {
    const world = setup();
    const def = world.content.enemies['grunt'];
    if (def === undefined) throw new Error('missing grunt');

    expect(scaledHealth(def, 1, 'normal')).toBe(10);
    expect(scaledHealth(def, 21, 'normal')).toBe(Math.round(10 * (1 + 0.045 * 20)));
    expect(scaledHealth(def, 1, 'nightmare')).toBe(32);
  });

  it('erhoeht den Waffenschaden mit Stufe und Grad', () => {
    const fists = WEAPONS['fists'];
    if (fists === undefined) throw new Error('missing fists');

    expect(scaleWeapon(fists, 1, 'normal')).toMatchObject({ dmgMin: 2, dmgMax: 4 });
    const scaled = scaleWeapon(fists, 11, 'hard');
    expect(scaled.dmgMin).toBe(Math.round(2 * 1.3 * 1.6));
    expect(scaled.dmgMax).toBe(Math.round(4 * 1.3 * 1.6));
    // Die Kopie laesst die Vorlage unangetastet.
    expect(fists.dmgMin).toBe(2);
  });

  it('erhoeht den XP-Ertrag mit Stufe und Grad', () => {
    const world = setup();
    const def = world.content.enemies['grunt'];
    if (def === undefined) throw new Error('missing grunt');

    expect(scaledXpReward(def, 1, 'normal')).toBe(10);
    expect(scaledXpReward(def, 11, 'normal')).toBe(20);
    expect(scaledXpReward(def, 1, 'hard')).toBe(20);
  });
});

describe('Festgeschriebenes Gegnerlevel', () => {
  // Test 12 aus PHASE_3_5
  it('aendert sich nicht, wenn der Spieler nach dem Betreten aufsteigt', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }],
    });
    const entity = state.maps['test']?.entities[0];
    if (entity === undefined) throw new Error('missing enemy');

    const before = entity.monsterLevel;
    const actor = enemyActor(entity, content);
    if (actor === null) throw new Error('missing actor');
    const statsBefore = getDerivedStats(actor, content, state.difficulty);

    // Der Spieler steigt mehrere Stufen auf.
    grantXp(state.player, 100000, content.progression);
    expect(state.player.level).toBeGreaterThan(5);

    expect(entity.monsterLevel).toBe(before);
    const after = enemyActor(entity, content);
    if (after === null) throw new Error('missing actor');
    expect(getDerivedStats(after, content, state.difficulty)).toEqual(statsBefore);
  });

  it('wird beim ersten Betreten aus der Sohlentiefe bestimmt', () => {
    const deep = setup({
      depth: 10,
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }],
    });
    expect(deep.state.maps['test']?.entities[0]?.monsterLevel).toBe(
      monsterLevelFor(10, 'normal', 1)
    );
  });
});
