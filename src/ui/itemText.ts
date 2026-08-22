/**
 * Anzeigetexte fuer Gegenstaende, PHASE_4_5 Block 3.
 * Aus itemModel.ts herausgeloest, damit beide Dateien klein bleiben.
 */
import { getDerivedStats } from '../core/derived';
import { DAMAGE_TYPES } from '../core/types';
import { ATTRIBUTE_NAMES, DAMAGE_TYPE_NAMES } from '../core/text';
import { canEquip } from './itemModel';
import type {
  AffixDef,
  ContentDb,
  DamageType,
  DerivedStats,
  EquipSlot,
  GameState,
  ItemDef,
  ItemInstance,
  Rarity,
} from '../core/types';

/** Anzeigename eines Werts, deutsch. */
export function statLabel(stat: string): string {
  const labels: Record<string, string> = {
    maxHealth: 'Leben',
    armor: 'Rüstung',
    accuracy: 'Genauigkeit',
    evasion: 'Ausweichen',
    meleeBonus: 'Nahkampfschaden',
    elemBonus: 'Elementarschaden',
    critBonus: 'Kritische Trefferchance',
    lightRadius: 'Sichtweite',
    freeActionChance: 'Freie Aktion',
    ammoSaveChance: 'Munitionsersparnis',
    ...ATTRIBUTE_NAMES,
  };
  const resist = /^res_(\w+)$/.exec(stat);
  if (resist !== null) {
    const type = DAMAGE_TYPES.find((candidate) => candidate === resist[1]);
    return `Widerstand ${type === undefined ? (resist[1] ?? '') : DAMAGE_TYPE_NAMES[type]}`;
  }
  return labels[stat] ?? stat;
}

/** Eine Affixzeile, etwa `+14 Widerstand fire`. */
export function formatAffix(affix: AffixDef, value: number): string {
  const sign = value >= 0 ? '+' : '−';
  const amount = Math.abs(value);
  const unit = affix.mode === 'percent' ? ' %' : '';
  return `${sign}${amount}${unit} ${statLabel(affix.stat)}`;
}

/**
 * Alle Affixzeilen eines Teils. Nicht identifizierte Teile zeigen nur
 * Grundwerte, also keine Affixzeilen (RPG.md Abschnitt 4).
 */
export function affixLines(item: ItemInstance, content: ContentDb): string[] {
  if (!item.identified) return [];
  const lines: string[] = [];
  for (const rolled of item.affixes) {
    const affix = content.affixes[rolled.affixId];
    if (affix === undefined) continue;
    lines.push(formatAffix(affix, rolled.value));
  }
  return lines;
}

/** Grundwertzeilen eines Teils, immer sichtbar. */
export function baseLines(def: ItemDef): string[] {
  return (def.baseModifiers ?? []).map((mod) => {
    const sign = mod.value >= 0 ? '+' : '−';
    const unit = mod.mode === 'percent' ? ' %' : '';
    return `${sign}${Math.abs(mod.value)}${unit} ${statLabel(mod.stat)}`;
  });
}

/** Raritaetsfarbe als CSS-Klassenzusatz, passend zu ui.css. */
export function rarityClass(rarity: Rarity): string {
  return `sx-rarity--${rarity}`;
}

export type ItemDetail = {
  name: string;
  rarity: Rarity;
  slot: EquipSlot;
  baseName: string;
  itemLevel: number;
  base: string[];
  affixes: string[];
  requirements: { text: string; met: boolean }[];
  identified: boolean;
};

/** Alles, was die Detailansicht eines Gegenstands zeigt. */
export function itemDetail(
  state: GameState,
  item: ItemInstance,
  content: ContentDb,
  attributes = state.player.attributes
): ItemDetail | null {
  const def = content.items[item.baseId];
  if (def === undefined) return null;

  const check = canEquip(state.player, item, content, attributes);
  const missing = new Set(check.missing.map((entry) => entry.field));
  const requirements = [
    { text: `Stufe ${def.reqLevel}`, met: !missing.has('level'), show: def.reqLevel > 1 },
    { text: `Kraft ${def.reqStrength}`, met: !missing.has('strength'), show: def.reqStrength > 0 },
    { text: `Geschick ${def.reqAgility}`, met: !missing.has('agility'), show: def.reqAgility > 0 },
  ]
    .filter((entry) => entry.show)
    .map(({ text, met }) => ({ text, met }));

  return {
    name: def.name,
    rarity: item.rarity,
    slot: item.slot,
    baseName: def.id,
    itemLevel: item.itemLevel,
    base: baseLines(def),
    affixes: affixLines(item, content),
    requirements,
    identified: item.identified,
  };
}

/** Bequemer Zugriff auf die abgeleiteten Werte des Spielers. */
export function playerStats(state: GameState, content: ContentDb): DerivedStats {
  return getDerivedStats({ kind: 'player', state: state.player }, content, state.difficulty);
}

/** Resistenzwerte als Liste, fuer den Charakterbogen. */
export function resistanceList(stats: DerivedStats): { type: DamageType; value: number }[] {
  return DAMAGE_TYPES.map((type) => ({ type, value: stats.resistances[type] }));
}
