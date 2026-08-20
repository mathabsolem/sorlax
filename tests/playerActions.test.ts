import { describe, expect, it } from 'vitest';
import { currentScene } from '../src/core/actionResult';
import {
  interactAction,
  spendAttributeAction,
  moveAction,
  pickupAt,
  switchWeaponAction,
  useConsumableAction,
} from '../src/core/playerActions';
import { playerDerived } from '../src/core/turn';
import { setup } from './fixtures/world';

const EAST_SPAWN = { pos: { x: 1, y: 1 }, facing: 1 } as const;

describe('moveAction', () => {
  it('bewegt den Spieler und merkt die Kachel als erkundet', () => {
    const { state, content } = setup({ spawn: EAST_SPAWN });
    const result = moveAction(state, content, 'forward');
    expect(result.ok).toBe(true);
    expect(state.player.pos).toEqual({ x: 2, y: 1 });
    expect(state.maps['test']?.explored).toContain('2,1');
  });

  it('lehnt Waende ab, ohne den Zustand zu aendern', () => {
    const { state, content } = setup();
    const result = moveAction(state, content, 'forward');
    expect(result).toEqual({ ok: false, reason: 'blocked by wall' });
    expect(state.player.pos).toEqual({ x: 1, y: 1 });
  });

  it('lehnt geschlossene Tueren und besetzte Kacheln ab', () => {
    const withDoor = setup({ spawn: EAST_SPAWN, entities: [{ kind: 'door', defId: 'door', pos: { x: 2, y: 1 } }] });
    expect(moveAction(withDoor.state, withDoor.content, 'forward')).toEqual({
      ok: false,
      reason: 'door is closed',
    });

    const withEnemy = setup({
      spawn: EAST_SPAWN,
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 2, y: 1 } }],
    });
    expect(moveAction(withEnemy.state, withEnemy.content, 'forward')).toEqual({
      ok: false,
      reason: 'tile occupied',
    });
  });

  it('sammelt ein Item auf der Zielkachel ein', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      entities: [{ kind: 'item', defId: 'bullets', pos: { x: 2, y: 1 } }],
    });
    const result = moveAction(state, content, 'forward');
    expect(result.ok && result.events[1]).toEqual({ type: 'pickup', defId: 'bullets', amount: 10 });
    expect(state.player.ammo['bullets']).toBe(10);
  });
});

describe('pickupAt', () => {
  it('legt Items in das passende Fach und vermerkt sie', () => {
    const { state, content } = setup({
      entities: [
        { kind: 'item', defId: 'redkey', pos: { x: 2, y: 1 } },
        { kind: 'item', defId: 'medkit', pos: { x: 3, y: 1 } },
      ],
    });
    pickupAt(state, content, { x: 2, y: 1 });
    pickupAt(state, content, { x: 3, y: 1 });
    expect(state.player.keys).toEqual(['redkey']);
    expect(state.player.consumables['medkit']).toBe(20);
    expect(state.maps['test']?.takenItems).toEqual(['2,1', '3,1']);
    expect(state.maps['test']?.entities).toHaveLength(0);
  });

  it('tut auf leeren Kacheln nichts', () => {
    const { state, content } = setup();
    expect(pickupAt(state, content, { x: 2, y: 1 })).toEqual([]);
  });
});


describe('interactAction', () => {
  it('oeffnet eine geschlossene Tuer vor dem Spieler', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      entities: [{ kind: 'door', defId: 'door', pos: { x: 2, y: 1 } }],
    });
    const result = interactAction(state, content);
    expect(result.ok && result.events[0]).toEqual({
      type: 'doorChanged',
      pos: { x: 2, y: 1 },
      state: 'open',
    });
    expect(state.maps['test']?.entities[0]?.state).toBe('open');
    expect(state.maps['test']?.openedDoors).toEqual(['2,1']);
  });

  it('meldet blocked bei verriegelter Tuer ohne passenden Schluessel', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      entities: [{ kind: 'door', defId: 'door', pos: { x: 2, y: 1 }, locked: 'redkey' }],
    });
    const result = interactAction(state, content);
    expect(result.ok && result.events[0]).toEqual({
      type: 'doorChanged',
      pos: { x: 2, y: 1 },
      state: 'blocked',
    });
    expect(state.maps['test']?.entities[0]?.state).toBe('locked');
  });

  it('oeffnet die verriegelte Tuer mit passendem Schluessel', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      entities: [{ kind: 'door', defId: 'door', pos: { x: 2, y: 1 }, locked: 'redkey' }],
    });
    state.player.keys.push('redkey');
    const result = interactAction(state, content);
    expect(result.ok && result.events[0]).toMatchObject({ type: 'doorChanged', state: 'open' });
  });

  it('loest use-Trigger vor dem Spieler aus', () => {
    const { state, content } = setup({
      spawn: EAST_SPAWN,
      triggers: [
        {
          id: 'lever',
          pos: { x: 2, y: 1 },
          on: 'use',
          once: false,
          actions: [{ type: 'message', text: 'clack' }],
        },
      ],
    });
    const result = interactAction(state, content);
    expect(result.ok && result.events).toEqual([{ type: 'message', text: 'clack' }]);
  });

  it('lehnt ab, wenn vorne nichts ist', () => {
    const { state, content } = setup({ spawn: EAST_SPAWN });
    expect(interactAction(state, content)).toEqual({
      ok: false,
      reason: 'nothing to interact with',
    });
  });
});

describe('useConsumableAction', () => {
  it('heilt bis maximal maxHealth und verbraucht das Item', () => {
    const { state, content } = setup();
    state.player.consumables['medkit'] = 1;
    state.player.health = 40;
    const result = useConsumableAction(state, content, 'medkit');
    expect(result.ok).toBe(true);
    expect(state.player.health).toBe(50);
    expect(state.player.consumables['medkit']).toBe(0);
  });

  it('verbraucht ein Ruestungsteil, ohne schon zu wirken', () => {
    // Ruestung kommt ab Phase 3.6 ueber Ausruestungsinstanzen, nicht ueber
    // Verbrauchsgueter. Hier zaehlt nur, dass der Bestand sinkt.
    const { state, content } = setup();
    state.player.consumables['shield'] = 1;
    const result = useConsumableAction(state, content, 'shield');
    expect(result.ok).toBe(true);
    expect(state.player.consumables['shield']).toBe(0);
  });

  it('legt Effekte von Powerups an', () => {
    const { state, content } = setup();
    state.player.consumables['stim'] = 1;
    useConsumableAction(state, content, 'stim');
    expect(state.player.effects).toEqual([
      { id: 'burn', remainingTurns: 3, magnitude: 4, sourceType: 'fire' },
    ]);
  });

  it('lehnt fehlende, unbekannte und Questgegenstaende ab', () => {
    const { state, content } = setup();
    expect(useConsumableAction(state, content, 'medkit')).toEqual({
      ok: false,
      reason: 'item not in inventory',
    });
    state.player.consumables['ghost'] = 1;
    expect(useConsumableAction(state, content, 'ghost')).toEqual({ ok: false, reason: 'unknown item' });
    state.player.consumables['relic'] = 1;
    expect(useConsumableAction(state, content, 'relic')).toEqual({
      ok: false,
      reason: 'quest item cannot be used',
    });
  });
});

describe('switchWeaponAction', () => {
  it('wechselt auf eine besessene Waffe', () => {
    const { state, content } = setup();
    state.player.weapons.push('pistol');
    const result = switchWeaponAction(state, content, 'pistol');
    expect(result.ok).toBe(true);
    expect(state.player.equippedWeaponId).toBe('pistol');
  });

  it('lehnt fremde und bereits gefuehrte Waffen ab', () => {
    const { state, content } = setup();
    expect(switchWeaponAction(state, content, 'pistol')).toEqual({
      ok: false,
      reason: 'weapon not owned',
    });
    expect(switchWeaponAction(state, content, 'fists')).toEqual({
      ok: false,
      reason: 'weapon already equipped',
    });
  });
});

describe('spendAttributeAction', () => {
  it('verteilt einen Punkt und verwirft den Rundencache', () => {
    const { state, content } = setup();
    state.player.unspentAttributePoints = 1;

    const before = playerDerived(state, content).maxHealth;
    const result = spendAttributeAction(state, 'vitality');

    expect(result.ok).toBe(true);
    expect(state.player.attributes.vitality).toBe(11);
    expect(playerDerived(state, content).maxHealth).toBe(before + 3);
  });

  it('lehnt ohne offene Punkte ab', () => {
    const { state } = setup();
    expect(spendAttributeAction(state, 'strength')).toEqual({
      ok: false,
      reason: 'no attribute point available',
    });
  });
});

describe('currentScene', () => {
  it('liefert Karte und Laufzeitzustand der aktuellen Sohle', () => {
    const { state, content } = setup();
    const here = currentScene(state, content);
    expect(here?.map.id).toBe('test');
    expect(here?.mapState).toBe(state.maps['test']);
  });

  it('liefert null bei unbekannter Karte', () => {
    const { state, content } = setup();
    state.currentMapId = 'weg';
    expect(currentScene(state, content)).toBeNull();
  });
});
