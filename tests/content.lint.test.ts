/**
 * Inhaltsabgleich gegen docs/BESTIARY.md v3, Abschnitt 4, 5 und 10.
 *
 * Die kanonischen Werte stehen in scripts/canonical.ts, derselben Datei, aus der
 * auch der Generator liest. Damit kann Erzeugung und Pruefung nicht
 * auseinanderlaufen. Abgeschrieben sind sie dort, nicht aus dem Markdown
 * gelesen: ein Parser wuerde mit jeder Formatierungsaenderung brechen und im
 * Zweifel schweigend nichts pruefen.
 *
 * Abschnitt 6 bis 8 stehen in content.gear.test.ts, die Referenzpruefung in
 * content.refs.test.ts.
 */
import { describe, expect, it } from 'vitest';
import enemiesJson from '../content/enemies.json';
import weaponsJson from '../content/weapons.json';
import {
  ARCHETYPES,
  ARCHETYPE_DROPS,
  ELEMENT_EFFECTS,
  ELEMENT_MODIFIERS,
  ENEMY_WEAPONS,
  PLANNED_VARIANTS,
  RESIST_PROFILES,
  variantName,
  weaponFor,
} from '../scripts/canonical';
import type { WeaponRow } from '../scripts/canonical';
import { DAMAGE_TYPES } from '../src/core/types';
import type { DamageType, EnemyDef, WeaponDef } from '../src/core/types';
import { check } from './fixtures/lint';

const ENEMIES = enemiesJson as unknown as Record<string, EnemyDef>;
const WEAPONS = weaponsJson as unknown as Record<string, WeaponDef>;

function weaponRow(into: string[], id: string, want: WeaponRow): void {
  const def = WEAPONS[id];
  if (def === undefined) {
    into.push(`${id}: fehlt in content/weapons.json`);
    return;
  }
  check(into, id, 'dmgMin', def.dmgMin, want.dmgMin);
  check(into, id, 'dmgMax', def.dmgMax, want.dmgMax);
  check(into, id, 'critChance', def.critChance, want.crit);
  check(into, id, 'optimalRange', def.optimalRange, want.optimal);
  check(into, id, 'maxRange', def.maxRange, want.max);
  check(into, id, 'ammoType', def.ammoType, want.ammo);
  check(into, id, 'damageType', def.damageType, want.damageType);
}

describe('Abschnitt 4, Archetypen', () => {
  it('kennt jeder Gegner in content/ einen Archetyp aus dem Bestiarium', () => {
    const unknown = Object.values(ENEMIES)
      .filter((def) => def.behavior !== 'scripted')
      .filter((def) => ARCHETYPES[def.archetype] === undefined)
      .map((def) => `${def.id}: Archetyp ${def.archetype} steht nicht in Abschnitt 4`);
    expect(unknown).toEqual([]);
  });

  it('leitet jede Variante korrekt aus Archetyp und Elementmodifikator ab', () => {
    const problems: string[] = [];

    for (const def of Object.values(ENEMIES)) {
      if (def.behavior === 'scripted') continue;
      const base = ARCHETYPES[def.archetype];
      const modifier = ELEMENT_MODIFIERS[def.element];
      if (base === undefined) continue;

      check(problems, def.id, 'id', def.id, `${def.archetype}_${def.element}`);
      check(problems, def.id, 'behavior', def.behavior, base.behavior);
      check(problems, def.id, 'baseHealth', def.baseHealth, Math.round(base.hp * modifier.health));
      check(problems, def.id, 'baseArmor', def.baseArmor, base.armor);
      check(problems, def.id, 'baseAccuracy', def.baseAccuracy, base.acc + modifier.acc);
      check(problems, def.id, 'baseEvasion', def.baseEvasion, base.eva + modifier.eva);
      check(problems, def.id, 'speed', def.speed, base.speed);
      check(problems, def.id, 'aggroRange', def.aggroRange, base.aggro);
      check(problems, def.id, 'baseXp', def.baseXp, base.xp);
      check(problems, def.id, 'spriteWidth', def.spriteWidth, base.width);
      check(problems, def.id, 'resistances', def.resistances, RESIST_PROFILES[def.element]);
      check(problems, def.id, 'dropTableId', def.dropTableId, 'common_drop');
      check(problems, def.id, 'name', def.name, variantName(def.archetype, def.element));

      // Abschnitt 4 laesst preferredRange bei melee und charger offen ("—"),
      // weil beide Verhalten den Wert nie lesen. Erwartet wird dort die 1.
      check(problems, def.id, 'preferredRange', def.preferredRange, base.pref ?? 1);

      check(problems, def.id, 'weaponId', def.weaponId, weaponFor(base, def.element));
    }

    expect(problems).toEqual([]);
  });
});

describe('Abschnitt 5, Gegnerwaffen', () => {
  it('fuehrt alle neun Grundformen mit den Werten der Tabelle', () => {
    const problems: string[] = [];
    for (const [id, want] of Object.entries(ENEMY_WEAPONS)) weaponRow(problems, id, want);
    expect(problems).toEqual([]);
  });

  it('baut jede Elementvariante als Klon ihrer Grundform', () => {
    const problems: string[] = [];

    for (const def of Object.values(WEAPONS)) {
      const match = /^(nw_[a-z]+)_([a-z]+)$/.exec(def.id);
      if (match === null) continue;
      const [, baseId, element] = match;
      if (baseId === undefined || element === undefined) continue;
      const base = WEAPONS[baseId];
      if (base === undefined) {
        problems.push(`${def.id}: Grundform ${baseId} fehlt`);
        continue;
      }

      check(problems, def.id, 'dmgMin', def.dmgMin, base.dmgMin);
      check(problems, def.id, 'dmgMax', def.dmgMax, base.dmgMax);
      check(problems, def.id, 'critChance', def.critChance, base.critChance);
      check(problems, def.id, 'optimalRange', def.optimalRange, base.optimalRange);
      check(problems, def.id, 'maxRange', def.maxRange, base.maxRange);
      check(problems, def.id, 'damageType', def.damageType, element);
      check(problems, def.id, 'appliesEffect', def.appliesEffect, ELEMENT_EFFECTS[element as DamageType]);
    }

    expect(problems).toEqual([]);
  });
});

describe('Abschnitt 10, Sohlenplan', () => {
  it('fuehrt alle 28 Varianten des Plans mit den erwarteten Ids', () => {
    const missing = PLANNED_VARIANTS.filter((id) => ENEMIES[id] === undefined);
    const surplus = Object.values(ENEMIES)
      .filter((def) => def.behavior !== 'scripted')
      .map((def) => def.id)
      .filter((id) => !PLANNED_VARIANTS.includes(id));

    expect(PLANNED_VARIANTS).toHaveLength(28);
    expect(missing).toEqual([]);
    expect(surplus).toEqual([]);
  });

  it('hat rat_fire genau die Werte aus Basis mal Modifikator', () => {
    // Fest hinterlegt, nicht neu gerechnet: 12 x 0.90 = 10.8 auf 11 gerundet,
    // Genauigkeit 8 + 1, Ausweichen 10 + 1. Ruestung, Erfahrung und Tempo
    // bleiben unberuehrt.
    const problems: string[] = [];
    const def = ENEMIES['rat_fire'];
    expect(def).toBeDefined();
    if (def === undefined) return;

    check(problems, def.id, 'name', def.name, 'Brennende Grubenratte');
    check(problems, def.id, 'archetype', def.archetype, 'rat');
    check(problems, def.id, 'element', def.element, 'fire');
    check(problems, def.id, 'baseHealth', def.baseHealth, 11);
    check(problems, def.id, 'baseArmor', def.baseArmor, 0);
    check(problems, def.id, 'baseAccuracy', def.baseAccuracy, 9);
    check(problems, def.id, 'baseEvasion', def.baseEvasion, 11);
    check(problems, def.id, 'speed', def.speed, 2.0);
    check(problems, def.id, 'baseXp', def.baseXp, 8);
    check(problems, def.id, 'spriteWidth', def.spriteWidth, 0.5);
    check(problems, def.id, 'weaponId', def.weaponId, 'nw_bite_fire');
    check(problems, def.id, 'resistances', def.resistances, {
      physical: 0,
      fire: 80,
      poison: 0,
      ice: -50,
      shock: 0,
      void: 0,
    });
    expect(problems).toEqual([]);
  });

  it('gibt jeder Variante das Resistenzprofil ihres Elements', () => {
    const problems: string[] = [];
    for (const id of PLANNED_VARIANTS) {
      const def = ENEMIES[id];
      if (def === undefined) continue;
      const want = RESIST_PROFILES[def.element];
      for (const type of DAMAGE_TYPES) {
        check(problems, id, `resistances.${type}`, def.resistances[type], want[type]);
      }
    }
    expect(problems).toEqual([]);
  });

  it('nutzt die Frames seines Archetyps und keine eigenen Dateien', () => {
    const problems: string[] = [];
    for (const id of PLANNED_VARIANTS) {
      const def = ENEMIES[id];
      if (def === undefined) continue;
      const wrong = [...def.frames.idle, ...def.frames.attack, ...def.frames.pain, ...def.frames.death]
        .filter((frame) => !frame.startsWith(`${def.archetype}_`));
      if (wrong.length > 0) problems.push(`${id}.frames: fremde Dateien ${wrong.join(', ')}`);
    }
    expect(problems).toEqual([]);
  });

  it('wirft die Stapelware aus Abschnitt 9 ab', () => {
    const problems: string[] = [];
    for (const id of PLANNED_VARIANTS) {
      const def = ENEMIES[id];
      if (def === undefined) continue;
      const want = (ARCHETYPE_DROPS[def.archetype] ?? []).map((drop) => drop.defId);
      check(problems, id, 'drops', (def.drops ?? []).map((drop) => drop.defId), want);
      for (const drop of def.drops ?? []) {
        const chance = ARCHETYPE_DROPS[def.archetype]?.find((row) => row.defId === drop.defId)?.chance;
        check(problems, id, `drops.${drop.defId}.chance`, drop.chance, chance);
      }
    }
    expect(problems).toEqual([]);
  });
});

/**
 * Vollstaendigkeitspruefung: jede Id, die ein Eintrag in content/ nennt, muss
 * es auch geben. Genau das haette die stumm verschluckten Drops aus der
 * Rueckmeldung nach Phase 4.5 sofort gezeigt, denn dropLoot ueberspringt einen
 * unbekannten `defId` wortlos.
 */
