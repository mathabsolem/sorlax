import { describe, expect, it } from 'vitest';
import {
  applyArmor,
  applyResistance,
  applySplash,
  hitChance,
  resolveAttack,
  rollDamage,
  splashDamage,
  typeBonus,
} from '../src/core/combat';
import type { CombatSide, SplashTarget } from '../src/core/combat';
import { zeroResistances } from '../src/core/derived';
import { Rng } from '../src/core/rng';
import { WEAPONS } from './fixtures/world';
import type { DerivedStats, Resistances, WeaponDef } from '../src/core/types';

function derived(overrides: Partial<DerivedStats> = {}): DerivedStats {
  return {
    maxHealth: 50,
    accuracy: 10,
    evasion: 5,
    armor: 0,
    meleeBonus: 0,
    elemBonus: 0,
    critBonus: 0,
    resistances: zeroResistances(),
    lightRadius: 4,
    freeActionChance: 0,
    ammoSaveChance: 0,
    ...overrides,
  };
}

function resist(type: keyof Resistances, value: number): Resistances {
  const all = zeroResistances();
  all[type] = value;
  return all;
}

function weapon(overrides: Partial<WeaponDef> = {}): WeaponDef {
  const pistol = WEAPONS['pistol'];
  if (!pistol) throw new Error('missing pistol');
  return { ...pistol, ...overrides };
}

/** Waffe mit festem Wurf und ohne Krit, damit der Schaden nachrechenbar ist. */
function fixedWeapon(damage: number, overrides: Partial<WeaponDef> = {}): WeaponDef {
  return weapon({ dmgMin: damage, dmgMax: damage, critChance: 0, ...overrides });
}

function side(ref: CombatSide['ref'], stats: DerivedStats, health = 1000): CombatSide {
  return { ref, stats, vitals: { health } };
}

describe('hitChance', () => {
  it('folgt der Formel aus SPEC 4.1', () => {
    // 0.75 + (10 - 5) * 0.02 = 0.85
    expect(hitChance(derived(), derived(), weapon(), 3)).toBeCloseTo(0.85, 10);
  });

  it('zieht die Reichweitenstrafe ab', () => {
    expect(hitChance(derived(), derived(), weapon(), 5)).toBeCloseTo(0.75, 10);
  });

  it('klemmt auf 0.05 bis 0.95', () => {
    expect(hitChance(derived({ accuracy: 200 }), derived(), weapon(), 1)).toBe(0.95);
    expect(hitChance(derived(), derived({ evasion: 200 }), weapon(), 1)).toBe(0.05);
  });
});

describe('typeBonus', () => {
  it('nimmt den Nahkampfbonus nur bei physisch und optimalRange bis 1', () => {
    const stats = derived({ meleeBonus: 0.2, elemBonus: 0.5 });
    expect(typeBonus(stats, weapon({ damageType: 'physical', optimalRange: 1 }))).toBe(0.2);
    expect(typeBonus(stats, weapon({ damageType: 'physical', optimalRange: 4 }))).toBe(0);
  });

  it('nimmt bei allem Nichtphysischen den Elementarbonus', () => {
    const stats = derived({ meleeBonus: 0.2, elemBonus: 0.5 });
    expect(typeBonus(stats, weapon({ damageType: 'fire', optimalRange: 1 }))).toBe(0.5);
    expect(typeBonus(stats, weapon({ damageType: 'void', optimalRange: 9 }))).toBe(0.5);
  });
});

describe('rollDamage', () => {
  it('bleibt ohne Bonus und ohne Krit in den Waffengrenzen', () => {
    const rng = new Rng(11);
    const fists = WEAPONS['fists'];
    if (!fists) throw new Error('missing fists');
    for (let i = 0; i < 500; i++) {
      const { raw, crit } = rollDamage(rng, fists, derived());
      expect(crit).toBe(false);
      expect(raw).toBeGreaterThanOrEqual(2);
      expect(raw).toBeLessThanOrEqual(4);
    }
  });

  it('rechnet den Typbonus vor dem Krit ein', () => {
    // Wurf 10, Bonus 20 Prozent -> 12, danach Krit -> 24
    const always = fixedWeapon(10, { critChance: 1, damageType: 'physical', optimalRange: 1 });
    const { raw, crit } = rollDamage(new Rng(3), always, derived({ meleeBonus: 0.2 }));
    expect(crit).toBe(true);
    expect(raw).toBe(24);
  });
});

describe('applyResistance und applyArmor', () => {
  it('halbiert bei 50 Prozent Resistenz', () => {
    expect(applyResistance(20, 50)).toBe(10);
  });

  it('erhoeht bei negativer Resistenz', () => {
    expect(applyResistance(20, -50)).toBe(30);
  });

  it('laesst mindestens 1 Schaden stehen', () => {
    expect(applyResistance(2, 99)).toBe(1);
    expect(applyArmor(2, 100)).toBe(1);
  });

  it('zieht die halbe Ruestung ab', () => {
    expect(applyArmor(10, 4)).toBe(8);
    expect(applyArmor(10, 5)).toBe(8);
  });
});

describe('Reihenfolge aus SPEC 4.2', () => {
  // Test 5 aus PHASE_3_5
  it('rechnet erst Resistenz, dann Ruestung', () => {
    // Wurf 20, Resistenz 50, Ruestung 10 -> floor(20 * 0.5) = 10, dann 10 - 5 = 5
    expect(applyArmor(applyResistance(20, 50), 10)).toBe(5);
    // Umgekehrt kaeme etwas anderes heraus, damit ist die Reihenfolge festgenagelt.
    expect(applyResistance(applyArmor(20, 10), 50)).not.toBe(5);
  });

  it('bildet die Kette auch ueber resolveAttack ab', () => {
    const attacker = side('player', derived({ accuracy: 200 }));
    const defender = side(1, derived({ evasion: -200, armor: 10, resistances: resist('fire', 50) }));
    const events = resolveAttack(
      new Rng(5),
      attacker,
      defender,
      fixedWeapon(20, { damageType: 'fire' }),
      1
    );
    expect(events[0]).toMatchObject({ type: 'attack', hit: true, damage: 5, damageType: 'fire' });
  });
});

describe('Resistenzen im Angriff', () => {
  function fireDamage(resistValue: number): number {
    const attacker = side('player', derived({ accuracy: 200 }));
    const defender = side(1, derived({ evasion: -200, resistances: resist('fire', resistValue) }));
    const events = resolveAttack(
      new Rng(9),
      attacker,
      defender,
      fixedWeapon(20, { damageType: 'fire' }),
      1
    );
    const first = events[0];
    return first !== undefined && first.type === 'attack' ? first.damage : -1;
  }

  // Test 3 aus PHASE_3_5
  it('richtet gegen 80 Resistenz deutlich weniger an als gegen 0, aber mindestens 1', () => {
    const none = fireDamage(0);
    const high = fireDamage(80);
    expect(none).toBe(20);
    expect(high).toBe(4);
    expect(high).toBeLessThan(none / 2);
    expect(fireDamage(100)).toBeGreaterThanOrEqual(1);
    expect(fireDamage(999)).toBeGreaterThanOrEqual(1);
  });

  // Test 4 aus PHASE_3_5
  it('richtet gegen minus 50 Resistenz mehr an als gegen 0', () => {
    expect(fireDamage(-50)).toBeGreaterThan(fireDamage(0));
    expect(fireDamage(-50)).toBe(30);
  });
});

describe('resolveAttack', () => {
  it('zieht Leben ab und meldet den Schadenstyp', () => {
    const defender = side(1, derived({ evasion: -200 }), 20);
    const events = resolveAttack(
      new Rng(7),
      side('player', derived({ accuracy: 200 })),
      defender,
      fixedWeapon(5, { damageType: 'poison' }),
      1
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'attack', hit: true, damage: 5, damageType: 'poison' });
    expect(defender.vitals.health).toBe(15);
  });

  it('haengt bei toedlichem Schaden ein died-Ereignis an', () => {
    const defender = side(2, derived({ evasion: -200 }), 10);
    const events = resolveAttack(
      new Rng(7),
      side('player', derived({ accuracy: 200 })),
      defender,
      fixedWeapon(50),
      1
    );
    expect(events[1]).toEqual({ type: 'died', who: 2 });
    expect(defender.vitals.health).toBe(0);
  });

  it('meldet einen Fehlschuss ohne Schaden', () => {
    const defender = side(3, derived({ evasion: 1000 }), 50);
    const events = resolveAttack(
      new Rng(7),
      side('player', derived()),
      defender,
      weapon(),
      1
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'attack', hit: false, damage: 0 });
    expect(defender.vitals.health).toBe(50);
  });
});

describe('splashDamage', () => {
  it('faellt linear mit der Distanz', () => {
    expect(splashDamage(20, 2, 0, 0, 0)).toBe(20);
    expect(splashDamage(20, 2, 1, 0, 0)).toBe(10);
    expect(splashDamage(20, 2, 2, 0, 0)).toBe(1);
  });

  it('beruecksichtigt Resistenz und Ruestung', () => {
    expect(splashDamage(20, 2, 0, 50, 0)).toBe(10);
    expect(splashDamage(20, 2, 0, 0, 6)).toBe(17);
  });
});

describe('applySplash', () => {
  function target(ref: SplashTarget['ref'], x: number, health: number, res = 0): SplashTarget {
    return {
      ref,
      stats: derived({ resistances: resist('fire', res) }),
      vitals: { health },
      pos: { x, y: 1 },
    };
  }

  it('trifft alles im Radius und den Spieler nur zur Haelfte', () => {
    const player = target('player', 1, 100);
    const near = target(1, 3, 1000);
    const far = target(2, 9, 1000);

    const events = applySplash(
      [player, near, far],
      { x: 2, y: 1 },
      { radius: 2, baseDamage: 20 },
      'fire',
      'player'
    );

    expect(near.vitals.health).toBe(1000 - 10);
    expect(far.vitals.health).toBe(1000);
    // Spieler auf Distanz 1: voll waeren 10, eigene Explosion halbiert auf 5.
    expect(player.vitals.health).toBe(95);
    expect(events.filter((event) => event.type === 'attack')).toHaveLength(2);
  });

  it('trifft den Spieler voll, wenn ein Gegner ausloest', () => {
    const player = target('player', 1, 100);
    applySplash([player], { x: 1, y: 1 }, { radius: 2, baseDamage: 20 }, 'fire', 5);
    expect(player.vitals.health).toBe(80);
  });

  it('nimmt die Resistenz des Ziels mit', () => {
    const soft = target(1, 1, 1000, 0);
    const tough = target(2, 1, 1000, 75);
    applySplash([soft, tough], { x: 1, y: 1 }, { radius: 2, baseDamage: 20 }, 'fire', 9);
    expect(1000 - soft.vitals.health).toBeGreaterThan(1000 - tough.vitals.health);
  });

  it('laesst einen ausloesenden Gegner selbst aus', () => {
    const self = target(5, 1, 1000);
    applySplash([self], { x: 1, y: 1 }, { radius: 2, baseDamage: 20 }, 'fire', 5);
    expect(self.vitals.health).toBe(1000);
  });
});
