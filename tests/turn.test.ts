import { describe, expect, it } from 'vitest';
import { advanceRound, reapDead, tickEffects } from '../src/core/turn';
import { setup } from './fixtures/world';

describe('reapDead', () => {
  it('entfernt tote Gegner und laesst den Rest stehen', () => {
    const { state } = setup({
      entities: [
        { kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } },
        { kind: 'enemy', defId: 'grunt', pos: { x: 4, y: 1 } },
        { kind: 'door', defId: 'door', pos: { x: 5, y: 1 } },
      ],
    });
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    const first = mapState.entities[0];
    if (!first?.stats) throw new Error('missing enemy');
    first.stats.health = 0;

    expect(reapDead(mapState)).toEqual([1]);
    expect(mapState.entities.map((entity) => entity.id)).toEqual([2, 3]);
  });
});

describe('tickEffects', () => {
  it('zaehlt herunter und entfernt abgelaufene Effekte', () => {
    const { state } = setup();
    state.player.effects = [
      { id: 'haste', remainingTurns: 2, magnitude: 1 },
      { id: 'shieldUp', remainingTurns: 1, magnitude: 2 },
    ];
    const events = tickEffects(state);
    expect(state.player.effects).toEqual([{ id: 'haste', remainingTurns: 1, magnitude: 1 }]);
    expect(events).toEqual([{ type: 'message', text: 'shieldUp expired' }]);
  });
});

describe('advanceRound', () => {
  it('erhoeht den Rundenzaehler', () => {
    const { state, content } = setup();
    advanceRound(state, content);
    expect(state.turnCount).toBe(1);
  });

  it('gibt inaktiven Gegnern keine Aktionspunkte', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'sleeper', pos: { x: 5, y: 1 } }],
    });
    advanceRound(state, content);
    const enemy = state.maps['test']?.entities[0];
    expect(enemy?.active).toBe(false);
    expect(enemy?.actionPoints).toBe(0);
  });

  it('laesst speed 2.0 zweimal handeln', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'runner', pos: { x: 6, y: 1 } }],
    });
    advanceRound(state, content);
    const enemy = state.maps['test']?.entities[0];
    expect(enemy?.pos).toEqual({ x: 4, y: 1 });
    expect(enemy?.actionPoints).toBe(0);
  });

  it('laesst speed 0.5 nur in jeder zweiten Runde handeln', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'crawler', pos: { x: 6, y: 1 } }],
    });
    advanceRound(state, content);
    const enemy = state.maps['test']?.entities[0];
    expect(enemy?.pos).toEqual({ x: 6, y: 1 });
    expect(enemy?.actionPoints).toBeCloseTo(0.5, 10);

    advanceRound(state, content);
    expect(enemy?.pos).toEqual({ x: 5, y: 1 });
    expect(enemy?.actionPoints).toBeCloseTo(0, 10);
  });

  it('haelt die Reihenfolge des entities-Arrays ein', () => {
    const { state, content } = setup({
      entities: [
        { kind: 'enemy', defId: 'grunt', pos: { x: 6, y: 1 } },
        { kind: 'enemy', defId: 'grunt', pos: { x: 5, y: 1 } },
      ],
    });
    const events = advanceRound(state, content);
    const movers = events.filter((event) => event.type === 'moved').map((event) => event.who);
    expect(movers).toEqual([1, 2]);
  });

  it('meldet den Tod des Spielers und stoppt die Runde', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 2, y: 1 } }],
    });
    state.player.stats.health = 1;
    state.player.stats.evasion = -100;
    const events = advanceRound(state, content);
    expect(state.player.stats.health).toBe(0);
    expect(events[events.length - 1]).toEqual({ type: 'died', who: 'player' });
  });
});
