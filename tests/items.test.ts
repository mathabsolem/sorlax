/**
 * Gegenstandsinstanzen und Inventar, PHASE_3_6 Block 1.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_INVENTORY,
  addGroundItem,
  addToInventory,
  createInstance,
  equippedSlotOf,
  findItem,
  groundItemsAt,
  inventorySpace,
  removeFromInventory,
  removeGroundItem,
} from '../src/core/items';
import type { ContentDb, GameState, ItemInstance } from '../src/core/types';
import { setup } from './fixtures/world';

function make(state: GameState, content: ContentDb, baseId = 'suit_liner'): ItemInstance {
  const item = createInstance(state, baseId, 1, 'normal', [], content);
  if (item === null) throw new Error(`kein Grundtyp: ${baseId}`);
  return item;
}

describe('createInstance', () => {
  it('uebernimmt Steckplatz und Werte aus dem Grundtyp', () => {
    const { state, content } = setup();
    const item = createInstance(
      state,
      'helmet_cap',
      7,
      'magic',
      [{ affixId: 'pre_sturdy', value: 9 }],
      content
    );

    expect(item).not.toBeNull();
    expect(item?.slot).toBe('helmet');
    expect(item?.baseId).toBe('helmet_cap');
    expect(item?.itemLevel).toBe(7);
    expect(item?.rarity).toBe('magic');
    expect(item?.affixes).toEqual([{ affixId: 'pre_sturdy', value: 9 }]);
    expect(item?.identified).toBe(true);
  });

  it('kopiert die Affixliste, statt sie zu teilen', () => {
    const { state, content } = setup();
    const affixes = [{ affixId: 'pre_sturdy', value: 9 }];
    const item = createInstance(state, 'helmet_cap', 1, 'magic', affixes, content);
    affixes[0] = { affixId: 'pre_plated', value: 2 };
    expect(item?.affixes).toEqual([{ affixId: 'pre_sturdy', value: 9 }]);
  });

  it('liefert null ohne Grundtyp und ohne Steckplatz', () => {
    const { state, content } = setup();
    expect(createInstance(state, 'gibtsnicht', 1, 'normal', [], content)).toBeNull();
    // `medkit` ist Stapelware und hat deshalb keinen Steckplatz.
    expect(createInstance(state, 'medkit', 1, 'normal', [], content)).toBeNull();
  });

  // Test 1 aus PHASE_3_6
  it('vergibt ueber 1000 Gegenstaende hinweg eindeutige uids, auch nach Ablegen', () => {
    const { state, content } = setup();
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const first = state.nextItemUid;
    const seen = new Set<number>();
    for (let index = 0; index < 1000; index++) {
      const item = make(state, content);
      expect(seen.has(item.uid)).toBe(false);
      seen.add(item.uid);

      // Jeder zweite Gegenstand geht ueber den Boden und das Inventar zurueck.
      if (index % 2 === 0) {
        addGroundItem(mapState, { x: 1, y: 1 }, item);
        expect(removeGroundItem(mapState, item.uid)).toBe(true);
        addToInventory(state, item);
        removeFromInventory(state, item.uid);
      }
    }

    expect(seen.size).toBe(1000);
    expect(state.nextItemUid).toBe(first + 1000);
    // Der Zaehler laeuft weiter, eine freigewordene uid kommt nicht zurueck.
    expect(seen.has(state.nextItemUid)).toBe(false);
  });
});

describe('Inventar', () => {
  it('nimmt bis zur Grenze auf und lehnt danach ab', () => {
    const { state, content } = setup();
    expect(inventorySpace(state)).toBe(MAX_INVENTORY);

    for (let index = 0; index < MAX_INVENTORY; index++) {
      expect(addToInventory(state, make(state, content))).toBe(true);
    }
    expect(inventorySpace(state)).toBe(0);

    const overflow = make(state, content);
    expect(addToInventory(state, overflow)).toBe(false);
    expect(state.player.inventory).toHaveLength(MAX_INVENTORY);
  });

  it('removeFromInventory liefert den Gegenstand und danach null', () => {
    const { state, content } = setup();
    const item = make(state, content);
    addToInventory(state, item);

    expect(removeFromInventory(state, item.uid)).toBe(item);
    expect(removeFromInventory(state, item.uid)).toBeNull();
    expect(state.player.inventory).toHaveLength(0);
  });

  it('findItem sucht im Inventar und in der Ausruestung', () => {
    const { state, content } = setup();
    const carried = make(state, content);
    const worn = make(state, content, 'boots_tread');
    addToInventory(state, carried);
    state.player.equipment['boots'] = worn;

    expect(findItem(state, carried.uid)).toBe(carried);
    expect(findItem(state, worn.uid)).toBe(worn);
    expect(findItem(state, 99999)).toBeNull();
  });

  it('equippedSlotOf nennt den Steckplatz nur fuer getragene Teile', () => {
    const { state, content } = setup();
    const worn = make(state, content, 'boots_tread');
    const carried = make(state, content);
    addToInventory(state, carried);
    state.player.equipment['boots'] = worn;

    expect(equippedSlotOf(state, worn.uid)).toBe('boots');
    expect(equippedSlotOf(state, carried.uid)).toBeNull();
  });
});

describe('Bodengegenstaende', () => {
  it('legt ab, findet kachelweise und nimmt wieder weg', () => {
    const { state, content } = setup();
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const here = make(state, content);
    const alsoHere = make(state, content, 'belt_strap');
    const elsewhere = make(state, content, 'gloves_wrap');
    addGroundItem(mapState, { x: 2, y: 3 }, here);
    addGroundItem(mapState, { x: 2, y: 3 }, alsoHere);
    addGroundItem(mapState, { x: 5, y: 5 }, elsewhere);

    expect(groundItemsAt(mapState, { x: 2, y: 3 }).map((entry) => entry.item.uid)).toEqual([
      here.uid,
      alsoHere.uid,
    ]);
    expect(groundItemsAt(mapState, { x: 7, y: 7 })).toEqual([]);

    expect(removeGroundItem(mapState, here.uid)).toBe(true);
    expect(removeGroundItem(mapState, here.uid)).toBe(false);
    expect(mapState.groundItems).toHaveLength(2);
  });

  it('kopiert die Position, statt sie mit dem Spieler zu teilen', () => {
    const { state, content } = setup();
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const entry = addGroundItem(mapState, state.player.pos, make(state, content));
    state.player.pos = { x: 6, y: 6 };
    expect(entry.pos).toEqual({ x: 1, y: 1 });
  });
});
