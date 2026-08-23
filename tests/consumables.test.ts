/**
 * Verbrauchsgueter aus CONTENT_TABLES Abschnitt 1, PHASE_5 Block 2 und 5.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { pickupAt } from '../src/core/playerActions';
import { getDerivedStats, playerActor } from '../src/core/derived';
import { applyEffectDefault } from '../src/core/effects';
import { IDENTIFY_ITEM_ID, addToInventory, createInstance, takeItemUid } from '../src/core/items';
import { advanceRound } from '../src/core/turn';
import type { ContentDb, GameState } from '../src/core/types';
import { setup } from './fixtures/world';

/** Laesst `turns` volle Runden vergehen. */
function skipRounds(state: GameState, content: ContentDb, turns: number): void {
  for (let turn = 0; turn < turns; turn++) advanceRound(state, content);
}

function armorOf(state: GameState, content: ContentDb): number {
  return getDerivedStats(playerActor(state), content, state.difficulty).armor;
}

describe('armor_plate', () => {
  // Test 1 aus PHASE_5
  it('erhoeht die Ruestung um 10 und laeuft nach 20 Runden ab', () => {
    const { state, content } = setup();
    const before = armorOf(state, content);
    state.player.consumables['armor_plate'] = 1;

    const events = applyCommand(state, { type: 'useConsumable', itemId: 'armor_plate' }, content);

    expect(events).toContainEqual({
      type: 'effectApplied',
      who: 'player',
      effectId: 'plating',
      turns: 20,
    });
    expect(armorOf(state, content)).toBe(before + 10);

    // Die Runde, in der die Platte angelegt wird, zaehlt mit: nach ihr stehen
    // noch 19 Runden aus. Der Bonus haelt also 18 weitere Runden sicher.
    expect(state.player.effects[0]?.remainingTurns).toBe(19);
    skipRounds(state, content, 18);
    expect(armorOf(state, content)).toBe(before + 10);

    skipRounds(state, content, 1);
    expect(state.player.effects).toEqual([]);
    expect(armorOf(state, content)).toBe(before);
  });
});

describe('antitoxin', () => {
  // Test 2 aus PHASE_5
  it('entfernt toxin und heilt 10', () => {
    const { state, content } = setup();
    applyEffectDefault(playerActor(state), 'toxin', content, state.difficulty);
    state.player.health = 20;
    state.player.consumables['antitoxin'] = 1;

    const events = applyCommand(state, { type: 'useConsumable', itemId: 'antitoxin' }, content);

    expect(state.player.effects).toEqual([]);
    expect(state.player.health).toBe(30);
    expect(events).toContainEqual({ type: 'effectExpired', who: 'player', effectId: 'toxin' });
  });

  it('bleibt gueltig, wenn gar kein Gift wirkt', () => {
    const { state, content } = setup();
    state.player.health = 20;
    state.player.consumables['antitoxin'] = 1;

    applyCommand(state, { type: 'useConsumable', itemId: 'antitoxin' }, content);

    expect(state.player.health).toBe(30);
    expect(state.player.consumables['antitoxin']).toBe(0);
  });
});

describe('scanner_charge', () => {
  function unidentified(state: GameState, content: ContentDb) {
    const item = createInstance(takeItemUid(state), 'suit_overall', 12, 'rare', [], content);
    if (item === null) throw new Error('kein Grundtyp');
    item.identified = false;
    addToInventory(state, item);
    return item;
  }

  // Test 3 aus PHASE_5
  it('ist ohne targetUid ungueltig und kostet keine Runde', () => {
    const { state, content } = setup();
    unidentified(state, content);
    state.player.consumables[IDENTIFY_ITEM_ID] = 1;

    const events = applyCommand(state, { type: 'useConsumable', itemId: IDENTIFY_ITEM_ID }, content);

    expect(events).toEqual([{ type: 'invalid', reason: 'no target for identify' }]);
    expect(state.turnCount).toBe(0);
    expect(state.player.consumables[IDENTIFY_ITEM_ID]).toBe(1);
  });

  // Test 4 aus PHASE_5
  it('ist auf einem bereits identifizierten Teil ungueltig', () => {
    const { state, content } = setup();
    const item = unidentified(state, content);
    item.identified = true;
    state.player.consumables[IDENTIFY_ITEM_ID] = 1;

    const events = applyCommand(
      state,
      { type: 'useConsumable', itemId: IDENTIFY_ITEM_ID, targetUid: item.uid },
      content
    );

    expect(events).toEqual([{ type: 'invalid', reason: 'item already identified' }]);
    expect(state.turnCount).toBe(0);
    expect(state.player.consumables[IDENTIFY_ITEM_ID]).toBe(1);
  });
});

describe('Munition', () => {
  it('bucht den Stapel unter der Munitionssorte des Gegenstands', () => {
    const { state, content } = setup();
    const pistol = content.items['ammo_pistol'];
    expect(pistol?.ammoType).toBe('pistol');

    const mapState = state.maps['test'];
    if (mapState === undefined || pistol === undefined) throw new Error('kein Kartenzustand');
    const pos = { x: state.player.pos.x, y: state.player.pos.y };
    mapState.entities.push({
      id: 900,
      kind: 'item',
      defId: pistol.id,
      pos,
      facing: 0,
      actionPoints: 0,
      active: false,
      effects: [],
      animation: { frame: 'idle', startedAtTurn: 0 },
    });

    pickupAt(state, content, pos);

    // Die Waffe fragt nach `pistol`, nicht nach `ammo_pistol`.
    expect(state.player.ammo['pistol']).toBe(pistol.amount);
    expect(state.player.ammo['ammo_pistol']).toBeUndefined();
  });
});
