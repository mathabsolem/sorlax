/**
 * Anlegen, Ablegen und Fallenlassen, PHASE_3_6 Block 4.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { clampHealthToMax, equipAction, unequipAction } from '../src/core/equipActions';
import { MAX_INVENTORY, addToInventory, createInstance } from '../src/core/items';
import { pickupGroundItems } from '../src/core/playerActions';
import { invalidatePlayerDerived, playerDerived } from '../src/core/turn';
import type { ContentDb, GameState, ItemInstance } from '../src/core/types';
import { setup } from './fixtures/world';

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

describe('equip', () => {
  it('legt ein Teil an, nimmt es aus dem Inventar und meldet es', () => {
    const { state, content } = setup();
    const item = give(state, content, 'suit_liner');

    const events = applyCommand(state, { type: 'equip', uid: item.uid }, content);

    expect(events).toEqual([{ type: 'equipped', slot: 'suit', uid: item.uid }]);
    expect(state.player.equipment['suit']).toBe(item);
    expect(state.player.inventory).toHaveLength(0);
    // Anlegen kostet keine Runde, SPEC 3.2.
    expect(state.turnCount).toBe(0);
  });

  // Test 7 aus PHASE_3_6
  it('lehnt bei zu niedriger Kraft ab und aendert nichts', () => {
    const { state, content } = setup();
    // suit_plate verlangt Stufe 12 und Kraft 30.
    state.player.level = 20;
    const item = give(state, content, 'suit_plate');
    const before = JSON.stringify(state);

    const events = applyCommand(state, { type: 'equip', uid: item.uid }, content);

    expect(events).toEqual([{ type: 'invalid', reason: 'requires strength 30' }]);
    expect(state.player.equipment['suit']).toBeUndefined();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('prueft auch Stufe und Geschick', () => {
    const { state, content } = setup();
    const heavy = give(state, content, 'suit_plate');
    expect(equipAction(state, content, heavy.uid)).toEqual({
      ok: false,
      reason: 'requires level 12',
    });

    state.player.level = 20;
    const boots = give(state, content, 'boots_grip');
    expect(equipAction(state, content, boots.uid)).toEqual({
      ok: false,
      reason: 'requires agility 26',
    });
  });

  it('zaehlt Attributsaffixe getragener Teile zu den Voraussetzungen', () => {
    const { state, content } = setup();
    state.player.level = 20;
    state.player.attributes.strength = 26;

    const heavy = give(state, content, 'suit_plate');
    expect(equipAction(state, content, heavy.uid).ok).toBe(false);

    // Zwei Handschuhe mit je plus 2 Kraft gibt es nicht, aber einer reicht schon.
    const gloves = give(state, content, 'gloves_wrap', [{ affixId: 'suf_of_might', value: 6 }]);
    expect(equipAction(state, content, gloves.uid).ok).toBe(true);
    expect(equipAction(state, content, heavy.uid).ok).toBe(true);
  });

  it('tauscht ein belegtes Fach und legt das alte Teil zurueck ins Inventar', () => {
    const { state, content } = setup();
    const first = give(state, content, 'suit_liner');
    const second = give(state, content, 'suit_liner');

    equipAction(state, content, first.uid);
    equipAction(state, content, second.uid);

    expect(state.player.equipment['suit']).toBe(second);
    expect(state.player.inventory).toEqual([first]);
  });

  it('scheitert der Tausch nie am vollen Inventar', () => {
    const { state, content } = setup();
    const worn = give(state, content, 'suit_liner');
    equipAction(state, content, worn.uid);
    for (let index = 0; index < MAX_INVENTORY - 1; index++) give(state, content, 'belt_strap');
    const swap = give(state, content, 'suit_liner');
    expect(state.player.inventory).toHaveLength(MAX_INVENTORY);

    expect(equipAction(state, content, swap.uid).ok).toBe(true);
    expect(state.player.equipment['suit']).toBe(swap);
    expect(state.player.inventory).toHaveLength(MAX_INVENTORY);
  });

  it('lehnt unbekannte und bereits getragene Gegenstaende ab', () => {
    const { state, content } = setup();
    const item = give(state, content, 'suit_liner');
    equipAction(state, content, item.uid);

    expect(equipAction(state, content, item.uid)).toEqual({
      ok: false,
      reason: 'item already equipped',
    });
    expect(equipAction(state, content, 99999)).toEqual({ ok: false, reason: 'unknown item' });
  });
});

describe('unequip', () => {
  it('nimmt ein Teil ab und legt es ins Inventar', () => {
    const { state, content } = setup();
    const item = give(state, content, 'suit_liner');
    equipAction(state, content, item.uid);

    const events = applyCommand(state, { type: 'unequip', slot: 'suit' }, content);

    expect(events).toEqual([{ type: 'message', text: 'unequipped suit' }]);
    expect(state.player.equipment['suit']).toBeUndefined();
    expect(state.player.inventory).toEqual([item]);
    expect(state.turnCount).toBe(0);
  });

  it('lehnt bei leerem Fach und bei vollem Inventar ab', () => {
    const { state, content } = setup();
    expect(unequipAction(state, content, 'suit')).toEqual({ ok: false, reason: 'slot is empty' });

    const item = give(state, content, 'suit_liner');
    equipAction(state, content, item.uid);
    for (let index = 0; index < MAX_INVENTORY; index++) give(state, content, 'belt_strap');

    expect(unequipAction(state, content, 'suit')).toEqual({
      ok: false,
      reason: 'inventory is full',
    });
    expect(state.player.equipment['suit']).toBe(item);
  });

  // Test 10 aus PHASE_3_6
  it('senkt health mit, wenn maxHealth unter den aktuellen Wert faellt', () => {
    const { state, content } = setup();
    const item = give(state, content, 'suit_liner', [{ affixId: 'suf_of_vigor', value: 30 }]);

    equipAction(state, content, item.uid);
    invalidatePlayerDerived(state);
    expect(playerDerived(state, content).maxHealth).toBe(80);
    state.player.health = 80;

    unequipAction(state, content, 'suit');

    expect(playerDerived(state, content).maxHealth).toBe(50);
    expect(state.player.health).toBe(50);
  });

  it('laesst health stehen, wenn maxHealth steigt', () => {
    const { state, content } = setup();
    state.player.health = 50;
    const item = give(state, content, 'suit_liner', [{ affixId: 'suf_of_vigor', value: 30 }]);

    equipAction(state, content, item.uid);

    expect(state.player.health).toBe(50);
    expect(playerDerived(state, content).maxHealth).toBe(80);
  });
});

describe('clampHealthToMax', () => {
  it('kuerzt nur nach oben und verwirft den Rundencache', () => {
    const { state, content } = setup();
    state.player.health = 999;
    clampHealthToMax(state, content);
    expect(state.player.health).toBe(50);

    state.player.health = 20;
    clampHealthToMax(state, content);
    expect(state.player.health).toBe(20);
  });
});

describe('dropItem und Aufnahme', () => {
  it('legt ein Teil auf die Kachel des Spielers und meldet es', () => {
    const { state, content } = setup();
    const item = give(state, content, 'suit_liner');

    const events = applyCommand(state, { type: 'dropItem', uid: item.uid }, content);

    expect(events).toEqual([{ type: 'itemDropped', pos: { x: 1, y: 1 }, uid: item.uid }]);
    expect(state.maps['test']?.groundItems).toEqual([{ pos: { x: 1, y: 1 }, item }]);
    expect(state.player.inventory).toHaveLength(0);
    expect(state.turnCount).toBe(0);
  });

  it('legt auch ein getragenes Teil ab und senkt health mit', () => {
    const { state, content } = setup();
    const item = give(state, content, 'suit_liner', [{ affixId: 'suf_of_vigor', value: 30 }]);
    equipAction(state, content, item.uid);
    state.player.health = 80;

    applyCommand(state, { type: 'dropItem', uid: item.uid }, content);

    expect(state.player.equipment['suit']).toBeUndefined();
    expect(state.player.health).toBe(50);
  });

  it('nimmt beim Betreten der Kachel alles auf, bis das Inventar voll ist', () => {
    const { state, content } = setup();
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const first = give(state, content, 'suit_liner');
    const second = give(state, content, 'belt_strap');
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
    const { state, content } = setup();
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const dropped = give(state, content, 'suit_liner');
    const alsoDropped = give(state, content, 'belt_strap');
    applyCommand(state, { type: 'dropItem', uid: dropped.uid }, content);
    applyCommand(state, { type: 'dropItem', uid: alsoDropped.uid }, content);
    for (let index = 0; index < MAX_INVENTORY; index++) give(state, content, 'gloves_wrap');

    const events = pickupGroundItems(state, mapState, { x: 1, y: 1 });

    expect(events).toEqual([{ type: 'message', text: 'inventory full' }]);
    expect(mapState.groundItems).toHaveLength(2);
  });

  it('sammelt Bodengegenstaende beim Schritt auf die Kachel ein', () => {
    const { state, content } = setup();
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const item = give(state, content, 'suit_liner');
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
