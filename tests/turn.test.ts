import { describe, expect, it } from 'vitest';
import {
  advanceRound,
  hasDeath,
  invalidatePlayerDerived,
  playerDerived,
  reapDead,
  rollFreeAction,
  tickCooldowns,
} from '../src/core/turn';
import { tickEffects } from '../src/core/effects';
import { createInstance } from '../src/core/items';
import { setup } from './fixtures/world';

describe('reapDead', () => {
  it('entfernt tote Gegner und laesst den Rest stehen', () => {
    const { state, content } = setup({
      entities: [
        { kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } },
        { kind: 'enemy', defId: 'grunt', pos: { x: 4, y: 1 } },
        { kind: 'door', defId: 'door', pos: { x: 5, y: 1 } },
      ],
    });
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    const first = mapState.entities[0];
    if (first === undefined) throw new Error('missing enemy');
    first.health = 0;

    expect(reapDead(state, mapState, content)).toEqual([]);
    expect(mapState.entities.map((entity) => entity.id)).toEqual([2, 3]);
  });
});

describe('tickEffects', () => {
  it('zaehlt herunter und entfernt abgelaufene Effekte', () => {
    const { state, content } = setup();
    state.player.effects = [
      { id: 'toxin', remainingTurns: 2, magnitude: 2, sourceType: 'poison' },
      { id: 'jolt', remainingTurns: 1, magnitude: 8, sourceType: 'shock' },
    ];
    const events = tickEffects(state, content);

    expect(state.player.effects).toEqual([
      { id: 'toxin', remainingTurns: 1, magnitude: 2, sourceType: 'poison' },
    ]);
    expect(events).toContainEqual({ type: 'effectExpired', who: 'player', effectId: 'jolt' });
    expect(events).toContainEqual({
      type: 'effectTick',
      who: 'player',
      effectId: 'toxin',
      damage: 2,
    });
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
    const events = advanceRound(state, content) ?? [];
    const movers = events.filter((event) => event.type === 'moved').map((event) => event.who);
    expect(movers).toEqual([1, 2]);
  });

  it('meldet den Tod des Spielers und stoppt die Runde', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 2, y: 1 } }],
    });
    state.player.health = 1;
    state.player.attributes.agility = 0;
    // Die Trefferchance ist auf 0.95 gedeckelt, ein einzelner Angriff kann also
    // danebengehen. Deshalb wird gerundet, bis der Spieler faellt.
    let fatal: ReturnType<typeof advanceRound> = null;
    for (let round = 0; round < 20 && state.player.health > 0; round++) {
      fatal = advanceRound(state, content);
    }

    expect(state.player.health).toBe(0);
    expect(fatal).not.toBeNull();
    expect(fatal?.[fatal.length - 1]).toEqual({ type: 'died', who: 'player' });
    expect(fatal?.filter((event) => event.type === 'died')).toHaveLength(1);
  });
});

describe('tickCooldowns', () => {
  it('senkt jede Abklingzeit um 1 und entfernt abgelaufene', () => {
    const { state } = setup();
    state.player.cooldowns = { breach: 3, sweep: 1 };
    tickCooldowns(state);
    expect(state.player.cooldowns).toEqual({ breach: 2 });
  });
});

describe('Rundencache der abgeleiteten Werte', () => {
  it('liefert innerhalb einer Runde dasselbe Objekt', () => {
    const { state, content } = setup();
    const first = playerDerived(state, content);
    expect(playerDerived(state, content)).toBe(first);
  });

  it('rechnet nach dem Verwerfen neu', () => {
    const { state, content } = setup();
    const first = playerDerived(state, content);
    state.player.attributes.vitality = 20;
    // Ohne Verwerfen bleibt der alte Wert stehen, das ist der Sinn des Caches.
    expect(playerDerived(state, content)).toBe(first);

    invalidatePlayerDerived(state);
    expect(playerDerived(state, content).maxHealth).toBe(80);
  });

  it('rechnet in der naechsten Runde neu', () => {
    const { state, content } = setup();
    playerDerived(state, content);
    state.player.attributes.vitality = 20;
    advanceRound(state, content);
    expect(playerDerived(state, content).maxHealth).toBe(80);
  });
});

describe('rollFreeAction', () => {
  it('ist ohne Chance immer falsch und verbraucht keinen Wurf', () => {
    const { state, content } = setup();
    const before = [...state.rngState];
    expect(rollFreeAction(state, content)).toBe(false);
    expect([...state.rngState]).toEqual(before);
  });
});

describe('hasDeath', () => {
  it('findet nur den Tod des gefragten Akteurs', () => {
    const events = [
      { type: 'died' as const, who: 3 },
      { type: 'message' as const, text: 'x' },
    ];
    expect(hasDeath(events, 3)).toBe(true);
    expect(hasDeath(events, 'player')).toBe(false);
    expect(hasDeath([], 'player')).toBe(false);
  });

  it('verhindert ein doppeltes died fuer den Spieler', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 2, y: 1 } }],
    });
    state.player.health = 1;
    state.player.attributes.agility = 0;

    let fatal: ReturnType<typeof advanceRound> = null;
    for (let round = 0; round < 20 && state.player.health > 0; round++) {
      fatal = advanceRound(state, content);
    }
    expect(fatal?.filter((event) => event.type === 'died')).toHaveLength(1);
  });
});

describe('freie Aktion mit Ausruestung', () => {
  it('laesst bei voller Chance die Runde ganz entfallen', () => {
    const { state, content } = setup();
    const boots = createInstance(
      state,
      'boots_tread',
      20,
      'rare',
      [{ affixId: 'suf_of_haste', value: 100 }],
      content
    );
    if (boots === null) throw new Error('kein Grundtyp');
    state.player.equipment['boots'] = boots;
    invalidatePlayerDerived(state);
    expect(playerDerived(state, content).freeActionChance).toBe(1);

    expect(rollFreeAction(state, content)).toBe(true);
    expect(advanceRound(state, content)).toBeNull();
    expect(state.turnCount).toBe(0);
  });

  it('verbraucht bei einer Chance ueber 0 einen Wurf', () => {
    const { state, content } = setup();
    const boots = createInstance(
      state,
      'boots_tread',
      20,
      'rare',
      [{ affixId: 'suf_of_haste', value: 50 }],
      content
    );
    if (boots === null) throw new Error('kein Grundtyp');
    state.player.equipment['boots'] = boots;
    invalidatePlayerDerived(state);

    const before = [...state.rngState];
    rollFreeAction(state, content);
    expect([...state.rngState]).not.toEqual(before);
  });
});
