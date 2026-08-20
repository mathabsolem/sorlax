/**
 * Die sieben Integrationstests aus docs/PHASE_2.md.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { deserialize, serialize } from '../src/core/state';
import { setup } from './fixtures/world';
import type { Command } from '../src/core/types';

const EAST_SPAWN = { pos: { x: 1, y: 1 }, facing: 1 } as const;

const SCRIPT: Command[] = [
  { type: 'move', dir: 'forward' },
  { type: 'turn', dir: 'cw' },
  { type: 'move', dir: 'forward' },
  { type: 'attack' },
  { type: 'wait' },
  { type: 'move', dir: 'back' },
  { type: 'attack' },
  { type: 'wait' },
];

describe('1. Determinismus', () => {
  it('gleicher Seed und gleiche Kommandofolge ergeben dieselbe Serialisierung', () => {
    const run = () => {
      const { state, content } = setup({
        seed: 99,
        spawn: EAST_SPAWN,
        entities: [
          { kind: 'enemy', defId: 'grunt', pos: { x: 4, y: 1 } },
          { kind: 'enemy', defId: 'sniper', pos: { x: 6, y: 3 } },
        ],
      });
      for (const cmd of SCRIPT) applyCommand(state, cmd, content);
      return serialize(state);
    };
    expect(run()).toBe(run());
  });

  // Test 17 aus PHASE_3_6: der Determinismustest bleibt gruen, auch wenn
  // Ausruestung gewuerfelt und fallen gelassen wird.
  it('bleibt auch mit gewuerfelter Gegnerausruestung reproduzierbar', () => {
    const run = () => {
      const { state, content } = setup({
        seed: 99,
        loot: true,
        spawn: EAST_SPAWN,
        entities: [
          { kind: 'enemy', defId: 'grunt', pos: { x: 4, y: 1 }, forceRank: 'equipped' },
          { kind: 'enemy', defId: 'sniper', pos: { x: 6, y: 3 }, forceRank: 'boss' },
        ],
      });
      for (const cmd of SCRIPT) applyCommand(state, cmd, content);
      return serialize(state);
    };
    expect(run()).toBe(run());
  });

  it('unterschiedliche Seeds ergeben unterschiedliche Verlaeufe', () => {
    const run = (seed: number) => {
      const { state, content } = setup({
        seed,
        spawn: EAST_SPAWN,
        entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 4, y: 1 } }],
      });
      for (const cmd of SCRIPT) applyCommand(state, cmd, content);
      return serialize(state);
    };
    expect(run(1)).not.toBe(run(2));
  });
});

describe('2. Rundreise durch die Serialisierung', () => {
  it('serialize gefolgt von deserialize liefert denselben Zustand', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      entities: [
        { kind: 'enemy', defId: 'grunt', pos: { x: 4, y: 1 } },
        { kind: 'door', defId: 'door', pos: { x: 6, y: 3 }, locked: 'redkey' },
        { kind: 'item', defId: 'medkit', pos: { x: 2, y: 1 } },
      ],
    });
    for (const cmd of SCRIPT) applyCommand(state, cmd, content);

    const restored = deserialize(serialize(state));
    expect(restored).toEqual(state);
    expect(serialize(restored)).toBe(serialize(state));
  });

  it('setzt das Spiel aus dem geladenen Zustand identisch fort', () => {
    const build = () => {
      const world = setup({
        seed: 7,
        spawn: EAST_SPAWN,
        entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 5, y: 1 } }],
      });
      applyCommand(world.state, { type: 'move', dir: 'forward' }, world.content);
      return world;
    };

    const direct = build();
    const loaded = build();
    loaded.state = deserialize(serialize(loaded.state));

    for (const cmd of SCRIPT) {
      applyCommand(direct.state, cmd, direct.content);
      applyCommand(loaded.state, cmd, loaded.content);
    }
    expect(serialize(loaded.state)).toBe(serialize(direct.state));
  });
});

describe('3. Zeitkosten', () => {
  it('Drehen kostet keine Runde, ein Schritt genau eine', () => {
    const { state, content } = setup({ spawn: EAST_SPAWN });
    applyCommand(state, { type: 'turn', dir: 'cw' }, content);
    applyCommand(state, { type: 'turn', dir: 'ccw' }, content);
    expect(state.turnCount).toBe(0);

    applyCommand(state, { type: 'move', dir: 'forward' }, content);
    expect(state.turnCount).toBe(1);
    applyCommand(state, { type: 'move', dir: 'forward' }, content);
    expect(state.turnCount).toBe(2);
  });
});

describe('4. Aktionspunkte', () => {
  it('speed 2.0 handelt zweimal pro Runde', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'runner', pos: { x: 6, y: 1 } }],
    });
    applyCommand(state, { type: 'wait' }, content);
    expect(state.maps['test']?.entities[0]?.pos).toEqual({ x: 4, y: 1 });
  });

  it('speed 0.5 handelt in jeder zweiten Runde', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'crawler', pos: { x: 6, y: 1 } }],
    });
    const enemy = state.maps['test']?.entities[0];

    applyCommand(state, { type: 'wait' }, content);
    expect(enemy?.pos).toEqual({ x: 6, y: 1 });

    applyCommand(state, { type: 'wait' }, content);
    expect(enemy?.pos).toEqual({ x: 5, y: 1 });

    applyCommand(state, { type: 'wait' }, content);
    expect(enemy?.pos).toEqual({ x: 5, y: 1 });

    applyCommand(state, { type: 'wait' }, content);
    expect(enemy?.pos).toEqual({ x: 4, y: 1 });
  });
});

describe('5. Schritt gegen eine Wand', () => {
  it('liefert invalid und aendert den Zustand nicht', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 5, y: 1 } }],
    });
    const before = serialize(state);
    const events = applyCommand(state, { type: 'move', dir: 'forward' }, content);

    expect(events).toEqual([{ type: 'invalid', reason: 'blocked by wall' }]);
    expect(serialize(state)).toBe(before);
    expect(state.turnCount).toBe(0);
  });
});

describe('6. Verriegelte Tuer', () => {
  it('meldet ohne Schluessel blocked und bleibt verriegelt', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      entities: [{ kind: 'door', defId: 'door', pos: { x: 2, y: 1 }, locked: 'redkey' }],
    });
    const events = applyCommand(state, { type: 'interact' }, content);
    expect(events[0]).toEqual({ type: 'doorChanged', pos: { x: 2, y: 1 }, state: 'blocked' });
    expect(state.maps['test']?.entities[0]?.state).toBe('locked');
    expect(applyCommand(state, { type: 'move', dir: 'forward' }, content)).toEqual([
      { type: 'invalid', reason: 'door is closed' },
    ]);
  });

  it('oeffnet mit passendem Schluessel und laesst den Spieler durch', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      entities: [
        { kind: 'item', defId: 'redkey', pos: { x: 1, y: 2 } },
        { kind: 'door', defId: 'door', pos: { x: 2, y: 1 }, locked: 'redkey' },
      ],
    });
    state.player.keys.push('redkey');

    const events = applyCommand(state, { type: 'interact' }, content);
    expect(events[0]).toEqual({ type: 'doorChanged', pos: { x: 2, y: 1 }, state: 'open' });
    expect(state.maps['test']?.openedDoors).toEqual(['2,1']);

    applyCommand(state, { type: 'move', dir: 'forward' }, content);
    expect(state.player.pos).toEqual({ x: 2, y: 1 });
  });
});

describe('7. Gegner ausserhalb der aggroRange', () => {
  it('bleibt inaktiv und verbraucht keine Aktionspunkte', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'sleeper', pos: { x: 6, y: 1 } }],
    });
    const enemy = state.maps['test']?.entities[0];
    const startPos = { ...(enemy?.pos ?? { x: 0, y: 0 }) };

    for (let i = 0; i < 5; i++) applyCommand(state, { type: 'wait' }, content);

    expect(enemy?.active).toBe(false);
    expect(enemy?.actionPoints).toBe(0);
    expect(enemy?.pos).toEqual(startPos);
    expect(state.player.health).toBe(50);
  });
});

describe('8. Kommandos aus INTERFACES v1.2', () => {
  it('verteilt Attributpunkte ohne Rundenkosten', () => {
    const { state, content } = setup();
    state.player.unspentAttributePoints = 1;

    const events = applyCommand(state, { type: 'spendAttribute', attr: 'vitality' }, content);
    expect(events.some((event) => event.type === 'invalid')).toBe(false);
    expect(state.player.attributes.vitality).toBe(11);
    expect(state.turnCount).toBe(0);
  });

  it('lehnt das Verteilen ohne offene Punkte ab', () => {
    const { state, content } = setup();
    expect(applyCommand(state, { type: 'spendAttribute', attr: 'focus' }, content)).toEqual([
      { type: 'invalid', reason: 'no attribute point available' },
    ]);
  });

  it('meldet die noch nicht umgesetzten Kommandos ausdruecklich', () => {
    const { state, content } = setup();
    // Ausruestung ist seit Phase 3.6 umgesetzt, Fertigkeiten kommen in 3.7.
    const pending: Command[] = [
      { type: 'useSkill', skillId: 'breach' },
      { type: 'spendSkillPoint', skillId: 'breach' },
    ];
    for (const cmd of pending) {
      expect(applyCommand(state, cmd, content)).toEqual([
        { type: 'invalid', reason: 'not implemented' },
      ]);
    }
    expect(state.turnCount).toBe(0);
  });

  it('lehnt Ausruestungskommandos ohne passenden Gegenstand ab', () => {
    const { state, content } = setup();
    const rejected: Command[] = [
      { type: 'equip', uid: 1 },
      { type: 'dropItem', uid: 1 },
    ];
    for (const cmd of rejected) {
      expect(applyCommand(state, cmd, content)).toEqual([
        { type: 'invalid', reason: 'unknown item' },
      ]);
    }
    expect(applyCommand(state, { type: 'unequip', slot: 'weapon' }, content)).toEqual([
      { type: 'invalid', reason: 'slot is empty' },
    ]);
    expect(state.turnCount).toBe(0);
  });

  it('benutzt ein Verbrauchsgut und kostet dafuer eine Runde', () => {
    const { state, content } = setup();
    state.player.consumables['medkit'] = 1;
    state.player.health = 10;

    applyCommand(state, { type: 'useConsumable', itemId: 'medkit' }, content);
    expect(state.player.health).toBe(30);
    expect(state.turnCount).toBe(1);
  });
});
