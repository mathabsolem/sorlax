/**
 * Referenzpruefung ueber alle Kataloge in content/.
 */
import { describe, expect, it } from 'vitest';
import affixesJson from '../content/affixes.json';
import dropTablesJson from '../content/dropTables.json';
import enemiesJson from '../content/enemies.json';
import itemsJson from '../content/items.json';
import skillsJson from '../content/skills.json';
import uniquesJson from '../content/uniques.json';
import weaponsJson from '../content/weapons.json';
import { BOSS_UNIQUES } from '../src/core/bossLoot';
import { BOON_STATS, CURE_PREFIX, EFFECT_ORDER } from '../src/core/effectDefs';
import { DAMAGE_TYPES, EQUIP_SLOTS } from '../src/core/types';
import type {
  AffixDef,
  DropTableDef,
  EnemyDef,
  ItemDef,
  SkillDef,
  UniqueDef,
  WeaponDef,
} from '../src/core/types';
import { check } from './fixtures/lint';

const ENEMIES = enemiesJson as unknown as Record<string, EnemyDef>;
const ITEMS = itemsJson as unknown as Record<string, ItemDef>;
const WEAPONS = weaponsJson as unknown as Record<string, WeaponDef>;
const AFFIXES = affixesJson as unknown as Record<string, AffixDef>;
const UNIQUES = uniquesJson as unknown as Record<string, UniqueDef>;
const DROP_TABLES = dropTablesJson as unknown as Record<string, DropTableDef>;
const SKILLS = skillsJson as unknown as Record<string, SkillDef>;

/**
 * Vollstaendigkeitspruefung: jede Id, die ein Eintrag in content/ nennt, muss
 * es auch geben. Genau das haette die stumm verschluckten Drops aus der
 * Rueckmeldung nach Phase 4.5 sofort gezeigt, denn dropLoot ueberspringt einen
 * unbekannten `defId` wortlos.
 */
describe('Referenzen in content/', () => {
  /** Erlaubte `stat`-Namen, INTERFACES Abschnitt 5 (DerivedStats und Attribute). */
  const STATS = new Set([
    'maxHealth', 'accuracy', 'evasion', 'armor', 'meleeBonus', 'elemBonus', 'critBonus',
    'lightRadius', 'freeActionChance', 'ammoSaveChance',
    'strength', 'agility', 'vitality', 'focus',
    ...DAMAGE_TYPES.map((type) => `res_${type}`),
  ]);

  /** Alle bekannten Effekt-Ids: Statuseffekte, positive Effekte, Heilmittel. */
  const EFFECTS = new Set([
    ...EFFECT_ORDER,
    ...Object.keys(BOON_STATS),
    ...EFFECT_ORDER.map((id) => `${CURE_PREFIX}${id}`),
  ]);

  type Reference = { where: string; kind: string; value: string; known: (id: string) => boolean };

  const has = (table: Record<string, unknown>) => (id: string) => table[id] !== undefined;

  function references(): Reference[] {
    const found: Reference[] = [];
    const add = (where: string, kind: string, value: string, known: (id: string) => boolean): void => {
      found.push({ where, kind, value, known });
    };

    for (const def of Object.values(ENEMIES)) {
      add(`${def.id}.weaponId`, 'Waffe', def.weaponId, has(WEAPONS));
      if (def.dropTableId !== undefined) {
        add(`${def.id}.dropTableId`, 'Drop-Tabelle', def.dropTableId, has(DROP_TABLES));
      }
      for (const drop of def.drops ?? []) {
        add(`${def.id}.drops`, 'Gegenstand', drop.defId, has(ITEMS));
      }
    }

    for (const def of Object.values(ITEMS)) {
      if (def.weaponId !== undefined) {
        add(`${def.id}.weaponId`, 'Waffe', def.weaponId, has(WEAPONS));
      }
      if (def.effect !== undefined) {
        add(`${def.id}.effect.id`, 'Effekt', def.effect.id, (id) => EFFECTS.has(id));
      }
      for (const modifier of def.baseModifiers ?? []) {
        add(`${def.id}.baseModifiers`, 'Wert', modifier.stat, (id) => STATS.has(id));
      }
      for (const slot of def.slots ?? []) {
        add(`${def.id}.slots`, 'Steckplatz', slot, (id) => (EQUIP_SLOTS as readonly string[]).includes(id));
      }
    }

    for (const def of Object.values(WEAPONS)) {
      if (def.appliesEffect !== undefined) {
        add(`${def.id}.appliesEffect`, 'Effekt', def.appliesEffect, (id) => EFFECTS.has(id));
      }
      if (def.ammoType !== null) {
        // Munition wird ueber den Namen zugeordnet: `pistol` liegt als
        // `ammo_pistol` im Katalog, siehe CONTENT_TABLES Abschnitt 1.
        add(`${def.id}.ammoType`, 'Munition', `ammo_${def.ammoType}`, has(ITEMS));
      }
    }

    for (const def of Object.values(UNIQUES)) {
      add(`${def.id}.baseId`, 'Grundtyp', def.baseId, has(ITEMS));
      for (const affix of def.affixes) {
        add(`${def.id}.affixes`, 'Affix', affix.affixId, has(AFFIXES));
      }
    }

    for (const def of Object.values(AFFIXES)) {
      add(`${def.id}.stat`, 'Wert', def.stat, (id) => STATS.has(id));
      for (const slot of def.slots) {
        add(`${def.id}.slots`, 'Steckplatz', slot, (id) => (EQUIP_SLOTS as readonly string[]).includes(id));
      }
    }

    for (const def of Object.values(SKILLS)) {
      for (const modifier of def.modifiers ?? []) {
        add(`${def.id}.modifiers`, 'Wert', modifier.stat, (id) => STATS.has(id));
      }
    }

    for (const def of Object.values(DROP_TABLES)) {
      for (const slot of Object.keys(def.slotWeights)) {
        add(`${def.id}.slotWeights`, 'Steckplatz', slot, (id) => (EQUIP_SLOTS as readonly string[]).includes(id));
      }
    }

    for (const [bossId, uniqueId] of Object.entries(BOSS_UNIQUES)) {
      add(`${bossId}.guaranteedUnique`, 'einzigartiger Gegenstand', uniqueId, has(UNIQUES));
      add(`${bossId}.guaranteedUnique`, 'Boss', bossId, has(ENEMIES));
    }

    return found;
  }

  it('loest jede genannte Id auf', () => {
    const dangling = references()
      .filter((reference) => !reference.known(reference.value))
      .map((reference) => `${reference.where}: ${reference.kind} ${reference.value} gibt es nicht`);
    expect(dangling).toEqual([]);
  });

  it('hat zu jeder Munitionssorte einer Waffe einen Gegenstand gleicher Sorte', () => {
    const problems: string[] = [];
    for (const def of Object.values(WEAPONS)) {
      if (def.ammoType === null) continue;
      const item = ITEMS[`ammo_${def.ammoType}`];
      if (item === undefined) {
        problems.push(`${def.id}.ammoType: Munition ammo_${def.ammoType} fehlt im Katalog`);
        continue;
      }
      check(problems, item.id, 'type', item.type, 'ammo');
    }
    expect(problems).toEqual([]);
  });
});
