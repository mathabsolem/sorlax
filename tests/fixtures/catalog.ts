/**
 * Der Startkatalog aus content/ fuer die Tests, dazu die einzigartigen
 * Gegenstaende, die es in content/ noch nicht gibt.
 */
import affixesJson from '../../content/affixes.json';
import dropTablesJson from '../../content/dropTables.json';
import equipmentJson from '../../content/items.json';
import skillsJson from '../../content/skills.json';
import uniquesJson from '../../content/uniques.json';
import weaponsJson from '../../content/weapons.json';
import type {
  AffixDef,
  DropTableDef,
  ItemDef,
  SkillDef,
  UniqueDef,
  WeaponDef,
} from '../../src/core/types';

/**
 * Der echte Startkatalog aus content/. Ein JSON-Import kennt nur die weiten
 * Typen `string` und `number`, deshalb die Zusicherung. Dass die Dateien den
 * Vertrag wirklich einhalten, prueft tests/content.test.ts.
 */
export const AFFIXES = affixesJson as unknown as Record<string, AffixDef>;
export const DROP_TABLES = dropTablesJson as unknown as Record<string, DropTableDef>;
export const EQUIPMENT: Record<string, ItemDef> = equipmentJson as unknown as Record<
  string,
  ItemDef
>;
export const SKILLS = skillsJson as unknown as Record<string, SkillDef>;

/** Die einzigartigen Gegenstaende aus CONTENT_TABLES Abschnitt 2. */
export const UNIQUES = uniquesJson as unknown as Record<string, UniqueDef>;
export const WEAPON_DEFS = weaponsJson as unknown as Record<string, WeaponDef>;

