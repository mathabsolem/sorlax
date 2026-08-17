import { describe, expect, it } from 'vitest';
import {
  applyArmor,
  applySplash,
  hitChance,
  resolveAttack,
  rollDamage,
  splashDamage,
} from '../src/core/combat';
import { Rng } from '../src/core/rng';
import { WEAPONS, setup } from './fixtures/world';
import type { Stats, WeaponDef } from '../src/core/types';

function stats(overrides: Partial<Stats> = {}): Stats {
  return { health: 50, maxHealth: 50, armor: 0, accuracy: 10, evasion: 5, ...overrides };
}

function weapon(): WeaponDef {
  const pistol = WEAPONS['pistol'];
  if (!pistol) throw new Error('missing pistol');
  return pistol;
}

describe('hitChance', () => {
  it('folgt der Formel aus SPEC 4.1', () => {
    const attacker = stats({ accuracy: 10 });
    const defender = stats({ evasion: 5 });
    // 0.75 + (10 - 5) * 0.02 - 0 = 0.85
    expect(hitChance(attacker, defender, weapon(), 3)).toBeCloseTo(0.85, 10);
  });

  it('zieht die Reichweitenstrafe ab', () => {
    // Distanz 5, optimalRange 3 -> Strafe 0.1
    expect(hitChance(stats(), stats(), weapon(), 5)).toBeCloseTo(0.85 - 0.1, 10);
  });

  it('klemmt auf 0.05 bis 0.95', () => {
    expect(hitChance(stats({ accuracy: 200 }), stats(), weapon(), 1)).toBe(0.95);
    expect(hitChance(stats(), stats({ evasion: 200 }), weapon(), 1)).toBe(0.05);
  });
});

describe('rollDamage', () => {
  it('bleibt ohne Krit in den Waffengrenzen', () => {
    const rng = new Rng(11);
    const fists = WEAPONS['fists'];
    if (!fists) throw new Error('missing fists');
    for (let i = 0; i < 500; i++) {
      const { raw, crit } = rollDamage(rng, fists);
      expect(crit).toBe(false);
      expect(raw).toBeGreaterThanOrEqual(2);
      expect(raw).toBeLessThanOrEqual(4);
    }
  });

  it('verdoppelt bei critChance 1', () => {
    const always: WeaponDef = { ...weapon(), critChance: 1, dmgMin: 4, dmgMax: 4 };
    const { raw, crit } = rollDamage(new Rng(3), always);
    expect(crit).toBe(true);
    expect(raw).toBe(8);
  });
});

describe('applyArmor', () => {
  it('zieht die halbe Ruestung ab und laesst mindestens 1', () => {
    expect(applyArmor(10, 4)).toBe(8);
    expect(applyArmor(10, 5)).toBe(8);
    expect(applyArmor(2, 100)).toBe(1);
  });
});

describe('splashDamage', () => {
  it('faellt linear mit der Distanz', () => {
    expect(splashDamage(20, 2, 0, 0)).toBe(20);
    expect(splashDamage(20, 2, 1, 0)).toBe(10);
    expect(splashDamage(20, 2, 2, 0)).toBe(1);
  });

  it('beruecksichtigt Ruestung', () => {
    expect(splashDamage(20, 2, 0, 6)).toBe(17);
  });
});

describe('resolveAttack', () => {
  it('liefert bei sicherem Treffer ein attack-Event und zieht Leben ab', () => {
    const sure: WeaponDef = { ...weapon(), dmgMin: 5, dmgMax: 5, critChance: 0 };
    const defender = { ref: 1 as const, stats: stats({ health: 20, evasion: -100 }) };
    const events = resolveAttack(
      new Rng(7),
      { ref: 'player', stats: stats() },
      defender,
      sure,
      1
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'attack', hit: true, damage: 5 });
    expect(defender.stats.health).toBe(15);
  });

  it('haengt bei toedlichem Schaden ein died-Event an', () => {
    const sure: WeaponDef = { ...weapon(), dmgMin: 50, dmgMax: 50, critChance: 0 };
    const defender = { ref: 2 as const, stats: stats({ health: 10, evasion: -100 }) };
    const events = resolveAttack(new Rng(7), { ref: 'player', stats: stats() }, defender, sure, 1);
    expect(events[1]).toEqual({ type: 'died', who: 2 });
    expect(defender.stats.health).toBe(0);
  });

  it('liefert bei Fehlschuss ein attack-Event ohne Schaden', () => {
    const defender = { ref: 3 as const, stats: stats({ evasion: 1000 }) };
    const events = resolveAttack(
      new Rng(7),
      { ref: 'player', stats: stats() },
      defender,
      weapon(),
      1
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'attack', hit: false, damage: 0 });
    expect(defender.stats.health).toBe(50);
  });
});

describe('applySplash', () => {
  it('trifft Gegner im Radius und den Spieler nur zur Haelfte', () => {
    const { state } = setup({
      entities: [
        { kind: 'enemy', defId: 'tank', pos: { x: 3, y: 1 } },
        { kind: 'enemy', defId: 'tank', pos: { x: 6, y: 6 } },
      ],
    });
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');

    const events = applySplash(
      state.player,
      mapState,
      { x: 2, y: 1 },
      { radius: 2, baseDamage: 20 },
      'player'
    );

    const near = mapState.entities.find((entity) => entity.pos.x === 3);
    const far = mapState.entities.find((entity) => entity.pos.x === 6);
    expect(near?.stats?.health).toBe(999 - 10);
    expect(far?.stats?.health).toBe(999);
    expect(near?.active).toBe(true);
    // Spieler steht auf (1,1), Distanz 1 -> 10 voll, davon 50 Prozent.
    expect(state.player.stats.health).toBe(45);
    expect(events.filter((event) => event.type === 'attack')).toHaveLength(2);
  });

  it('trifft den Spieler voll wenn ein Gegner die Explosion ausloest', () => {
    const { state } = setup();
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    applySplash(state.player, mapState, { x: 1, y: 1 }, { radius: 2, baseDamage: 20 }, 5);
    expect(state.player.stats.health).toBe(30);
  });
});
