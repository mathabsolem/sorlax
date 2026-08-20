/**
 * Ausruestung der Gegner und ihre Hinterlassenschaft, RPG.md Abschnitt 9 und
 * PHASE_3_6 Block 6.
 *
 * Gewuerfelt wird beim ersten Betreten der Sohle, nicht beim Tod (SPEC 3.3).
 * Sonst koennte der Spieler durch Neuladen wuerfeln.
 *
 * Lag bis Phase 3.6 in spawn.ts. Dort kamen in Phase 3.7 spawnEnemy und
 * freeTilesAround dazu, womit die Datei ueber 300 Zeilen gewachsen waere.
 */
import { rollItem } from './affixes';
import { DIFFICULTY_ORDER } from './difficulty';
import { addGroundItem, slotsFor, slotsForDef } from './items';
import { loadRng, saveRng } from './rng';
import type { Rng } from './rng';
import { EQUIP_SLOTS } from './types';
import type {
  ContentDb,
  Difficulty,
  DropTableDef,
  Entity,
  EquipSlot,
  GameEvent,
  GameState,
  ItemDef,
  ItemInstance,
  MapDef,
  MapRuntimeState,
  Rarity,
} from './types';

/** Deckel je Sohle, RPG.md Abschnitt 9. Danach spawnt alles als `common`. */
export const MAX_EQUIPPED_PER_MAP = 60;

/** Anteil ausgeruesteter Gegner auf `normal`, RPG.md Abschnitt 9. */
export const EQUIPPED_BASE_CHANCE = 0.09;

/** Aufschlag je Schwierigkeitsgrad, in Anteilen. */
export const EQUIPPED_CHANCE_PER_STEP = 0.04;

/** Anteil ausgeruesteter Gegner auf diesem Schwierigkeitsgrad. */
export function equippedChanceFor(difficulty: Difficulty): number {
  const step = Math.max(0, DIFFICULTY_ORDER.indexOf(difficulty));
  return EQUIPPED_BASE_CHANCE + EQUIPPED_CHANCE_PER_STEP * step;
}

/** Nur magisch oder selten, RPG.md Abschnitt 9 fuer den Rang `equipped`. */
const EQUIPPED_WEIGHTS: Record<Rarity, number> = { normal: 0, magic: 70, rare: 30, unique: 0 };

/** Erzwingt einen einzigartigen Wurf fuer das Pflichtstueck eines Bosses. */
const UNIQUE_WEIGHTS: Record<Rarity, number> = { normal: 0, magic: 0, rare: 0, unique: 1 };

function withWeights(table: DropTableDef, rarityWeights: Record<Rarity, number>): DropTableDef {
  return { ...table, rarityWeights };
}

/** Gewichteter Wurf auf die Steckplaetze, in der festen Reihenfolge aus INTERFACES. */
function pickSlot(rng: Rng, table: DropTableDef, taken: Set<EquipSlot>): EquipSlot | null {
  const candidates = EQUIP_SLOTS.filter(
    (slot) => !taken.has(slot) && (table.slotWeights[slot] ?? 0) > 0
  );
  let total = 0;
  for (const slot of candidates) total += table.slotWeights[slot] ?? 0;
  if (total <= 0) return null;

  let ticket = rng.next() * total;
  for (const slot of candidates) {
    ticket -= table.slotWeights[slot] ?? 0;
    if (ticket < 0) return slot;
  }
  return candidates[candidates.length - 1] ?? null;
}

/**
 * Steckplaetze, fuer die es auf dieser Stufe ueberhaupt einen einzigartigen
 * Gegenstand gibt. Ohne diese Einschraenkung wuerde das Pflichtstueck eines
 * Bosses auf einen Steckplatz ohne Kandidaten fallen und rollItem muesste auf
 * `rare` ausweichen.
 */
function uniqueSlots(itemLevel: number, content: ContentDb): Set<EquipSlot> {
  const slots = new Set<EquipSlot>();
  for (const unique of Object.values(content.uniques)) {
    if (unique.minItemLevel > itemLevel) continue;
    const slot = content.items[unique.baseId]?.slot;
    if (slot !== undefined) slots.add(slot);
  }
  return slots;
}

/** Beschraenkt die Steckplatzgewichte auf eine Auswahl. */
function limitSlots(table: DropTableDef, allowed: Set<EquipSlot>): DropTableDef {
  const slotWeights: DropTableDef['slotWeights'] = {};
  for (const slot of EQUIP_SLOTS) {
    if (allowed.has(slot)) slotWeights[slot] = table.slotWeights[slot] ?? 10;
  }
  return { ...table, slotWeights };
}

/** Grundtypen eines Steckplatzes, die auf dieser Stufe erlaubt sind. */
function basesFor(slot: EquipSlot, itemLevel: number, content: ContentDb): ItemDef[] {
  return Object.values(content.items)
    .filter(
      (def) =>
        def.type === 'equipment' && slotsForDef(def).includes(slot) && def.reqLevel <= itemLevel
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Grundtabelle eines Gegners. Bosse fallen auf `boss_drop` zurueck. */
function tableFor(
  content: ContentDb,
  dropTableId: string | undefined,
  isBoss: boolean
): DropTableDef | undefined {
  if (dropTableId !== undefined) {
    const named = content.dropTables[dropTableId];
    if (named !== undefined) return named;
  }
  return content.dropTables[isBoss ? 'boss_drop' : 'common_drop'];
}

/** Ruestet einen Gegner aus. `boss` bekommt mindestens ein einzigartiges Teil. */
function equipEnemy(
  state: GameState,
  rng: Rng,
  entity: Entity,
  table: DropTableDef,
  content: ContentDb
): void {
  const itemLevel = entity.monsterLevel ?? 1;
  const isBoss = entity.rank === 'boss';
  const pieces = isBoss ? rng.randInt(2, 4) : rng.randInt(1, 2);
  const taken = new Set<EquipSlot>();
  const equipment: Partial<Record<EquipSlot, ItemInstance>> = {};
  const uniqueCandidates = isBoss ? uniqueSlots(itemLevel, content) : new Set<EquipSlot>();

  for (let index = 0; index < pieces; index++) {
    // Rang `equipped` traegt magisch oder selten, der Boss mindestens ein
    // einzigartiges Teil und den Rest nach seiner eigenen Tabelle. Das
    // Pflichtstueck wird auf die Steckplaetze beschraenkt, fuer die es auch
    // wirklich einen einzigartigen Gegenstand gibt.
    const forceUnique = isBoss && index === 0 && uniqueCandidates.size > 0;
    const pieceTable = forceUnique
      ? limitSlots(withWeights(table, UNIQUE_WEIGHTS), uniqueCandidates)
      : isBoss
        ? table
        : withWeights(table, EQUIPPED_WEIGHTS);
    const slot = pickSlot(rng, pieceTable, taken);
    if (slot === null) break;
    const bases = basesFor(slot, itemLevel, content);
    const base = bases[rng.randInt(0, bases.length - 1)];
    if (base === undefined) {
      taken.add(slot);
      continue;
    }
    const item = rollItem(rng, base.id, itemLevel, pieceTable, content, true, state);
    // Messgeraete passen in beide Plaetze, sie bleiben im gewuerfelten.
    const target = slotsFor(item).includes(slot) ? slot : item.slot;
    taken.add(slot);
    taken.add(target);
    equipment[target] = item;
  }

  if (Object.keys(equipment).length > 0) entity.equipment = equipment;
}

/**
 * Vergibt Raenge und Ausruestung fuer eine Sohle. Laeuft genau einmal, danach
 * steht `rolled` und ein zweiter Aufruf tut nichts.
 */
export function rollMapLoot(state: GameState, mapDef: MapDef, content: ContentDb): void {
  const mapState = state.maps[mapDef.id];
  if (mapState === undefined || mapState.rolled) return;
  mapState.rolled = true;

  const rng = loadRng(state);
  const chance = equippedChanceFor(state.difficulty);
  let equipped = 0;

  for (const entity of mapState.entities) {
    if (entity.kind !== 'enemy') continue;
    const def = content.enemies[entity.defId];
    if (def === undefined) continue;

    // forceRank hat Vorrang: `rank` ist nur dann noch undefiniert, wenn die
    // Kartendefinition nichts vorgegeben hat.
    let rank: NonNullable<Entity['rank']> =
      entity.rank ?? (rng.next() < chance ? 'equipped' : 'common');

    // Der Deckel gilt fuer gewuerfelte und vorgegebene `equipped` gleichermassen.
    // Bosse bleiben ausgenommen, ein Boss ohne seine Teile waere ein anderer Gegner.
    if (rank === 'equipped' && equipped >= MAX_EQUIPPED_PER_MAP) rank = 'common';
    entity.rank = rank;
    if (rank === 'common') continue;

    equipped += 1;
    const table = tableFor(content, def.dropTableId, rank === 'boss');
    if (table === undefined) continue;
    equipEnemy(state, rng, entity, table, content);
  }

  saveRng(state, rng);
}

/** Naechste freie Entitaets-Id der Karte. */
function takeEntityId(mapState: MapRuntimeState): number {
  const id = mapState.nextEntityId;
  mapState.nextEntityId += 1;
  return id;
}

/**
 * Hinterlassenschaft eines getoeteten Gegners: jedes getragene Teil faellt zu
 * 100 Prozent, dazu die Stapelware aus `EnemyDef.drops`.
 */
export function dropLoot(
  state: GameState,
  mapState: MapRuntimeState,
  entity: Entity,
  content: ContentDb
): GameEvent[] {
  const events: GameEvent[] = [];
  if (entity.kind !== 'enemy') return events;

  for (const slot of EQUIP_SLOTS) {
    const item = entity.equipment?.[slot];
    if (item === undefined) continue;
    addGroundItem(mapState, entity.pos, item);
    events.push({ type: 'itemDropped', pos: { x: entity.pos.x, y: entity.pos.y }, uid: item.uid });
  }
  if (entity.equipment !== undefined) entity.equipment = {};

  const drops = content.enemies[entity.defId]?.drops ?? [];
  if (drops.length === 0) return events;

  const rng = loadRng(state);
  for (const drop of drops) {
    if (rng.next() >= drop.chance) continue;
    if (content.items[drop.defId] === undefined) continue;
    // `drop.amount` ist die Zahl der Stapel, `ItemDef.amount` die Stapelgroesse.
    for (let count = 0; count < drop.amount; count++) {
      mapState.entities.push({
        id: takeEntityId(mapState),
        kind: 'item',
        defId: drop.defId,
        pos: { x: entity.pos.x, y: entity.pos.y },
        facing: 0,
        actionPoints: 0,
        active: false,
        effects: [],
        animation: { frame: 'idle', startedAtTurn: 0 },
      });
    }
  }
  saveRng(state, rng);

  return events;
}
