import { describe, expect, it } from 'vitest';
import { fireTriggers, hasUsableTrigger } from '../src/core/triggers';
import { setup } from './fixtures/world';

describe('fireTriggers', () => {
  it('feuert nur passende Kachel und passendes Ereignis', () => {
    const { state, content } = setup({
      triggers: [
        {
          id: 't1',
          pos: { x: 2, y: 1 },
          on: 'enter',
          once: false,
          actions: [{ type: 'message', text: 'hello' }],
        },
      ],
    });
    expect(fireTriggers(state, content, { x: 2, y: 1 }, 'use')).toEqual([]);
    expect(fireTriggers(state, content, { x: 3, y: 1 }, 'enter')).toEqual([]);
    expect(fireTriggers(state, content, { x: 2, y: 1 }, 'enter')).toEqual([
      { type: 'message', text: 'hello' },
    ]);
  });

  it('feuert once-Trigger genau einmal und merkt sie sich', () => {
    const { state, content } = setup({
      triggers: [
        {
          id: 'once',
          pos: { x: 2, y: 1 },
          on: 'enter',
          once: true,
          actions: [{ type: 'setFlag', key: 'seen', value: true }],
        },
      ],
    });
    fireTriggers(state, content, { x: 2, y: 1 }, 'enter');
    expect(state.flags['seen']).toBe(true);
    expect(state.maps['test']?.firedTriggers).toEqual(['once']);

    state.flags['seen'] = false;
    fireTriggers(state, content, { x: 2, y: 1 }, 'enter');
    expect(state.flags['seen']).toBe(false);
  });

  it('oeffnet Tueren und meldet das nur beim ersten Mal', () => {
    const { state, content } = setup({
      entities: [{ kind: 'door', defId: 'door', pos: { x: 4, y: 1 } }],
      triggers: [
        {
          id: 'switch',
          pos: { x: 2, y: 1 },
          on: 'use',
          once: false,
          actions: [{ type: 'openDoor', pos: { x: 4, y: 1 } }],
        },
      ],
    });
    expect(fireTriggers(state, content, { x: 2, y: 1 }, 'use')).toEqual([
      { type: 'doorChanged', pos: { x: 4, y: 1 }, state: 'open' },
    ]);
    expect(state.maps['test']?.openedDoors).toEqual(['4,1']);
    expect(fireTriggers(state, content, { x: 2, y: 1 }, 'use')).toEqual([]);
  });

  it('spawnt Gegner mit fortlaufender Id', () => {
    const { state, content } = setup({
      triggers: [
        {
          id: 'ambush',
          pos: { x: 2, y: 1 },
          on: 'enter',
          once: true,
          actions: [{ type: 'spawn', defId: 'grunt', pos: { x: 5, y: 1 } }],
        },
      ],
    });
    fireTriggers(state, content, { x: 2, y: 1 }, 'enter');
    const mapState = state.maps['test'];
    expect(mapState?.entities).toHaveLength(1);
    expect(mapState?.entities[0]?.id).toBe(1);
    expect(mapState?.nextEntityId).toBe(2);
  });

  it('ignoriert Spawns ohne Gegnerdefinition', () => {
    const { state, content } = setup({
      triggers: [
        {
          id: 'broken',
          pos: { x: 2, y: 1 },
          on: 'enter',
          once: false,
          actions: [{ type: 'spawn', defId: 'ghost', pos: { x: 5, y: 1 } }],
        },
      ],
    });
    fireTriggers(state, content, { x: 2, y: 1 }, 'enter');
    expect(state.maps['test']?.entities).toHaveLength(0);
  });

  it('zieht Schaden vom Spieler ab', () => {
    const { state, content } = setup({
      triggers: [
        {
          id: 'trap',
          pos: { x: 2, y: 1 },
          on: 'enter',
          once: false,
          actions: [{ type: 'damage', amount: 7 }],
        },
      ],
    });
    fireTriggers(state, content, { x: 2, y: 1 }, 'enter');
    expect(state.player.health).toBe(43);
  });
});

describe('hasUsableTrigger', () => {
  it('meldet nur noch nicht verbrauchte use-Trigger', () => {
    const { state, content } = setup({
      triggers: [
        {
          id: 'once',
          pos: { x: 2, y: 1 },
          on: 'use',
          once: true,
          actions: [{ type: 'message', text: 'click' }],
        },
      ],
    });
    expect(hasUsableTrigger(state, content, { x: 2, y: 1 })).toBe(true);
    expect(hasUsableTrigger(state, content, { x: 3, y: 1 })).toBe(false);
    fireTriggers(state, content, { x: 2, y: 1 }, 'use');
    expect(hasUsableTrigger(state, content, { x: 2, y: 1 })).toBe(false);
  });
});
