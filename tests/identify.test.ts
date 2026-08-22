/**
 * Identifizieren ueber scanner_charge und die Belegung der Fertigkeitsleiste,
 * beides neu in INTERFACES v1.4.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { IDENTIFY_ITEM_ID, addToInventory, createInstance } from '../src/core/items';
import { useConsumableAction } from '../src/core/playerActions';
import {
  SKILLBAR_SLOTS,
  assignSkillSlotAction,
  skillbarKey,
} from '../src/core/skillActions';
import { deserialize, serialize } from '../src/core/state';
import { skillbarAssignment, skillbarSlots } from '../src/ui/progressModel';
import type { ContentDb, GameState, ItemInstance } from '../src/core/types';
import { setup } from './fixtures/world';

function unidentified(state: GameState, content: ContentDb): ItemInstance {
  const item = createInstance(
    state,
    'suit_overall',
    12,
    'rare',
    [{ affixId: 'suf_of_vigor', value: 21 }],
    content
  );
  if (item === null) throw new Error('kein Grundtyp');
  item.identified = false;
  addToInventory(state, item);
  return item;
}

describe('useConsumable mit Ziel', () => {
  it('identifiziert den benannten Gegenstand und kostet eine Runde', () => {
    const { state, content } = setup();
    const item = unidentified(state, content);
    state.player.consumables[IDENTIFY_ITEM_ID] = 2;

    const events = applyCommand(
      state,
      { type: 'useConsumable', itemId: IDENTIFY_ITEM_ID, targetUid: item.uid },
      content
    );

    expect(item.identified).toBe(true);
    expect(state.player.consumables[IDENTIFY_ITEM_ID]).toBe(1);
    expect(state.turnCount).toBe(1);
    expect(events).toContainEqual({ type: 'message', text: 'identified suit_overall' });
  });

  it('identifiziert auch ein getragenes Teil', () => {
    const { state, content } = setup();
    const item = unidentified(state, content);
    state.player.inventory.length = 0;
    state.player.equipment['suit'] = item;
    state.player.consumables[IDENTIFY_ITEM_ID] = 1;

    expect(useConsumableAction(state, content, IDENTIFY_ITEM_ID, item.uid).ok).toBe(true);
    expect(item.identified).toBe(true);
  });

  it('lehnt ohne Ziel, bei unbekannter uid und bei bereits Identifiziertem ab', () => {
    const { state, content } = setup();
    const item = unidentified(state, content);
    state.player.consumables[IDENTIFY_ITEM_ID] = 3;

    expect(useConsumableAction(state, content, IDENTIFY_ITEM_ID)).toEqual({
      ok: false,
      reason: 'no target for identify',
    });
    expect(useConsumableAction(state, content, IDENTIFY_ITEM_ID, 99999)).toEqual({
      ok: false,
      reason: 'unknown item',
    });

    useConsumableAction(state, content, IDENTIFY_ITEM_ID, item.uid);
    expect(useConsumableAction(state, content, IDENTIFY_ITEM_ID, item.uid)).toEqual({
      ok: false,
      reason: 'item already identified',
    });
    // Nur der erste Aufruf hat eine Ladung verbraucht.
    expect(state.player.consumables[IDENTIFY_ITEM_ID]).toBe(2);
  });

  it('braucht eine Ladung im Bestand und kostet ohne sie keine Runde', () => {
    const { state, content } = setup();
    const item = unidentified(state, content);

    const events = applyCommand(
      state,
      { type: 'useConsumable', itemId: IDENTIFY_ITEM_ID, targetUid: item.uid },
      content
    );

    expect(events).toEqual([{ type: 'invalid', reason: 'item not in inventory' }]);
    expect(item.identified).toBe(false);
    expect(state.turnCount).toBe(0);
  });

  it('laesst andere Verbrauchsgueter unveraendert', () => {
    const { state, content } = setup();
    state.player.consumables['medkit'] = 1;
    state.player.health = 10;

    applyCommand(state, { type: 'useConsumable', itemId: 'medkit' }, content);

    expect(state.player.health).toBe(30);
    expect(state.turnCount).toBe(1);
  });
});

describe('assignSkillSlot', () => {
  function withSkill() {
    const world = setup();
    world.state.player.level = 20;
    world.state.player.skills = { breach: 2, sweep: 1, precise_strike: 3 };
    return world;
  }

  it('belegt einen Platz und kostet keine Runde', () => {
    const { state, content } = withSkill();

    const events = applyCommand(state, { type: 'assignSkillSlot', index: 0, skillId: 'breach' }, content);

    expect(state.flags[skillbarKey(0)]).toBe('breach');
    expect(skillbarAssignment(state, content, 0)?.id).toBe('breach');
    expect(state.turnCount).toBe(0);
    expect(events).toContainEqual({ type: 'message', text: 'assigned breach to slot 1' });
  });

  it('raeumt einen Platz mit leerem skillId', () => {
    const { state, content } = withSkill();
    assignSkillSlotAction(state, content, 1, 'sweep');

    expect(assignSkillSlotAction(state, content, 1, '').ok).toBe(true);

    expect(state.flags[skillbarKey(1)]).toBeUndefined();
    expect(skillbarAssignment(state, content, 1)).toBeNull();
  });

  it('legt eine Fertigkeit auf hoechstens einen Platz', () => {
    const { state, content } = withSkill();

    assignSkillSlotAction(state, content, 0, 'breach');
    assignSkillSlotAction(state, content, 4, 'breach');

    expect(state.flags[skillbarKey(0)]).toBeUndefined();
    expect(state.flags[skillbarKey(4)]).toBe('breach');
    expect(skillbarSlots(state, content).filter((def) => def?.id === 'breach')).toHaveLength(1);
  });

  it('lehnt ungueltige Plaetze, passive, gesperrte und ungelernte Fertigkeiten ab', () => {
    const { state, content } = withSkill();

    expect(assignSkillSlotAction(state, content, -1, 'breach').ok).toBe(false);
    expect(assignSkillSlotAction(state, content, SKILLBAR_SLOTS, 'breach')).toEqual({
      ok: false,
      reason: `no such skill slot: ${SKILLBAR_SLOTS}`,
    });
    expect(assignSkillSlotAction(state, content, 0, 'gibtsnicht')).toEqual({
      ok: false,
      reason: 'unknown skill: gibtsnicht',
    });
    expect(assignSkillSlotAction(state, content, 0, 'precise_strike')).toEqual({
      ok: false,
      reason: 'skill is passive: precise_strike',
    });
    expect(assignSkillSlotAction(state, content, 0, 'last_stand')).toEqual({
      ok: false,
      reason: 'skill is locked: last_stand',
    });

    state.player.skills = {};
    expect(assignSkillSlotAction(state, content, 0, 'breach')).toEqual({
      ok: false,
      reason: 'skill not learned: breach',
    });
  });

  it('ueberlebt Serialisieren und Deserialisieren', () => {
    const { state, content } = withSkill();
    assignSkillSlotAction(state, content, 2, 'sweep');

    const restored = deserialize(serialize(state));

    expect(skillbarAssignment(restored, content, 2)?.id).toBe('sweep');
  });
});
