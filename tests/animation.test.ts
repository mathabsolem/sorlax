import { describe, expect, it } from 'vitest';
import {
  AnimationState,
  DEATH_MS,
  ENEMY_ATTACK_MS,
  FLASH_MS,
  IDLE_FPS,
  MOVE_MS,
  PAIN_MS,
  TURN_MS,
  WEAPON_MS,
  lerpAngle,
  normalizeAngle,
} from '../src/render/animation';
import { facingToAngle } from '../src/render/camera';
import type { EnemyDef, GameEvent } from '../src/core/types';
import { noResistances, setup } from './fixtures/world';

const deg = (value: number): number => (value * Math.PI) / 180;

function enemyDef(): EnemyDef {
  return {
    id: 'grunt',
    archetype: 'test',
    element: 'physical',
    name: 'Grunt',
    baseHealth: 10,
    baseArmor: 0,
    baseAccuracy: 5,
    baseEvasion: 0,
    resistances: noResistances(),
    speed: 1,
    behavior: 'melee',
    aggroRange: 5,
    preferredRange: 1,
    weaponId: 'fists',
    baseXp: 10,
    spriteWidth: 0.8,
    frames: {
      idle: ['idle_0', 'idle_1'],
      attack: ['attack_0'],
      pain: ['pain_0'],
      death: ['death_0', 'death_1'],
    },
  };
}

describe('normalizeAngle', () => {
  it('bringt jeden Winkel nach [0, 2 Pi)', () => {
    expect(normalizeAngle(deg(370))).toBeCloseTo(deg(10), 10);
    expect(normalizeAngle(deg(-90))).toBeCloseTo(deg(270), 10);
  });
});

describe('lerpAngle', () => {
  // Test 5 aus PHASE_3
  it('laeuft von 350 auf 10 Grad ueber 0, nicht rueckwaerts ueber 180', () => {
    const mid = lerpAngle(deg(350), deg(10), 0.5);
    expect(normalizeAngle(mid)).toBeCloseTo(0, 10);
    // Der Weg ueber 180 Grad wuerde bei 180 landen.
    expect(Math.abs(normalizeAngle(mid) - Math.PI)).toBeGreaterThan(deg(90));
  });

  it('trifft an den Enden genau die Ausgangswinkel', () => {
    expect(lerpAngle(deg(350), deg(10), 0)).toBeCloseTo(deg(350), 10);
    expect(normalizeAngle(lerpAngle(deg(350), deg(10), 1))).toBeCloseTo(deg(10), 10);
  });

  it('nimmt auch andersherum den kurzen Weg', () => {
    const mid = lerpAngle(deg(10), deg(350), 0.5);
    expect(normalizeAngle(mid)).toBeCloseTo(0, 10);
  });
});

describe('AnimationState', () => {
  it('interpoliert eine Bewegung zwischen Kachelmitten', () => {
    const animation = new AnimationState();
    animation.consumeEvents([
      { type: 'moved', who: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
    ]);
    animation.advance(MOVE_MS / 2);
    const at = animation.positionOf('player', { x: 2, y: 1 });
    expect(at.x).toBeCloseTo(2, 6);
    expect(at.y).toBeCloseTo(1.5, 6);
  });

  it('faellt ohne Tween auf die Kachelmitte zurueck', () => {
    const animation = new AnimationState();
    expect(animation.positionOf(7, { x: 3, y: 4 })).toEqual({ x: 3.5, y: 4.5 });
  });

  it('dreht den Spieler auf den Winkel des Ereignisses', () => {
    const animation = new AnimationState();
    animation.consumeEvents([{ type: 'turned', who: 'player', facing: 1 }]);
    animation.advance(TURN_MS);
    expect(animation.angleOf()).toBeCloseTo(facingToAngle(1), 10);
  });

  // Test 6 aus PHASE_3
  it('ist nach Ablauf aller Tweens wieder ruhig', () => {
    const animation = new AnimationState();
    const events: GameEvent[] = [
      { type: 'moved', who: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
      { type: 'turned', who: 'player', facing: 2 },
      { type: 'attack', attacker: 'player', target: 3, hit: true, damage: 4, crit: false, damageType: 'physical' },
      { type: 'attack', attacker: 5, target: 'player', hit: true, damage: 2, crit: false, damageType: 'physical' },
    ];
    animation.consumeEvents(events);
    expect(animation.isAnimating()).toBe(true);

    const longest = Math.max(MOVE_MS, TURN_MS, WEAPON_MS, ENEMY_ATTACK_MS);
    animation.advance(longest + 1);
    expect(animation.isAnimating()).toBe(false);
  });

  it('haelt den Trefferblitz ausserhalb der Sperre', () => {
    const animation = new AnimationState();
    animation.consumeEvents([
      { type: 'attack', attacker: 5, target: 'player', hit: true, damage: 2, crit: false, damageType: 'physical' },
    ]);
    animation.advance(ENEMY_ATTACK_MS + 1);
    expect(animation.isAnimating()).toBe(false);
    expect(animation.flashAlpha()).toBeGreaterThan(0);

    animation.advance(FLASH_MS);
    expect(animation.flashAlpha()).toBe(0);
  });

  it('faehrt die Waffenansicht zurueck und wieder vor', () => {
    const animation = new AnimationState();
    animation.consumeEvents([
      { type: 'attack', attacker: 'player', target: 1, hit: false, damage: 0, crit: false, damageType: 'physical' },
    ]);
    expect(animation.weaponRecoil()).toBeCloseTo(0, 6);
    animation.advance(WEAPON_MS / 2);
    expect(animation.weaponRecoil()).toBeCloseTo(1, 6);
    animation.advance(WEAPON_MS);
    expect(animation.weaponRecoil()).toBe(0);
  });

  it('waehlt Attack-, Pain- und Idle-Frames', () => {
    const animation = new AnimationState();
    const def = enemyDef();
    expect(animation.frameOf(1, def)).toBe('idle_0');

    animation.consumeEvents([
      { type: 'attack', attacker: 1, target: 'player', hit: false, damage: 0, crit: false, damageType: 'physical' },
    ]);
    expect(animation.frameOf(1, def)).toBe('attack_0');

    animation.advance(ENEMY_ATTACK_MS + 1);
    animation.consumeEvents([
      { type: 'attack', attacker: 'player', target: 1, hit: true, damage: 3, crit: false, damageType: 'physical' },
    ]);
    expect(animation.frameOf(1, def)).toBe('pain_0');
  });

  it('treibt Idle-Frames ueber die Renderzeit, nicht ueber Runden', () => {
    const animation = new AnimationState();
    const def = enemyDef();
    const frameMs = 1000 / IDLE_FPS;
    expect(animation.frameOf(1, def)).toBe('idle_0');
    animation.advance(frameMs + 10);
    expect(animation.frameOf(1, def)).toBe('idle_1');
    animation.advance(frameMs);
    expect(animation.frameOf(1, def)).toBe('idle_0');
  });

  it('laesst Pain-Frames vor dem Waffentween ablaufen und sperrt selbst nicht', () => {
    const animation = new AnimationState();
    const def = enemyDef();
    animation.consumeEvents([
      { type: 'attack', attacker: 'player', target: 1, hit: true, damage: 3, crit: false, damageType: 'physical' },
    ]);
    expect(animation.frameOf(1, def)).toBe('pain_0');

    // Pain ist kuerzer als der Waffentween, danach steht der Gegner wieder still.
    animation.advance(PAIN_MS + 1);
    expect(animation.frameOf(1, def)).toBe('idle_0');
    expect(PAIN_MS).toBeLessThan(WEAPON_MS);
    expect(animation.isAnimating()).toBe(true);

    animation.advance(WEAPON_MS);
    expect(animation.isAnimating()).toBe(false);
  });

  it('legt bei died eine Leiche ab, deren letzter Frame liegen bleibt', () => {
    const { state } = setup({ entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }] });
    const animation = new AnimationState();
    animation.observe(state);

    animation.consumeEvents([{ type: 'died', who: 1 }]);
    const defs = { grunt: enemyDef() };

    expect(animation.corpseFrames(defs)[0]).toMatchObject({ x: 3.5, y: 1.5, frame: 'death_0' });
    animation.advance(DEATH_MS);
    expect(animation.corpseFrames(defs)[0]?.frame).toBe('death_1');
    animation.advance(DEATH_MS * 5);
    expect(animation.corpseFrames(defs)[0]?.frame).toBe('death_1');
    // Der Tod blockiert die Eingabe nicht.
    expect(animation.isAnimating()).toBe(false);
  });

  it('verwirft Leichen und Tweens beim Kartenwechsel', () => {
    const { state } = setup({ entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }] });
    const animation = new AnimationState();
    animation.observe(state);
    animation.consumeEvents([{ type: 'died', who: 1 }]);
    animation.clearCorpses();
    expect(animation.corpseFrames({ grunt: enemyDef() })).toEqual([]);

    animation.consumeEvents([
      { type: 'moved', who: 'player', from: { x: 1, y: 1 }, to: { x: 2, y: 1 } },
    ]);
    animation.snapTo(state);
    expect(animation.isAnimating()).toBe(false);
    expect(animation.angleOf()).toBeCloseTo(facingToAngle(state.player.facing), 10);
  });
});
