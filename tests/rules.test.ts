/**
 * Tabellen und Konstanten aus SPEC v1.2 und RPG.md.
 */
import { describe, expect, it } from 'vitest';
import { DIFFICULTY_MODIFIERS, DIFFICULTY_ORDER, modifiersFor } from '../src/core/difficulty';
import {
  DRAIN_ARMOR_PENALTY,
  EFFECT_DEFS,
  EFFECT_RESIST_THRESHOLD,
  isEffectId,
} from '../src/core/effectDefs';
import { MAX_ATTRIBUTE } from '../src/core/progression';
import { MAX_INVENTORY, START_ATTRIBUTE, startAttributes } from '../src/core/state';
import { DAMAGE_TYPES, EQUIP_SLOTS } from '../src/core/types';

describe('Schwierigkeitsgrade', () => {
  it('bildet die Tabelle aus SPEC Abschnitt 8 ab', () => {
    expect(DIFFICULTY_MODIFIERS.normal).toMatchObject({
      levelOffset: 0,
      playerResistPenalty: 0,
      healthFactor: 1.0,
      enemyResistBonus: 0,
    });
    expect(DIFFICULTY_MODIFIERS.hard).toMatchObject({
      levelOffset: 18,
      playerResistPenalty: -40,
      healthFactor: 1.9,
      damageFactor: 1.6,
      xpFactor: 2.0,
      enemyResistBonus: 25,
    });
    expect(DIFFICULTY_MODIFIERS.nightmare).toMatchObject({
      levelOffset: 36,
      playerResistPenalty: -100,
      healthFactor: 3.2,
      damageFactor: 2.4,
      xpFactor: 3.0,
      enemyResistBonus: 50,
    });
  });

  it('kennt die Reihenfolge der Freischaltung', () => {
    expect([...DIFFICULTY_ORDER]).toEqual(['normal', 'hard', 'nightmare']);
  });

  it('modifiersFor liefert denselben Eintrag wie die Tabelle', () => {
    expect(modifiersFor('hard')).toBe(DIFFICULTY_MODIFIERS.hard);
  });
});

describe('Effekttabelle', () => {
  it('bildet SPEC Abschnitt 4.5 ab', () => {
    expect(EFFECT_DEFS.burn).toMatchObject({ sourceType: 'fire', turns: 3, magnitude: 4 });
    expect(EFFECT_DEFS.toxin).toMatchObject({ sourceType: 'poison', turns: 6, magnitude: 2 });
    expect(EFFECT_DEFS.chill).toMatchObject({ sourceType: 'ice', turns: 4 });
    expect(EFFECT_DEFS.jolt).toMatchObject({ sourceType: 'shock', turns: 3, magnitude: 8 });
    expect(EFFECT_DEFS.drain).toMatchObject({ sourceType: 'void', turns: 5, magnitude: 15 });
  });

  it('laesst burn und toxin die Ruestung ignorieren', () => {
    expect(EFFECT_DEFS.burn.ignoresArmor).toBe(true);
    expect(EFFECT_DEFS.toxin.ignoresArmor).toBe(true);
    expect(EFFECT_DEFS.jolt.ignoresArmor).toBe(false);
  });

  it('haelt die Schwellen aus SPEC 4.5', () => {
    expect(EFFECT_RESIST_THRESHOLD).toBe(50);
    expect(DRAIN_ARMOR_PENALTY).toBe(3);
  });

  it('isEffectId erkennt nur die fuenf bekannten Effekte', () => {
    for (const id of ['burn', 'toxin', 'chill', 'jolt', 'drain']) {
      expect(isEffectId(id)).toBe(true);
    }
    expect(isEffectId('haste')).toBe(false);
    expect(isEffectId('')).toBe(false);
  });
});

describe('Basistypen', () => {
  it('kennt die sechs Schadensarten', () => {
    expect([...DAMAGE_TYPES]).toEqual(['physical', 'fire', 'poison', 'ice', 'shock', 'void']);
  });

  it('kennt die zehn Ausruestungsplaetze aus RPG.md Abschnitt 3', () => {
    expect(EQUIP_SLOTS).toHaveLength(10);
    expect([...EQUIP_SLOTS]).toContain('gauge_left');
    expect([...EQUIP_SLOTS]).toContain('gauge_right');
    expect(new Set(EQUIP_SLOTS).size).toBe(10);
  });
});

describe('Startwerte', () => {
  it('setzt jedes Attribut auf 10', () => {
    expect(START_ATTRIBUTE).toBe(10);
    expect(startAttributes()).toEqual({
      strength: 10,
      agility: 10,
      vitality: 10,
      focus: 10,
    });
  });

  it('liefert bei jedem Aufruf ein eigenes Objekt', () => {
    const first = startAttributes();
    first.strength = 99;
    expect(startAttributes().strength).toBe(10);
  });

  it('haelt die Grenzen aus RPG.md', () => {
    expect(MAX_ATTRIBUTE).toBe(300);
    expect(MAX_INVENTORY).toBe(40);
  });
});
