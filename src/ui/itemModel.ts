/**
 * Reine Berechnungen rund um Gegenstaende, PHASE_4_5 Bloecke 1 bis 3.
 *
 * Nichts hier fasst das DOM an, und nichts mutiert den GameState. Der
 * Vergleich arbeitet auf einer flachen Kopie des Spielers.
 */
import { getDerivedStats } from '../core/derived';
import { slotsFor } from '../core/items';
import { DAMAGE_TYPES } from '../core/types';
import type {
  ContentDb,
  EquipSlot,
  GameState,
  ItemInstance,
  PlayerState,
} from '../core/types';

/** Werte, die im Vergleich zusammengefasst werden (PHASE_4_5 Block 3). */
export const SUMMARY_STATS = ['maxHealth', 'armor', 'accuracy', 'evasion'] as const;
export type SummaryStat = (typeof SUMMARY_STATS)[number];

/** Werte, aus denen sich entscheidet, ob ein Fund besser ist (Block 7). */
const UPGRADE_STATS: readonly SummaryStat[] = SUMMARY_STATS;

export type Requirement = { field: 'level' | 'strength' | 'agility'; needed: number; have: number };

export type EquipCheck = { ok: boolean; missing: Requirement[] };

/**
 * Darf der Spieler das Teil anlegen? Nennt bei false jede nicht erfuellte
 * Voraussetzung samt fehlendem Wert.
 */
export function canEquip(
  player: PlayerState,
  item: ItemInstance,
  content: ContentDb,
  attributes = player.attributes
): EquipCheck {
  const def = content.items[item.baseId];
  if (def === undefined) return { ok: false, missing: [] };

  const missing: Requirement[] = [];
  if (player.level < def.reqLevel) {
    missing.push({ field: 'level', needed: def.reqLevel, have: player.level });
  }
  if (attributes.strength < def.reqStrength) {
    missing.push({ field: 'strength', needed: def.reqStrength, have: attributes.strength });
  }
  if (attributes.agility < def.reqAgility) {
    missing.push({ field: 'agility', needed: def.reqAgility, have: attributes.agility });
  }
  return { ok: missing.length === 0, missing };
}

/** Das getragene Teil, gegen das ein Kandidat verglichen wird. */
export function wornFor(player: PlayerState, item: ItemInstance): ItemInstance | null {
  for (const slot of slotsFor(item)) {
    const worn = player.equipment[slot];
    if (worn !== undefined) return worn;
  }
  return null;
}

/** Beitrag eines Teils zu einem einzelnen Wert, flach und prozentual getrennt. */
function contribution(
  item: ItemInstance | null,
  stat: string,
  content: ContentDb
): { flat: number; percent: number } {
  if (item === null) return { flat: 0, percent: 0 };
  let flat = 0;
  let percent = 0;

  const def = content.items[item.baseId];
  for (const mod of def?.baseModifiers ?? []) {
    if (mod.stat !== stat) continue;
    if (mod.mode === 'flat') flat += mod.value;
    else percent += mod.value;
  }
  for (const rolled of item.affixes) {
    const affix = content.affixes[rolled.affixId];
    if (affix === undefined || affix.stat !== stat) continue;
    if (affix.mode === 'flat') flat += rolled.value;
    else percent += rolled.value;
  }
  return { flat, percent };
}

export type StatDelta = { stat: string; candidate: number; worn: number; delta: number };

export type Comparison = {
  worn: ItemInstance | null;
  slot: EquipSlot;
  /** Differenz je Wert, den eines der beiden Teile traegt. */
  perStat: StatDelta[];
  /** Veraenderung der abgeleiteten Werte mit hypothetisch angelegtem Teil. */
  derived: { stat: string; before: number; after: number; delta: number }[];
};

/** Alle Werte, die eines der beiden Teile beruehrt. */
function touchedStats(
  candidate: ItemInstance,
  worn: ItemInstance | null,
  content: ContentDb
): string[] {
  const stats = new Set<string>();
  for (const item of [candidate, worn]) {
    if (item === null) continue;
    const def = content.items[item.baseId];
    for (const mod of def?.baseModifiers ?? []) stats.add(mod.stat);
    for (const rolled of item.affixes) {
      const affix = content.affixes[rolled.affixId];
      if (affix !== undefined) stats.add(affix.stat);
    }
  }
  return [...stats].sort();
}

/** Spieler mit hypothetisch angelegtem Teil. Kopie, der echte bleibt unberuehrt. */
function playerWith(player: PlayerState, item: ItemInstance | null, slot: EquipSlot): PlayerState {
  const equipment = { ...player.equipment };
  if (item === null) delete equipment[slot];
  else equipment[slot] = item;
  return { ...player, equipment };
}

/**
 * Vergleich eines Kandidaten mit dem getragenen Teil.
 * Werte, die nur eines der beiden traegt, zaehlen gegen null.
 * Der uebergebene Zustand wird nicht angefasst.
 */
export function compareItems(
  state: GameState,
  candidate: ItemInstance,
  content: ContentDb
): Comparison {
  const worn = wornFor(state.player, candidate);
  const slot = worn?.slot ?? candidate.slot;

  const perStat: StatDelta[] = [];
  for (const stat of touchedStats(candidate, worn, content)) {
    const mine = contribution(candidate, stat, content);
    const theirs = contribution(worn, stat, content);
    const candidateValue = mine.flat + mine.percent;
    const wornValue = theirs.flat + theirs.percent;
    perStat.push({ stat, candidate: candidateValue, worn: wornValue, delta: candidateValue - wornValue });
  }

  const before = getDerivedStats(
    { kind: 'player', state: state.player },
    content,
    state.difficulty
  );
  const after = getDerivedStats(
    { kind: 'player', state: playerWith(state.player, candidate, slot) },
    content,
    state.difficulty
  );

  const derived: Comparison['derived'] = [];
  for (const stat of SUMMARY_STATS) {
    derived.push({ stat, before: before[stat], after: after[stat], delta: after[stat] - before[stat] });
  }
  for (const type of DAMAGE_TYPES) {
    const from = before.resistances[type];
    const to = after.resistances[type];
    if (from === to) continue;
    derived.push({ stat: `res_${type}`, before: from, after: to, delta: to - from });
  }

  return { worn, slot, perStat, derived };
}

/**
 * Ist der Fund besser als das Getragene? Gewertet wird die Summe aus
 * maxHealth, armor, accuracy und evasion (PHASE_4_5 Block 7).
 */
export function isUpgrade(
  state: GameState,
  candidate: ItemInstance,
  content: ContentDb
): boolean {
  const comparison = compareItems(state, candidate, content);
  const sum = comparison.derived
    .filter((entry): entry is { stat: SummaryStat; before: number; after: number; delta: number } =>
      (UPGRADE_STATS as readonly string[]).includes(entry.stat)
    )
    .reduce((total, entry) => total + entry.delta, 0);
  return sum > 0;
}
