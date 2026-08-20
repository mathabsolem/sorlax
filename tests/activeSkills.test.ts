/**
 * execution und die aktiven Fertigkeiten, PHASE_3_7 Bloecke 3 und 5.
 * Aus skills.test.ts herausgeloest.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { createInstance } from '../src/core/items';
import { useSkillAction } from '../src/core/skillActions';
import { SKILL_REGISTRY } from '../src/core/skills/registry';
import { breachHandler } from '../src/core/skills/breach';
import { sweepHandler } from '../src/core/skills/sweep';
import {
  BREACH_BASE,
  BREACH_PER_POINT,
  EXECUTION_BASE,
  EXECUTION_PER_POINT,
  SWEEP_BASE,
  SWEEP_PER_POINT,
  breachPierce,
  executionBonus,
  sweepFactor,
} from '../src/core/skills/rules';
import { EXECUTION_THRESHOLD, isExecutable } from '../src/core/combat';
import { invalidatePlayerDerived, playerDerived } from '../src/core/turn';
import type { GameState } from '../src/core/types';
import { setup } from './fixtures/world';

/** Verteilt Punkte ohne die Vorbedingungen zu pruefen. */
function learn(state: GameState, skillId: string, points: number): void {
  state.player.skills[skillId] = points;
  invalidatePlayerDerived(state);
}

describe('Zahlen aus RPG.md Abschnitt 5', () => {
  it('rechnet die Zuschlaege aus Grundwert und Punkten', () => {
    expect(EXECUTION_BASE).toBe(20);
    expect(EXECUTION_PER_POINT).toBe(5);
    expect(BREACH_BASE).toBe(40);
    expect(BREACH_PER_POINT).toBe(8);
    expect(SWEEP_BASE).toBe(70);
    expect(SWEEP_PER_POINT).toBe(6);

    expect(breachPierce(1)).toBeCloseTo(0.48, 10);
    // Der Anteil ist bei 1 gedeckelt, mehr als die ganze Ruestung geht nicht.
    expect(breachPierce(20)).toBe(1);
    expect(sweepFactor(0)).toBeCloseTo(0.7, 10);
  });

  it('isExecutable prueft die Schwelle von 30 Prozent', () => {
    const side = (health: number) => ({
      ref: 'player' as const,
      stats: { maxHealth: 100 } as never,
      vitals: { health },
    });
    expect(EXECUTION_THRESHOLD).toBe(0.3);
    expect(isExecutable(side(29))).toBe(true);
    expect(isExecutable(side(30))).toBe(false);
    expect(isExecutable({ ...side(1), stats: { maxHealth: 0 } as never })).toBe(false);
  });
});

describe('execution', () => {
  // Test 6 aus PHASE_3_7
  it('wirkt nur unter 30 Prozent Leben des Ziels', () => {
    const build = (health: number) => {
      const { state, content } = setup({
        seed: 5,
        spawn: { pos: { x: 1, y: 1 }, facing: 1 },
        entities: [{ kind: 'enemy', defId: 'tank', pos: { x: 2, y: 1 } }],
      });
      // Genauigkeit hoch, damit der Treffer sicher sitzt.
      state.player.attributes.agility = 200;
      const enemy = state.maps['test']?.entities[0];
      if (enemy === undefined) throw new Error('kein Gegner');
      enemy.health = health;
      return { state, content, enemy };
    };

    const maxHealth = build(999).enemy.health ?? 0;

    // Bei vollem Leben ohne und mit execution derselbe Schaden.
    const healthy = build(maxHealth);
    const healthyBefore = healthy.enemy.health ?? 0;
    applyCommand(healthy.state, { type: 'attack' }, healthy.content);
    const plain = healthyBefore - (healthy.enemy.health ?? 0);

    const healthySkilled = build(maxHealth);
    learn(healthySkilled.state, 'execution', 5);
    const skilledBefore = healthySkilled.enemy.health ?? 0;
    applyCommand(healthySkilled.state, { type: 'attack' }, healthySkilled.content);
    expect(skilledBefore - (healthySkilled.enemy.health ?? 0)).toBe(plain);

    // Unter 30 Prozent schlaegt der Zuschlag durch.
    const low = Math.floor(maxHealth * 0.2);
    const wounded = build(low);
    applyCommand(wounded.state, { type: 'attack' }, wounded.content);
    const woundedPlain = low - (wounded.enemy.health ?? 0);

    const woundedSkilled = build(low);
    learn(woundedSkilled.state, 'execution', 5);
    applyCommand(woundedSkilled.state, { type: 'attack' }, woundedSkilled.content);
    const woundedBonus = low - (woundedSkilled.enemy.health ?? 0);

    expect(woundedBonus).toBeGreaterThan(woundedPlain);
  });

  it('executionBonus rechnet 20 plus 5 je Punkt', () => {
    const { state, content } = setup();
    expect(executionBonus(state.player, content)).toBe(0);
    learn(state, 'execution', 4);
    expect(executionBonus(state.player, content)).toBeCloseTo(0.4, 10);
  });
});

describe('useSkill', () => {
  function battle(seed = 3) {
    const world = setup({
      seed,
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
      entities: [{ kind: 'enemy', defId: 'tank', pos: { x: 2, y: 1 } }],
    });
    world.state.player.level = 20;
    return world;
  }

  // Test 7 aus PHASE_3_7
  it('breach setzt die Abklingzeit und kostet genau eine Runde', () => {
    const { state, content } = battle();
    learn(state, 'breach', 3);

    const events = applyCommand(state, { type: 'useSkill', skillId: 'breach' }, content);

    expect(events[0]).toEqual({ type: 'skillUsed', skillId: 'breach', by: 'player' });
    expect(events.some((event) => event.type === 'attack')).toBe(true);
    expect(state.turnCount).toBe(1);
    // Gesetzt wird 4, die Runde danach senkt tickCooldowns auf 3.
    expect(state.player.cooldowns['breach']).toBe(3);
  });

  // Test 8 aus PHASE_3_7
  it('lehnt waehrend der Abklingzeit ab und kostet keine Runde', () => {
    const { state, content } = battle();
    learn(state, 'breach', 3);
    applyCommand(state, { type: 'useSkill', skillId: 'breach' }, content);

    const turnsBefore = state.turnCount;
    const events = applyCommand(state, { type: 'useSkill', skillId: 'breach' }, content);

    expect(events).toEqual([{ type: 'invalid', reason: 'skill on cooldown: breach' }]);
    expect(state.turnCount).toBe(turnsBefore);
  });

  it('lehnt ungelernte, passive und gesperrte Fertigkeiten ab', () => {
    const { state, content } = battle();

    expect(useSkillAction(state, content, 'breach', undefined)).toEqual({
      ok: false,
      reason: 'skill not learned: breach',
    });
    learn(state, 'precise_strike', 2);
    expect(useSkillAction(state, content, 'precise_strike', undefined)).toEqual({
      ok: false,
      reason: 'skill is passive: precise_strike',
    });
    learn(state, 'last_stand', 2);
    expect(useSkillAction(state, content, 'last_stand', undefined)).toEqual({
      ok: false,
      reason: 'skill is locked: last_stand',
    });
  });

  it('breach ignoriert einen Teil der Ruestung', () => {
    // Gleicher Seed, gleiche Wuerfe: der Unterschied kommt allein aus der
    // durchschlagenen Ruestung.
    const armoured = () => {
      const world = setup({
        seed: 11,
        spawn: { pos: { x: 1, y: 1 }, facing: 1 },
        entities: [{ kind: 'enemy', defId: 'tank', pos: { x: 2, y: 1 } }],
      });
      world.state.player.level = 20;
      world.state.player.attributes.agility = 200;
      world.state.player.attributes.strength = 200;

      const enemy = world.state.maps['test']?.entities[0];
      if (enemy === undefined) throw new Error('kein Gegner');
      const plate = createInstance(
        world.state,
        'suit_overall',
        20,
        'rare',
        [{ affixId: 'pre_reinforced', value: 10 }],
        world.content
      );
      if (plate === null) throw new Error('kein Grundtyp');
      enemy.equipment = { suit: plate };
      return { ...world, enemy };
    };

    const plain = armoured();
    const plainBefore = plain.enemy.health ?? 0;
    applyCommand(plain.state, { type: 'attack' }, plain.content);
    const normal = plainBefore - (plain.enemy.health ?? 0);

    const pierced = armoured();
    learn(pierced.state, 'breach', 5);
    const piercedBefore = pierced.enemy.health ?? 0;
    applyCommand(pierced.state, { type: 'useSkill', skillId: 'breach' }, pierced.content);
    const withBreach = piercedBefore - (pierced.enemy.health ?? 0);

    expect(breachPierce(5)).toBeCloseTo(0.8, 10);
    expect(withBreach).toBeGreaterThan(normal);
  });

  // Test 9 aus PHASE_3_7
  it('sweep trifft drei Gegner in Distanz 1 und keinen in Distanz 2', () => {
    const { state, content } = setup({
      seed: 9,
      spawn: { pos: { x: 3, y: 3 }, facing: 1 },
      entities: [
        { kind: 'enemy', defId: 'tank', pos: { x: 2, y: 3 } },
        { kind: 'enemy', defId: 'tank', pos: { x: 4, y: 3 } },
        { kind: 'enemy', defId: 'tank', pos: { x: 3, y: 4 } },
        { kind: 'enemy', defId: 'tank', pos: { x: 5, y: 3 } },
      ],
    });
    state.player.level = 20;
    state.player.attributes.agility = 200;
    learn(state, 'sweep', 2);

    const events = applyCommand(state, { type: 'useSkill', skillId: 'sweep' }, content);
    // Nur die Schlaege des Spielers; danach kommt die Gegnerrunde.
    const targets = events
      .filter((event) => event.type === 'attack' && event.attacker === 'player')
      .map((event) => (event.type === 'attack' ? event.target : null));

    expect(targets).toEqual([1, 2, 3]);
    expect(targets).not.toContain(4);
    expect(sweepFactor(2)).toBeCloseTo(0.82, 10);
  });

  it('sweep ohne Gegner in Reichweite kostet keine Runde', () => {
    const { state, content } = setup();
    state.player.level = 20;
    learn(state, 'sweep', 2);

    expect(applyCommand(state, { type: 'useSkill', skillId: 'sweep' }, content)).toEqual([
      { type: 'invalid', reason: 'no target' },
    ]);
    expect(state.turnCount).toBe(0);
    expect(state.player.cooldowns['sweep']).toBeUndefined();
  });

  it('die Registry kennt genau die beiden aktiven Fertigkeiten', () => {
    expect(Object.keys(SKILL_REGISTRY).sort()).toEqual(['breach', 'sweep']);
    expect(SKILL_REGISTRY['breach']).toBe(breachHandler);
    expect(SKILL_REGISTRY['sweep']).toBe(sweepHandler);
  });

  it('die Handler melden einen abgelehnten Angriff, statt ihn zu verschlucken', () => {
    const { state, content } = setup();
    const breach = content.skills['breach'];
    const sweep = content.skills['sweep'];
    if (breach === undefined || sweep === undefined) throw new Error('keine Definition');

    // Kein Gegner in Reichweite: beide Handler liefern `invalid`.
    expect(breachHandler(state, breach, 1, undefined, content)).toEqual([
      { type: 'invalid', reason: 'no target' },
    ]);
    expect(sweepHandler(state, sweep, 1, undefined, content)).toEqual([
      { type: 'invalid', reason: 'no target' },
    ]);
  });

  it('senkt die Abklingzeit Runde fuer Runde bis auf null', () => {
    const { state, content } = battle();
    learn(state, 'breach', 1);
    applyCommand(state, { type: 'useSkill', skillId: 'breach' }, content);
    expect(state.player.cooldowns['breach']).toBe(3);

    for (let round = 0; round < 3; round++) {
      applyCommand(state, { type: 'wait' }, content);
    }
    expect(state.player.cooldowns['breach']).toBeUndefined();
    expect(playerDerived(state, content)).toBeDefined();
  });
});
