/**
 * Laedt den fertigen Inhalt in eine ContentDb, PHASE_6 Block 8.
 *
 * Die Kataloge liegen als JSON in content/, die sechzehn Sohlen erzeugt
 * scripts/genMaps.ts. Hier werden sie nur eingesammelt; erzeugt wird nichts.
 * Die Entwicklungsfixture in devFixture.ts bleibt daneben bestehen.
 */
import affixes from '../../content/affixes.json';
import dropTables from '../../content/dropTables.json';
import enemies from '../../content/enemies.json';
import items from '../../content/items.json';
import progression from '../../content/progression.json';
import skills from '../../content/skills.json';
import uniques from '../../content/uniques.json';
import weapons from '../../content/weapons.json';
import sohle01 from '../../content/maps/sohle_01.json';
import sohle02 from '../../content/maps/sohle_02.json';
import sohle03 from '../../content/maps/sohle_03.json';
import sohle04 from '../../content/maps/sohle_04.json';
import sohle05 from '../../content/maps/sohle_05.json';
import sohle06 from '../../content/maps/sohle_06.json';
import sohle07 from '../../content/maps/sohle_07.json';
import sohle08 from '../../content/maps/sohle_08.json';
import sohle09 from '../../content/maps/sohle_09.json';
import sohle10 from '../../content/maps/sohle_10.json';
import sohle11 from '../../content/maps/sohle_11.json';
import sohle12 from '../../content/maps/sohle_12.json';
import sohle13 from '../../content/maps/sohle_13.json';
import sohle14 from '../../content/maps/sohle_14.json';
import sohle15 from '../../content/maps/sohle_15.json';
import sohle16 from '../../content/maps/sohle_16.json';
import type { ContentDb, MapDef } from '../core/types';

/** Erste Sohle, hier startet ein neues Spiel. */
export const FIRST_MAP_ID = 'sohle_01';

const MAP_FILES = [
  sohle01, sohle02, sohle03, sohle04, sohle05, sohle06, sohle07, sohle08,
  sohle09, sohle10, sohle11, sohle12, sohle13, sohle14, sohle15, sohle16,
] as unknown as MapDef[];

/** Alle sechzehn Sohlen, nach Id abgelegt. */
export function loadMaps(): Record<string, MapDef> {
  const maps: Record<string, MapDef> = {};
  for (const map of MAP_FILES) maps[map.id] = map;
  return maps;
}

/** Der vollstaendige Inhalt des Spiels. */
export function createGameContent(): ContentDb {
  return {
    enemies: enemies as unknown as ContentDb['enemies'],
    weapons: weapons as unknown as ContentDb['weapons'],
    items: items as unknown as ContentDb['items'],
    affixes: affixes as unknown as ContentDb['affixes'],
    uniques: uniques as unknown as ContentDb['uniques'],
    dropTables: dropTables as unknown as ContentDb['dropTables'],
    skills: skills as unknown as ContentDb['skills'],
    maps: loadMaps(),
    progression: progression as unknown as ContentDb['progression'],
  };
}
