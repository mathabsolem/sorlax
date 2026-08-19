/**
 * Statuseffekte nach SPEC v1.2 Abschnitt 4.5.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { enemyActor, playerActor } from '../src/core/derived';
import { EFFECT_DEFS, EFFECT_ORDER } from '../src/core/effectDefs';
import { applyEffect, applyEffectDefault, hasChill, tickEffects } from '../src/core/effects';
import { advanceRound } from '../src/core/turn';
import { setup } from './fixtures/world';
import type { GameState } from '../src/core/types';

function burnOnPlayer(state: GameState, content: ReturnType<typeof setup>['content']) {
  return applyEffectDefault(playerActor(state), 'burn', content, state.difficulty);
}

describe('applyEffect', () => {
  it('legt den Effekt mit Dauer aus der Tabelle an', () => {
    const { state, content } = setup();
    const events = burnOnPlayer(state, content);

    expect(events).toEqual([
      { type: 'effectApplied', who: 'player', effectId: 'burn', turns: 3 },
    ]);
    expect(state.player.effects).toEqual([
      { id: 'burn', remainingTurns: 3, magnitude: 4, sourceType: 'fire' },
    ]);
  });

  // Test 9 aus PHASE_3_5
  it('erneuert die Dauer, stapelt aber nicht', () => {
    const { state, content } = setup();
    burnOnPlayer(state, content);
    tickEffects(state, content);
    expect(state.player.effects[0]?.remainingTurns).toBe(2);

    burnOnPlayer(state, content);
    expect(state.player.effects).toHaveLength(1);
    expect(state.player.effects[0]?.remainingTurns).toBe(3);
  });

  // Test 10 aus PHASE_3_5
  it('greift nicht bei 50 oder mehr Resistenz gegen das Element', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'fireproof', pos: { x: 3, y: 1 } }],
    });
    const entity = state.maps['test']?.entities[0];
    if (entity === undefined) throw new Error('missing enemy');
    const actor = enemyActor(entity, content);
    if (actor === null) throw new Error('missing actor');

    // fireproof hat 60 Feuerresistenz.
    expect(applyEffectDefault(actor, 'burn', content, state.difficulty)).toEqual([]);
    expect(entity.effects).toEqual([]);

    // Gegen ein anderes Element greift er weiterhin.
    expect(applyEffectDefault(actor, 'toxin', content, state.difficulty)).toHaveLength(1);
  });

  it('ignoriert unbekannte Effekt-Ids', () => {
    const { state, content } = setup();
    expect(applyEffect(playerActor(state), 'haste', 'fire', 1, content, 'normal')).toEqual([]);
    expect(state.player.effects).toEqual([]);
  });
});

describe('tickEffects', () => {
  // Test 8 aus PHASE_3_5
  it('fuegt burn dreimal Schaden zu und laeuft dann ab', () => {
    const { state, content } = setup();
    const start = state.player.health;
    burnOnPlayer(state, content);

    const ticks: number[] = [];
    let expired = 0;
    for (let round = 0; round < 5; round++) {
      for (const event of tickEffects(state, content)) {
        if (event.type === 'effectTick' && event.effectId === 'burn') ticks.push(event.damage);
        if (event.type === 'effectExpired' && event.effectId === 'burn') expired += 1;
      }
    }

    expect(ticks).toEqual([4, 4, 4]);
    expect(expired).toBe(1);
    expect(state.player.health).toBe(start - 12);
    expect(state.player.effects).toEqual([]);
  });

  it('ignoriert Ruestung bei burn und toxin', () => {
    const { state, content } = setup();
    state.player.effects.push({
      id: 'toxin',
      remainingTurns: 6,
      magnitude: 2,
      sourceType: 'poison',
    });
    const start = state.player.health;
    tickEffects(state, content);
    expect(state.player.health).toBe(start - 2);
  });

  it('haelt die Reihenfolge aus SPEC 4.5 ein', () => {
    expect([...EFFECT_ORDER]).toEqual(['burn', 'toxin', 'drain', 'chill', 'jolt']);

    const { state, content } = setup();
    for (const id of ['jolt', 'toxin', 'burn'] as const) {
      const def = EFFECT_DEFS[id];
      state.player.effects.push({
        id,
        remainingTurns: def.turns,
        magnitude: def.magnitude,
        sourceType: def.sourceType,
      });
    }

    const order = tickEffects(state, content)
      .filter((event) => event.type === 'effectTick')
      .map((event) => (event.type === 'effectTick' ? event.effectId : ''));
    expect(order).toEqual(['burn', 'toxin']);
  });

  it('senkt health mit, wenn drain maxHealth unter den Stand drueckt', () => {
    const { state, content } = setup();
    expect(state.player.health).toBe(50);
    state.player.effects.push({
      id: 'drain',
      remainingTurns: 5,
      magnitude: 15,
      sourceType: 'void',
    });
    tickEffects(state, content);
    // maxHealth faellt auf round(50 * 0.85) = 43
    expect(state.player.health).toBe(43);
  });

  it('meldet den Tod eines Gegners durch Effektschaden', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }],
    });
    const entity = state.maps['test']?.entities[0];
    if (entity === undefined) throw new Error('missing enemy');
    const actor = enemyActor(entity, content);
    if (actor === null) throw new Error('missing actor');

    applyEffectDefault(actor, 'burn', content, state.difficulty);
    entity.health = 1;
    const events = tickEffects(state, content);
    expect(events).toContainEqual({ type: 'died', who: entity.id });
  });
});

describe('chill', () => {
  it('hasChill erkennt nur laufende Effekte', () => {
    expect(hasChill([{ id: 'chill', remainingTurns: 2, magnitude: 2, sourceType: 'ice' }])).toBe(
      true
    );
    expect(hasChill([{ id: 'chill', remainingTurns: 0, magnitude: 2, sourceType: 'ice' }])).toBe(
      false
    );
    expect(hasChill([])).toBe(false);
  });

  // Test 11 aus PHASE_3_5
  it('laesst einen Gegner mit speed 1.0 zweimal handeln, wenn der Spieler friert', () => {
    const withoutChill = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 6, y: 1 } }],
    });
    advanceRound(withoutChill.state, withoutChill.content);
    expect(withoutChill.state.maps['test']?.entities[0]?.pos).toEqual({ x: 5, y: 1 });

    const withChill = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 6, y: 1 } }],
    });
    withChill.state.player.effects.push({
      id: 'chill',
      remainingTurns: 4,
      magnitude: 2,
      sourceType: 'ice',
    });
    advanceRound(withChill.state, withChill.content);
    expect(withChill.state.maps['test']?.entities[0]?.pos).toEqual({ x: 4, y: 1 });
  });

  it('wirkt auch ueber applyCommand', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 6, y: 1 } }],
    });
    state.player.effects.push({
      id: 'chill',
      remainingTurns: 4,
      magnitude: 2,
      sourceType: 'ice',
    });
    applyCommand(state, { type: 'wait' }, content);
    expect(state.maps['test']?.entities[0]?.pos).toEqual({ x: 4, y: 1 });
  });
});
