/**
 * Angriffe des Spielers, aus playerActions.test.ts herausgeloest.
 */
import { describe, expect, it } from 'vitest';
import { attackAction } from '../src/core/attack';
import { createInstance } from '../src/core/items';
import { invalidatePlayerDerived, playerDerived } from '../src/core/turn';
import { setup } from './fixtures/world';

describe('attackAction', () => {
  it('lehnt einen Angriff ohne Munition ab', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'tank', pos: { x: 3, y: 1 } }],
    });
    state.player.weapons.push('pistol');
    state.player.equippedWeaponId = 'pistol';
    expect(attackAction(state, content)).toEqual({ ok: false, reason: 'out of ammo' });
  });

  it('verbraucht Munition und trifft eine Entscheidung', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'tank', pos: { x: 3, y: 1 } }],
    });
    state.player.weapons.push('pistol');
    state.player.equippedWeaponId = 'pistol';
    state.player.ammo['bullets'] = 2;
    const result = attackAction(state, content);
    expect(result.ok).toBe(true);
    expect(result.ok && result.events[0]?.type).toBe('attack');
    expect(state.player.ammo['bullets']).toBe(1);
  });

  it('lehnt Ziele ausser Reichweite und ohne Sichtlinie ab', () => {
    const outOfRange = setup({
      entities: [{ kind: 'enemy', defId: 'tank', pos: { x: 3, y: 1 } }],
    });
    expect(attackAction(outOfRange.state, outOfRange.content, 1)).toEqual({
      ok: false,
      reason: 'target out of range',
    });

    const blocked = setup({
      entities: [
        { kind: 'door', defId: 'door', pos: { x: 3, y: 1 } },
        { kind: 'enemy', defId: 'tank', pos: { x: 4, y: 1 } },
      ],
    });
    blocked.state.player.weapons.push('pistol');
    blocked.state.player.equippedWeaponId = 'pistol';
    blocked.state.player.ammo['bullets'] = 5;
    expect(attackAction(blocked.state, blocked.content, 2)).toEqual({
      ok: false,
      reason: 'no line of sight',
    });
  });

  it('waehlt ohne targetId den naechsten Gegner', () => {
    const { state, content } = setup({
      entities: [
        { kind: 'enemy', defId: 'tank', pos: { x: 4, y: 1 } },
        { kind: 'enemy', defId: 'tank', pos: { x: 1, y: 4 } },
        { kind: 'enemy', defId: 'tank', pos: { x: 3, y: 1 } },
      ],
    });
    state.player.weapons.push('pistol');
    state.player.equippedWeaponId = 'pistol';
    state.player.ammo['bullets'] = 5;
    const result = attackAction(state, content);
    // (3,1) liegt auf Distanz 2 und damit naeher als (4,1) und (1,4).
    expect(result.ok && result.events[0]).toMatchObject({ type: 'attack', target: 3 });
  });

  it('nimmt bei gleicher Distanz die kleinere Entity-Id', () => {
    const { state, content } = setup({
      entities: [
        { kind: 'enemy', defId: 'tank', pos: { x: 3, y: 1 } },
        { kind: 'enemy', defId: 'tank', pos: { x: 1, y: 3 } },
      ],
    });
    state.player.weapons.push('pistol');
    state.player.equippedWeaponId = 'pistol';
    state.player.ammo['bullets'] = 5;
    const result = attackAction(state, content);
    expect(result.ok && result.events[0]).toMatchObject({ type: 'attack', target: 1 });
  });

  it('lehnt ab, wenn kein Ziel sichtbar ist', () => {
    const { state, content } = setup();
    expect(attackAction(state, content)).toEqual({ ok: false, reason: 'no target' });
  });

  it('vergibt XP und raeumt den toten Gegner ab', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 2, y: 1 } }],
    });
    let killed = false;
    for (let i = 0; i < 20 && !killed; i++) {
      const enemy = state.maps['test']?.entities[0];
      if (enemy === undefined) break;
      enemy.health = 1;
      const result = attackAction(state, content);
      killed = result.ok && result.events.some((event) => event.type === 'died');
    }
    expect(killed).toBe(true);
    expect(state.maps['test']?.entities).toHaveLength(0);
    // baseXp 10, monsterLevel 2 auf Sohle 1 -> round(10 * 1.1) = 11
    expect(state.player.xp).toBe(11);
    expect(state.player.level).toBe(2);
  });
});

describe('Munitionsverbrauch', () => {
  it('zieht ohne Ausruestung jeden Schuss ab', () => {
    const { state, content } = setup({
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 4, y: 1 } }],
    });
    state.player.weapons.push('pistol');
    state.player.equippedWeaponId = 'pistol';
    state.player.ammo['bullets'] = 3;

    expect(attackAction(state, content).ok).toBe(true);
    expect(state.player.ammo['bullets']).toBe(2);
  });

  // ammoSaveChance verhindert den Verbrauch, nicht den Schuss (SPEC 4.4).
  it('spart bei voller Chance jede Patrone, feuert aber trotzdem', () => {
    const { state, content } = setup({
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 4, y: 1 } }],
    });
    state.player.weapons.push('pistol');
    state.player.equippedWeaponId = 'pistol';
    state.player.ammo['bullets'] = 3;

    const belt = createInstance(
      state,
      'belt_strap',
      20,
      'rare',
      [{ affixId: 'suf_of_thrift', value: 100 }],
      content
    );
    if (belt === null) throw new Error('kein Grundtyp');
    state.player.equipment['belt'] = belt;
    invalidatePlayerDerived(state);
    expect(playerDerived(state, content).ammoSaveChance).toBe(1);

    const result = attackAction(state, content);

    expect(result.ok).toBe(true);
    expect(state.player.ammo['bullets']).toBe(3);
    expect(result.ok && result.events.some((event) => event.type === 'attack')).toBe(true);
  });
});

describe('Flaechenschaden ueber attackAction', () => {
  it('trifft Nachbarn des Ziels mit der Explosion', () => {
    const { state, content } = setup({
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
      entities: [
        { kind: 'enemy', defId: 'tank', pos: { x: 4, y: 1 } },
        { kind: 'enemy', defId: 'tank', pos: { x: 5, y: 1 } },
      ],
    });
    state.player.weapons.push('launcher');
    state.player.equippedWeaponId = 'launcher';
    state.player.ammo['rockets'] = 2;

    const neighbour = state.maps['test']?.entities[1];
    const before = neighbour?.health;
    const healthBefore = state.player.health;

    const result = attackAction(state, content);

    expect(result.ok).toBe(true);
    expect(neighbour?.health).toBeLessThan(before ?? 0);
    // Der Spieler steht drei Kacheln entfernt, ausserhalb des Radius von 2.
    expect(state.player.health).toBe(healthBefore);
  });
});
