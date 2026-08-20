/**
 * Der Startkatalog aus content/ fuer die Tests, dazu die einzigartigen
 * Gegenstaende, die es in content/ noch nicht gibt.
 */
import affixesJson from '../../content/affixes.json';
import dropTablesJson from '../../content/dropTables.json';
import equipmentJson from '../../content/items.json';
import type { AffixDef, DropTableDef, ItemDef, UniqueDef } from '../../src/core/types';

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

/**
 * Einzigartige Gegenstaende gibt es in content/ noch nicht, siehe Bericht zu
 * Phase 3.6. Fuer die Tests reichen zwei feste Eintraege.
 */
export const UNIQUES: Record<string, UniqueDef> = {
  uniq_ember_shell: {
    id: 'uniq_ember_shell',
    baseId: 'suit_liner',
    name: 'Ember Shell',
    minItemLevel: 1,
    affixes: [
      { affixId: 'suf_of_embers', value: 20 },
      { affixId: 'pre_plated', value: 5 },
    ],
  },
  uniq_lamp_crown: {
    id: 'uniq_lamp_crown',
    baseId: 'helmet_cap',
    name: 'Lamp Crown',
    minItemLevel: 1,
    affixes: [{ affixId: 'suf_of_the_lamp', value: 3 }],
  },
};
