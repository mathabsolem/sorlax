/**
 * Anlegen, Ablegen und Fallenlassen, PHASE_3_6 Block 4.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { clampHealthToMax, equipAction, unequipAction } from '../src/core/equipActions';
import { MAX_INVENTORY, addToInventory, createInstance,
  takeItemUid } from '../src/core/items';
import { invalidatePlayerDerived, playerDerived } from '../src/core/turn';
import type { ContentDb, GameState, ItemInstance } from '../src/core/types';
import { setup } from './fixtures/world';

/**
 * Testwelt mit einem Spieler, der die Voraussetzungen leichter Ausruestung
 * erfuellt: BESTIARY Abschnitt 8 verlangt dafuer Geschick 14.
 */
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
  const item = createInstance(takeItemUid(state), baseId, 20, 'rare', affixes, content);
  if (item === null) throw new Error(`kein Grundtyp: ${baseId}`);
  addToInventory(state, item);
  return item;
}

describe('equip', () => {
  it('legt ein Teil an, nimmt es aus dem Inventar und meldet es', () => {
    const { state, content } = world();
    const item = give(state, content, 'suit_overall');

    const events = applyCommand(state, { type: 'equip', uid: item.uid }, content);

    expect(events).toEqual([{ type: 'equipped', slot: 'suit', uid: item.uid }]);
    expect(state.player.equipment['suit']).toBe(item);
    expect(state.player.inventory).toHaveLength(0);
    // Anlegen kostet keine Runde, SPEC 3.2.
    expect(state.turnCount).toBe(0);
  });

  // Test 7 aus PHASE_3_6
  it('lehnt bei zu niedriger Kraft ab und aendert nichts', () => {
    const { state, content } = world();
    // Schwere Ausruestung verlangt laut BESTIARY Abschnitt 8 Stufe 8 und Kraft 22.
    state.player.level = 20;
    const item = give(state, content, 'suit_plated');
    const before = JSON.stringify(state);

    const events = applyCommand(state, { type: 'equip', uid: item.uid }, content);

    expect(events).toEqual([{ type: 'invalid', reason: 'requires strength 22' }]);
    expect(state.player.equipment['suit']).toBeUndefined();
    expect(JSON.stringify(state)).toBe(before);
  });

  it('prueft auch Stufe und Geschick', () => {
    const { state, content } = world();
    const heavy = give(state, content, 'suit_plated');
    expect(equipAction(state, content, heavy.uid)).toEqual({
      ok: false,
      reason: 'requires level 8',
    });

    // Leichte Ausruestung verlangt Geschick 14, der Startwert ist 10.
    const plain = setup();
    const boots = give(plain.state, plain.content, 'boots_rubber');
    expect(equipAction(plain.state, plain.content, boots.uid)).toEqual({
      ok: false,
      reason: 'requires agility 14',
    });
  });

  it('zaehlt Attributsaffixe getragener Teile zu den Voraussetzungen', () => {
    const { state, content } = world();
    state.player.level = 20;
    // Kraft 18 reicht nicht fuer die 22 des Panzeranzugs.
    state.player.attributes.strength = 18;

    const heavy = give(state, content, 'suit_plated');
    expect(equipAction(state, content, heavy.uid)).toEqual({
      ok: false,
      reason: 'requires strength 22',
    });

    // Handschuhe mit plus 6 Kraft heben den Wert auf 24 und schalten ihn frei.
    const gloves = give(state, content, 'gloves_grip', [{ affixId: 'suf_of_might', value: 6 }]);
    expect(equipAction(state, content, gloves.uid).ok).toBe(true);
    expect(equipAction(state, content, heavy.uid).ok).toBe(true);
  });

  it('tauscht ein belegtes Fach und legt das alte Teil zurueck ins Inventar', () => {
    const { state, content } = world();
    const first = give(state, content, 'suit_overall');
    const second = give(state, content, 'suit_overall');

    equipAction(state, content, first.uid);
    equipAction(state, content, second.uid);

    expect(state.player.equipment['suit']).toBe(second);
    expect(state.player.inventory).toEqual([first]);
  });

  it('scheitert der Tausch nie am vollen Inventar', () => {
    const { state, content } = world();
    const worn = give(state, content, 'suit_overall');
    equipAction(state, content, worn.uid);
    for (let index = 0; index < MAX_INVENTORY - 1; index++) give(state, content, 'belt_tool');
    const swap = give(state, content, 'suit_overall');
    expect(state.player.inventory).toHaveLength(MAX_INVENTORY);

    expect(equipAction(state, content, swap.uid).ok).toBe(true);
    expect(state.player.equipment['suit']).toBe(swap);
    expect(state.player.inventory).toHaveLength(MAX_INVENTORY);
  });

  it('lehnt unbekannte und bereits getragene Gegenstaende ab', () => {
    const { state, content } = world();
    const item = give(state, content, 'suit_overall');
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
    const { state, content } = world();
    const item = give(state, content, 'suit_overall');
    equipAction(state, content, item.uid);

    const events = applyCommand(state, { type: 'unequip', slot: 'suit' }, content);

    // Seit INTERFACES v1.5 ein eigenes Ereignis, keine Textmeldung mehr.
    expect(events).toEqual([{ type: 'unequipped', slot: 'suit', uid: item.uid }]);
    expect(state.player.equipment['suit']).toBeUndefined();
    expect(state.player.inventory).toEqual([item]);
    expect(state.turnCount).toBe(0);
  });

  it('lehnt bei leerem Fach und bei vollem Inventar ab', () => {
    const { state, content } = world();
    expect(unequipAction(state, content, 'suit')).toEqual({ ok: false, reason: 'slot is empty' });

    const item = give(state, content, 'suit_overall');
    equipAction(state, content, item.uid);
    for (let index = 0; index < MAX_INVENTORY; index++) give(state, content, 'belt_tool');

    expect(unequipAction(state, content, 'suit')).toEqual({
      ok: false,
      reason: 'inventory is full',
    });
    expect(state.player.equipment['suit']).toBe(item);
  });

  // Test 10 aus PHASE_3_6
  it('senkt health mit, wenn maxHealth unter den aktuellen Wert faellt', () => {
    const { state, content } = world();
    const item = give(state, content, 'suit_overall', [{ affixId: 'suf_of_vigor', value: 30 }]);

    equipAction(state, content, item.uid);
    invalidatePlayerDerived(state);
    expect(playerDerived(state, content).maxHealth).toBe(80);
    state.player.health = 80;

    unequipAction(state, content, 'suit');

    expect(playerDerived(state, content).maxHealth).toBe(50);
    expect(state.player.health).toBe(50);
  });

  it('laesst health stehen, wenn maxHealth steigt', () => {
    const { state, content } = world();
    state.player.health = 50;
    const item = give(state, content, 'suit_overall', [{ affixId: 'suf_of_vigor', value: 30 }]);

    equipAction(state, content, item.uid);

    expect(state.player.health).toBe(50);
    expect(playerDerived(state, content).maxHealth).toBe(80);
  });
});

describe('clampHealthToMax', () => {
  it('kuerzt nur nach oben und verwirft den Rundencache', () => {
    const { state, content } = world();
    state.player.health = 999;
    clampHealthToMax(state, content);
    expect(state.player.health).toBe(50);

    state.player.health = 20;
    clampHealthToMax(state, content);
    expect(state.player.health).toBe(20);
  });
});

describe('Messgeraete', () => {
  // Test 5 aus PHASE_5
  it('nimmt zwei Messgeraete in beide Handgelenke', () => {
    const { state, content } = world();
    const left = give(state, content, 'gauge_pressure');
    const right = give(state, content, 'gauge_seismic');
    state.player.level = 8;
    state.player.attributes.strength = 22;

    expect(equipAction(state, content, left.uid).ok).toBe(true);
    expect(equipAction(state, content, right.uid).ok).toBe(true);
    expect(state.player.equipment['gauge_left']?.uid).toBe(left.uid);
    expect(state.player.equipment['gauge_right']?.uid).toBe(right.uid);
  });

  // Test 5 aus PHASE_5, zweite Haelfte: RPG.md Abschnitt 3 verbietet denselben
  // einzigartigen Gegenstand zweimal.
  it('legt denselben einzigartigen Gegenstand nicht zweimal an', () => {
    const { state, content } = world();
    const unique = content.uniques['uq_pruefblei'];
    expect(unique).toBeDefined();
    if (unique === undefined) return;

    const copies = [0, 1].map(() => {
      const item = createInstance(
        takeItemUid(state),
        unique.baseId,
        20,
        'unique',
        unique.affixes,
        content
      );
      if (item === null) throw new Error('kein Grundtyp');
      addToInventory(state, item);
      return item;
    });

    expect(equipAction(state, content, copies[0]?.uid ?? -1).ok).toBe(true);
    expect(equipAction(state, content, copies[1]?.uid ?? -1)).toEqual({
      ok: false,
      reason: 'unique already equipped',
    });
    expect(state.player.equipment['gauge_right']).toBeUndefined();
  });
});
