/**
 * Ablegen und Aufnehmen von Ausruestung, aus equipment.test.ts herausgeloest.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { dropItemAction, equipAction } from '../src/core/equipActions';
import { MAX_INVENTORY, addToInventory, createInstance } from '../src/core/items';
import { pickupGroundItems } from '../src/core/playerActions';
import type { ContentDb, GameState, ItemInstance } from '../src/core/types';
import { setup } from './fixtures/world';

function world() {
  const built = setup();
  built.state.player.attributes.agility = 14;
  return built;
}

function give(
  state: GameState,
  content: ContentDb,
  baseId: string,
  affixes: { affixId: string; value: number }[] = []
): ItemInstance {
  const item = createInstance(state, baseId, 20, 'rare', affixes, content);
  if (item === null) throw new Error(`kein Grundtyp: ${baseId}`);
  addToInventory(state, item);
  return item;
}

describe('dropItem und Aufnahme', () => {
  it('legt ein Teil auf die Kachel des Spielers und meldet es', () => {
    const { state, content } = world();
    const item = give(state, content, 'suit_overall');

    const events = applyCommand(state, { type: 'dropItem', uid: item.uid }, content);

    expect(events).toEqual([{ type: 'itemDropped', pos: { x: 1, y: 1 }, uid: item.uid }]);
    expect(state.maps['test']?.groundItems).toEqual([{ pos: { x: 1, y: 1 }, item }]);
    expect(state.player.inventory).toHaveLength(0);
    expect(state.turnCount).toBe(0);
  });

  it('lehnt unbekannte Gegenstaende ab und laesst die Karte in Ruhe', () => {
    const { state, content } = world();
    expect(dropItemAction(state, content, 99999)).toEqual({ ok: false, reason: 'unknown item' });
    expect(state.maps['test']?.groundItems).toEqual([]);

    const item = give(state, content, 'suit_overall');
    const result = dropItemAction(state, content, item.uid);
    expect(result.ok).toBe(true);
    expect(state.maps['test']?.groundItems).toHaveLength(1);
  });

  it('legt auch ein getragenes Teil ab und senkt health mit', () => {
    const { state, content } = world();
    const item = give(state, content, 'suit_overall', [{ affixId: 'suf_of_vigor', value: 30 }]);
    equipAction(state, content, item.uid);
    state.player.health = 80;

    applyCommand(state, { type: 'dropItem', uid: item.uid }, content);

    expect(state.player.equipment['suit']).toBeUndefined();
    expect(state.player.health).toBe(50);
  });

  it('nimmt beim Betreten der Kachel alles auf, bis das Inventar voll ist', () => {
    const { state, content } = world();
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const first = give(state, content, 'suit_overall');
    const second = give(state, content, 'belt_tool');
    applyCommand(state, { type: 'dropItem', uid: first.uid }, content);
    applyCommand(state, { type: 'dropItem', uid: second.uid }, content);

    const events = pickupGroundItems(state, mapState, { x: 1, y: 1 });

    expect(events).toEqual([
      { type: 'itemPickedUp', uid: first.uid },
      { type: 'itemPickedUp', uid: second.uid },
    ]);
    expect(mapState.groundItems).toHaveLength(0);
    expect(state.player.inventory.map((item) => item.uid)).toEqual([first.uid, second.uid]);
  });

  it('laesst bei vollem Inventar liegen und meldet das einmal', () => {
    const { state, content } = world();
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const dropped = give(state, content, 'suit_overall');
    const alsoDropped = give(state, content, 'belt_tool');
    applyCommand(state, { type: 'dropItem', uid: dropped.uid }, content);
    applyCommand(state, { type: 'dropItem', uid: alsoDropped.uid }, content);
    for (let index = 0; index < MAX_INVENTORY; index++) give(state, content, 'gloves_grip');

    const events = pickupGroundItems(state, mapState, { x: 1, y: 1 });

    expect(events).toEqual([{ type: 'message', text: 'Das Inventar ist voll' }]);
    expect(mapState.groundItems).toHaveLength(2);
  });

  it('sammelt Bodengegenstaende beim Schritt auf die Kachel ein', () => {
    const { state, content } = world();
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const item = give(state, content, 'suit_overall');
    applyCommand(state, { type: 'dropItem', uid: item.uid }, content);
    // Der Spieler blickt nach Norden, dort ist Wand. Also erst nach Sueden und
    // dann zurueck auf die Kachel mit dem abgelegten Teil.
    applyCommand(state, { type: 'move', dir: 'back' }, content);
    expect(state.player.inventory).toHaveLength(0);

    const events = applyCommand(state, { type: 'move', dir: 'forward' }, content);

    expect(events).toContainEqual({ type: 'itemPickedUp', uid: item.uid });
    expect(state.player.inventory).toEqual([item]);
  });
});
