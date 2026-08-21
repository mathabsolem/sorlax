/**
 * content/skills.json und content/enemies.json, PHASE_3_7 Bloecke 2 und 7.
 */
import { describe, expect, it } from 'vitest';
import enemiesJson from '../content/enemies.json';
import { BOSS_REGISTRY } from '../src/core/bosses/registry';
import { SKILL_REGISTRY } from '../src/core/skills/registry';
import { MAX_SKILL_POINTS } from '../src/core/skills/rules';
import { DAMAGE_TYPES } from '../src/core/types';
import type { EnemyDef } from '../src/core/types';
import { SKILLS } from './fixtures/catalog';

const ENEMIES = enemiesJson as unknown as Record<string, EnemyDef>;
const TREES = ['tree_gear', 'tree_reaction', 'tree_endure'];

describe('content/skills.json', () => {
  it('fuehrt drei Baeume mit mindestens sechs Eintraegen', () => {
    for (const tree of TREES) {
      expect(Object.values(SKILLS).filter((def) => def.tree === tree).length)
        .toBeGreaterThanOrEqual(6);
    }
    // PHASE_4_5 Block 4 ergaenzt field_analysis als gesperrten Platzhalter,
    // weil RPG.md Abschnitt 4 ihn nennt, kein Baum ihn aber fuehrte.
    expect(SKILLS['field_analysis']?.tree).toBe('tree_endure');
    expect(SKILLS['field_analysis']?.locked).toBe(true);
    expect(Object.keys(SKILLS)).toHaveLength(19);
  });

  it('haelt Schluessel, Stufen und Grenzen ein', () => {
    for (const [key, def] of Object.entries(SKILLS)) {
      expect(def.id).toBe(key);
      expect(TREES).toContain(def.tree);
      expect(def.maxPoints).toBe(MAX_SKILL_POINTS);
      expect([1, 2, 3]).toContain(def.tier);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      // Passive Fertigkeiten haben keine Abklingzeit.
      if (!def.active) expect(def.cooldown).toBe(0);
    }
  });

  it('setzt Stufenvoraussetzungen nach RPG.md Abschnitt 5', () => {
    const expected: Record<number, { level: number; inTree: number }> = {
      1: { level: 1, inTree: 0 },
      2: { level: 6, inTree: 2 },
      3: { level: 12, inTree: 5 },
    };
    for (const def of Object.values(SKILLS)) {
      const rule = expected[def.tier];
      expect(def.reqLevel).toBe(rule?.level);
      expect(def.reqPointsInTree).toBe(rule?.inTree);
    }
  });

  it('setzt tree_gear vollstaendig um und sperrt die beiden anderen', () => {
    for (const def of Object.values(SKILLS)) {
      if (def.tree === 'tree_gear') {
        expect(def.locked).toBe(false);
      } else {
        expect(def.locked).toBe(true);
        expect(def.modifiers).toBeUndefined();
        expect(def.active).toBe(false);
      }
    }
  });

  it('gibt jeder aktiven, nicht gesperrten Fertigkeit einen Handler', () => {
    for (const def of Object.values(SKILLS)) {
      if (def.locked || !def.active) continue;
      expect(SKILL_REGISTRY[def.id]).toBeTypeOf('function');
      expect(def.cooldown).toBeGreaterThan(0);
    }
  });

  it('traegt die Werte aus der Tabelle in Block 2', () => {
    expect(SKILLS['precise_strike']?.modifiers).toEqual([
      { stat: 'accuracy', mode: 'flat', perPoint: 3 },
    ]);
    expect(SKILLS['heavy_hand']?.modifiers).toEqual([
      { stat: 'meleeBonus', mode: 'percent', perPoint: 4 },
    ]);
    expect(SKILLS['steady_aim']?.modifiers).toEqual([
      { stat: 'critBonus', mode: 'flat', perPoint: 2 },
    ]);
    expect(SKILLS['breach']?.cooldown).toBe(4);
    expect(SKILLS['sweep']?.cooldown).toBe(6);
    // execution ist kein Wert in DerivedStats, sondern ein Zuschlag im Kampf.
    expect(SKILLS['execution']?.modifiers).toBeUndefined();
  });
});

describe('content/enemies.json', () => {
  it('fuehrt die vier Bosse mit passendem scriptId', () => {
    for (const script of ['halvern', 'sporemother', 'rime', 'sorlax']) {
      const def = ENEMIES[`boss_${script}`];
      expect(def?.behavior).toBe('scripted');
      expect(def?.scriptId).toBe(script);
      expect(BOSS_REGISTRY[def?.scriptId ?? '']).toBeTypeOf('function');
      expect(def?.dropTableId).toBe('boss_drop');
    }
  });

  it('bringt die von den Skripten gerufenen Gegner mit', () => {
    for (const id of ['spore_poison', 'rat_physical', 'miner_physical']) {
      expect(ENEMIES[id]?.behavior).not.toBe('scripted');
    }
  });

  it('haelt Schluessel, Resistenzen und Geschwindigkeit ein', () => {
    for (const [key, def] of Object.entries(ENEMIES)) {
      expect(def.id).toBe(key);
      for (const type of DAMAGE_TYPES) {
        expect(typeof def.resistances[type]).toBe('number');
      }
      // speed 0 hiesse: der Gegner bekommt nie einen Aktionspunkt.
      expect(def.speed).toBeGreaterThan(0);
      expect(def.frames.idle.length).toBeGreaterThan(0);
      expect(def.baseHealth).toBeGreaterThan(0);
    }
  });
});
