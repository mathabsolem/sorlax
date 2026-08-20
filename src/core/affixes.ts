/**
 * Affixe und das Wuerfeln von Gegenstaenden, RPG.md Abschnitt 4.
 *
 * Determinismus (SPEC 3.3): der gesamte Zufall kommt aus dem uebergebenen `rng`.
 * Wo ueber Kataloge iteriert wird, wird vorher nach `id` sortiert. Die
 * Reihenfolge von `Object.keys` ist zwar in der Praxis stabil, aber kein
 * zugesicherter Teil des Spielstands.
 */
import { createInstance } from './items';
import type { Rng } from './rng';
import type {
  AffixDef,
  ContentDb,
  DropTableDef,
  EquipSlot,
  GameState,
  ItemInstance,
  Rarity,
  RolledAffix,
  UniqueDef,
} from './types';

/** Feste Reihenfolge fuer den gewichteten Wurf. Nicht umsortieren. */
export const RARITIES: readonly Rarity[] = ['normal', 'magic', 'rare', 'unique'];

/** Hoechstzahl je Affixart auf einem Gegenstand, RPG.md Abschnitt 4. */
export const MAX_PREFIXES = 3;
export const MAX_SUFFIXES = 3;

/** Zahl der Affixe je Raritaet, RPG.md Abschnitt 4. `unique` hat eine feste Liste. */
const AFFIX_COUNT: Record<Exclude<Rarity, 'unique'>, { min: number; max: number }> = {
  normal: { min: 0, max: 0 },
  magic: { min: 1, max: 2 },
  rare: { min: 3, max: 5 },
};

function byId<T extends { id: string }>(entries: Record<string, T>): T[] {
  return Object.values(entries).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Passt der Affix zum Traeger? RPG.md Abschnitt 9. */
function matchesBearer(def: AffixDef, forEnemy: boolean): boolean {
  if (def.appliesTo === 'both') return true;
  return def.appliesTo === (forEnemy ? 'enemy' : 'player');
}

/**
 * Alle Affixe, die auf diesem Steckplatz und dieser Gegenstandsstufe erscheinen
 * duerfen. Sortiert nach `id`, damit der Wurf reproduzierbar ist.
 */
export function eligibleAffixes(
  slot: EquipSlot,
  itemLevel: number,
  forEnemy: boolean,
  content: ContentDb
): AffixDef[] {
  return byId(content.affixes).filter(
    (def) =>
      def.slots.includes(slot) && def.minItemLevel <= itemLevel && matchesBearer(def, forEnemy)
  );
}

/** Gewichteter Wurf auf die Raritaeten. Ohne Gewichte bleibt es bei `normal`. */
function rollRarity(rng: Rng, table: DropTableDef): Rarity {
  let total = 0;
  for (const rarity of RARITIES) total += Math.max(0, table.rarityWeights[rarity]);
  if (total <= 0) return 'normal';

  let ticket = rng.next() * total;
  for (const rarity of RARITIES) {
    ticket -= Math.max(0, table.rarityWeights[rarity]);
    if (ticket < 0) return rarity;
  }
  // Nur bei Rundungsresten am oberen Rand erreichbar.
  return 'normal';
}

/**
 * Zieht `count` verschiedene Affixe aus dem Vorrat und wuerfelt ihre Werte.
 * Ist der Vorrat vorher erschoepft, wird der Gegenstand entsprechend schwaecher.
 */
function drawAffixes(rng: Rng, pool: AffixDef[], count: number): RolledAffix[] {
  const remaining = [...pool];
  const rolled: RolledAffix[] = [];
  let prefixes = 0;
  let suffixes = 0;

  for (let drawn = 0; drawn < count; drawn++) {
    const candidates = remaining.filter((def) =>
      def.kind === 'prefix' ? prefixes < MAX_PREFIXES : suffixes < MAX_SUFFIXES
    );
    if (candidates.length === 0) break;

    const picked = candidates[rng.randInt(0, candidates.length - 1)];
    if (picked === undefined) break;
    if (picked.kind === 'prefix') prefixes += 1;
    else suffixes += 1;

    remaining.splice(remaining.indexOf(picked), 1);
    rolled.push({ affixId: picked.id, value: rng.randInt(picked.min, picked.max) });
  }

  return rolled;
}

/** Einzigartige Gegenstaende, die auf diesem Steckplatz und dieser Stufe liegen duerfen. */
function eligibleUniques(slot: EquipSlot, itemLevel: number, content: ContentDb): UniqueDef[] {
  return byId(content.uniques).filter((unique) => {
    if (unique.minItemLevel > itemLevel) return false;
    return content.items[unique.baseId]?.slot === slot;
  });
}

/**
 * Wuerfelt einen Gegenstand nach INTERFACES Abschnitt 5.
 *
 * Abweichung vom Vertrag, gemeldet statt stillschweigend gebogen: INTERFACES
 * Abschnitt 5 kennt die sechs Parameter bis `forEnemy`. Damit laesst sich keine
 * `uid` vergeben, denn die zaehlt laut RPG.md Abschnitt 4 im `GameState`
 * (`nextItemUid`). Die sechs Vertragsparameter bleiben in Reihenfolge und Typ
 * unveraendert, `state` kommt als siebter dazu.
 *
 * Wirft bei unbekanntem Grundtyp: der Vertrag sieht keinen nullbaren
 * Rueckgabewert vor, und ein Gegenstand ohne Grundtyp waere kaputt.
 */
export function rollItem(
  rng: Rng,
  baseId: string,
  itemLevel: number,
  table: DropTableDef,
  content: ContentDb,
  forEnemy: boolean,
  state: GameState
): ItemInstance {
  const base = content.items[baseId];
  if (base === undefined || base.slot === undefined) {
    throw new Error(`not an equipment base: ${baseId}`);
  }
  const slot = base.slot;

  let rarity = rollRarity(rng, table);
  let finalBaseId = baseId;
  let affixes: RolledAffix[];

  if (rarity === 'unique') {
    const uniques = eligibleUniques(slot, itemLevel, content);
    const unique = uniques[rng.randInt(0, Math.max(0, uniques.length - 1))];
    if (unique === undefined) {
      // Kein passender einzigartiger Gegenstand im Katalog: statt eines leeren
      // Gegenstands faellt der Wurf auf die naechstbeste Raritaet zurueck.
      rarity = 'rare';
      const span = AFFIX_COUNT.rare;
      affixes = drawAffixes(rng, eligibleAffixes(slot, itemLevel, forEnemy, content), rng.randInt(span.min, span.max));
    } else {
      finalBaseId = unique.baseId;
      affixes = unique.affixes.map((entry) => ({ affixId: entry.affixId, value: entry.value }));
    }
  } else {
    const span = AFFIX_COUNT[rarity];
    affixes = drawAffixes(
      rng,
      eligibleAffixes(slot, itemLevel, forEnemy, content),
      rng.randInt(span.min, span.max)
    );
  }

  const instance = createInstance(state, finalBaseId, itemLevel, rarity, affixes, content);
  if (instance === null) throw new Error(`not an equipment base: ${finalBaseId}`);
  return instance;
}
