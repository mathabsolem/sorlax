import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { equippedWeapon } from '../src/core/items';
import { serialize } from '../src/core/state';
import { equipWeapon, giveWeapon, makeMap, setup } from './fixtures/world';

const EAST_SPAWN = { pos: { x: 1, y: 1 }, facing: 1 } as const;

describe('applyCommand', () => {
  it('dreht ohne Rundenkosten', () => {
    const { state, content } = setup();
    const events = applyCommand(state, { type: 'turn', dir: 'cw' }, content);
    expect(events).toEqual([{ type: 'turned', who: 'player', facing: 1 }]);
    expect(state.turnCount).toBe(0);

    applyCommand(state, { type: 'turn', dir: 'ccw' }, content);
    expect(state.player.facing).toBe(0);
    expect(state.turnCount).toBe(0);
  });

  it('wechselt die Waffe ohne Rundenkosten', () => {
    const { state, content } = setup();
    giveWeapon(state, content, 'pistol');

    applyCommand(state, { type: 'switchWeapon', weaponId: 'pistol' }, content);

    expect(equippedWeapon(state, content)?.id).toBe('pistol');
    expect(state.turnCount).toBe(0);
  });

  it('liefert bei ungueltigem Kommando genau ein invalid-Event', () => {
    const { state, content } = setup();
    const before = serialize(state);
    const events = applyCommand(state, { type: 'move', dir: 'forward' }, content);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'invalid', reason: 'blocked by wall' });
    expect(serialize(state)).toBe(before);
  });

  it('warten kostet eine Runde', () => {
    const { state, content } = setup();
    applyCommand(state, { type: 'wait' }, content);
    expect(state.turnCount).toBe(1);
  });

  it('sammelt beim Betreten ein Item ein', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      entities: [{ kind: 'item', defId: 'medkit', pos: { x: 2, y: 1 } }],
    });
    const events = applyCommand(state, { type: 'move', dir: 'forward' }, content);
    expect(events.some((event) => event.type === 'pickup')).toBe(true);
    expect(state.player.consumables['medkit']).toBe(20);
  });

  it('feuert enter-Trigger nach der Bewegung und vor der Gegnerrunde', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      triggers: [
        {
          id: 'trap',
          pos: { x: 2, y: 1 },
          on: 'enter',
          once: true,
          actions: [{ type: 'message', text: 'snap' }],
        },
      ],
    });
    const events = applyCommand(state, { type: 'move', dir: 'forward' }, content);
    const moveIndex = events.findIndex((event) => event.type === 'moved');
    const triggerIndex = events.findIndex(
      (event) => event.type === 'message' && event.text === 'snap'
    );
    expect(moveIndex).toBeGreaterThanOrEqual(0);
    expect(triggerIndex).toBeGreaterThan(moveIndex);
    expect(state.turnCount).toBe(1);
  });

  it('wechselt die Karte beim Betreten eines Ausgangs', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      exits: [{ pos: { x: 2, y: 1 }, targetMapId: 'level2' }],
      extraMaps: [makeMap({ id: 'level2', spawn: { pos: { x: 6, y: 6 }, facing: 3 } })],
    });
    const events = applyCommand(state, { type: 'move', dir: 'forward' }, content);
    expect(events[events.length - 1]).toEqual({ type: 'mapChange', mapId: 'level2' });
    expect(state.currentMapId).toBe('level2');
    expect(state.player.pos).toEqual({ x: 6, y: 6 });
    expect(state.player.facing).toBe(3);
    expect(state.maps['level2']?.visited).toBe(true);
  });

  it('lehnt einen Angriff ohne Munition ab, ohne eine Runde zu verbrauchen', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'tank', pos: { x: 3, y: 1 } }],
    });
    equipWeapon(state, content, 'pistol');
    const events = applyCommand(state, { type: 'attack' }, content);
    expect(events).toEqual([{ type: 'invalid', reason: 'out of ammo' }]);
    expect(state.turnCount).toBe(0);
  });

  it('interact oeffnet eine Tuer und kostet eine Runde', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      entities: [{ kind: 'door', defId: 'door', pos: { x: 2, y: 1 } }],
    });
    const events = applyCommand(state, { type: 'interact' }, content);
    expect(events[0]).toMatchObject({ type: 'doorChanged', state: 'open' });
    expect(state.turnCount).toBe(1);
  });

  it('useItem heilt und kostet eine Runde', () => {
    const { state, content } = setup();
    state.player.consumables['medkit'] = 1;
    state.player.health = 10;
    applyCommand(state, { type: 'useConsumable', itemId: 'medkit' }, content);
    expect(state.player.health).toBe(30);
    expect(state.turnCount).toBe(1);
  });

  it('meldet den Tod des Spielers und laesst die Gegnerrunde aus', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      triggers: [
        {
          id: 'spikes',
          pos: { x: 2, y: 1 },
          on: 'enter',
          once: false,
          actions: [{ type: 'damage', amount: 999 }],
        },
      ],
    });
    const events = applyCommand(state, { type: 'move', dir: 'forward' }, content);
    expect(events[events.length - 1]).toEqual({ type: 'died', who: 'player' });
    expect(state.player.health).toBe(0);
    expect(state.turnCount).toBe(0);
  });

  it('nimmt nach dem Tod keine Kommandos mehr an', () => {
    const { state, content } = setup();
    state.player.health = 0;
    expect(applyCommand(state, { type: 'wait' }, content)).toEqual([
      { type: 'invalid', reason: 'player is dead' },
    ]);
  });

  it('schreibt Ereignisse in das Log', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      entities: [{ kind: 'item', defId: 'medkit', pos: { x: 2, y: 1 } }],
    });
    applyCommand(state, { type: 'move', dir: 'forward' }, content);
    expect(state.log.some((entry) => entry.kind === 'pickup')).toBe(true);
  });
});
