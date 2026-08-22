/**
 * Gegenstandsinstanzen und Inventar, PHASE_3_6 Block 1.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_INVENTORY,
  STARTER_WEAPON_ITEM,
  addGroundItem,
  addToInventory,
  createInstance,
  takeItemUid,
  equippedSlotOf,
  findItem,
  groundItemsAt,
  inventorySpace,
  removeFromInventory,
  removeGroundItem,
  slotsFor,
  slotsForDef,
} from '../src/core/items';
import { equipAction } from '../src/core/equipActions';
import type { ContentDb, GameState, ItemInstance } from '../src/core/types';
import { setup } from './fixtures/world';

function make(state: GameState, content: ContentDb, baseId = 'suit_overall'): ItemInstance {
  const item = createInstance(takeItemUid(state), baseId, 1, 'normal', [], content);
  if (item === null) throw new Error(`kein Grundtyp: ${baseId}`);
  return item;
}

describe('createInstance', () => {
  it('uebernimmt Steckplatz und Werte aus dem Grundtyp', () => {
    const { state, content } = setup();
    const item = createInstance(
      takeItemUid(state),
      'helmet_hardhat',
      7,
      'magic',
      [{ affixId: 'pre_sturdy', value: 9 }],
      content
    );

    expect(item).not.toBeNull();
    expect(item?.slot).toBe('helmet');
    expect(item?.baseId).toBe('helmet_hardhat');
    expect(item?.itemLevel).toBe(7);
    expect(item?.rarity).toBe('magic');
    expect(item?.affixes).toEqual([{ affixId: 'pre_sturdy', value: 9 }]);
    expect(item?.identified).toBe(true);
  });

  it('kopiert die Affixliste, statt sie zu teilen', () => {
    const { state, content } = setup();
    const affixes = [{ affixId: 'pre_sturdy', value: 9 }];
    const item = createInstance(takeItemUid(state), 'helmet_hardhat', 1, 'magic', affixes, content);
    affixes[0] = { affixId: 'pre_plated', value: 2 };
    expect(item?.affixes).toEqual([{ affixId: 'pre_sturdy', value: 9 }]);
  });

  it('liefert null ohne Grundtyp und ohne Steckplatz', () => {
    const { state, content } = setup();
    expect(createInstance(takeItemUid(state), 'gibtsnicht', 1, 'normal', [], content)).toBeNull();
    // `medkit` ist Stapelware und hat deshalb keinen Steckplatz.
    expect(createInstance(takeItemUid(state), 'medkit', 1, 'normal', [], content)).toBeNull();
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
    const worn = make(state, content, 'boots_rubber');
    addToInventory(state, carried);
    state.player.equipment['boots'] = worn;

    expect(findItem(state, carried.uid)).toBe(carried);
    expect(findItem(state, worn.uid)).toBe(worn);
    expect(findItem(state, 99999)).toBeNull();
  });

  it('equippedSlotOf nennt den Steckplatz nur fuer getragene Teile', () => {
    const { state, content } = setup();
    const worn = make(state, content, 'boots_rubber');
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
    const alsoHere = make(state, content, 'belt_tool');
    const elsewhere = make(state, content, 'gloves_grip');
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

describe('Waffenplatz und Steckplatzwahl', () => {
  it('STARTER_WEAPON_ITEM ist der Grundtyp der Brechstange', () => {
    const { state, content } = setup();
    expect(STARTER_WEAPON_ITEM).toBe('item_w_prybar');
    expect(content.items[STARTER_WEAPON_ITEM]?.weaponId).toBe('w_prybar');
    expect(state.player.equipment['weapon']?.baseId).toBe(STARTER_WEAPON_ITEM);
  });

  it('slotsFor gibt Messgeraeten beide Plaetze und allem anderen genau einen', () => {
    const { state, content } = setup();
    const gauge = createInstance(takeItemUid(state), 'gauge_pressure', 1, 'normal', [], content);
    const suit = createInstance(takeItemUid(state), 'suit_overall', 1, 'normal', [], content);
    if (gauge === null || suit === null) throw new Error('kein Grundtyp');

    expect(slotsFor(gauge, content)).toEqual(['gauge_left', 'gauge_right']);
    expect(slotsFor(suit, content)).toEqual(['suit']);
  });

  it('slotsForDef arbeitet auf dem Grundtyp und liefert ohne Steckplatz nichts', () => {
    const { content } = setup();
    const gauge = content.items['gauge_pressure'];
    const medkit = content.items['medkit'];
    if (gauge === undefined || medkit === undefined) throw new Error('kein Grundtyp');

    expect(slotsForDef(gauge)).toEqual(['gauge_left', 'gauge_right']);
    expect(slotsForDef(medkit)).toEqual([]);
  });

  it('legt ein Messgeraet in den freien der beiden Plaetze', () => {
    const { state, content } = setup();
    state.player.attributes.agility = 14;
    const first = make(state, content, 'gauge_pressure');
    const second = make(state, content, 'gauge_seismic');
    second.itemLevel = 1;
    addToInventory(state, first);
    addToInventory(state, second);

    expect(equipAction(state, content, first.uid).ok).toBe(true);
    expect(state.player.equipment['gauge_left']).toBe(first);

    // gauge_seismic ist schwer und verlangt Stufe 8.
    state.player.level = 10;
    state.player.attributes.strength = 22;
    expect(equipAction(state, content, second.uid).ok).toBe(true);
    expect(state.player.equipment['gauge_right']).toBe(second);
  });
});
