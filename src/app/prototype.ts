/**
 * Prototyp der ersten Sohle als eigener Einstiegspunkt.
 *
 * Baut dieselbe Welt wie das ganze Spiel, aber nur mit `sohle_01`. Damit
 * passt der Aufbau in eine einzige HTML-Datei, die ohne Server laeuft: die
 * Texturen liegen als data-URI in `SORLAX_TEXTURES`.
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
import type { ContentDb, MapDef } from '../core/types';
import { start } from './main';

/** Der Inhalt des Prototyps: alle Kataloge, aber nur die erste Sohle. */
export function createPrototypeContent(): ContentDb {
  const map = sohle01 as unknown as MapDef;
  return {
    enemies: enemies as unknown as ContentDb['enemies'],
    weapons: weapons as unknown as ContentDb['weapons'],
    items: items as unknown as ContentDb['items'],
    affixes: affixes as unknown as ContentDb['affixes'],
    uniques: uniques as unknown as ContentDb['uniques'],
    dropTables: dropTables as unknown as ContentDb['dropTables'],
    skills: skills as unknown as ContentDb['skills'],
    // Ohne zweite Sohle fuehrt der Ausgang ins Leere; das faengt commands.ts ab.
    maps: { [map.id]: map },
    progression: progression as unknown as ContentDb['progression'],
  };
}

const host = document.getElementById('app');
if (host !== null) {
  void start(host, createPrototypeContent());
}
