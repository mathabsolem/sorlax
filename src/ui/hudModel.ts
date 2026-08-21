/**
 * Reine Berechnungen des HUD, PHASE_4 Block 2 und 3.
 *
 * Hier steht nichts, was das DOM anfasst. Die Oberflaeche liest den
 * GameState und erzeugt Command-Objekte, sie mutiert ihn nie.
 */
import { EFFECT_ORDER } from '../core/effectDefs';
import { getDerivedStats, playerActor } from '../core/derived';
import { activeWeapon } from '../core/items';
import { knowsResistance } from '../core/knowledge';
import { xpToNextLevel } from '../core/progression';
import type {
  ActiveEffect,
  ContentDb,
  DamageType,
  DerivedStats,
  Entity,
  GameState,
  SkillDef,
} from '../core/types';

/** Anteil, auf drei Stellen gerundet. Genug fuer eine Balkenbreite in Prozent. */
function ratioOf(current: number, max: number): number {
  if (max <= 0) return 0;
  const clamped = Math.min(1, Math.max(0, current / max));
  return Math.round(clamped * 1000) / 1000;
}

export type Bar = { text: string; ratio: number };

/** Lebensbalken: Text im Format `health / maxHealth` und Anteil. */
export function formatHealth(health: number, maxHealth: number): Bar {
  return { text: `${health} / ${maxHealth}`, ratio: ratioOf(health, maxHealth) };
}

/**
 * Fortschritt zur naechsten Stufe. Die Schwellen sind Gesamtwerte, deshalb
 * zaehlt der Abstand zwischen der vorigen und der naechsten Schwelle.
 */
export function xpProgress(
  level: number,
  xp: number,
  progression: { xpThresholds: number[] }
): number {
  const next = xpToNextLevel(level, progression);
  if (!Number.isFinite(next)) return 1;
  const previous = level <= 1 ? 0 : (progression.xpThresholds[level - 2] ?? 0);
  return ratioOf(xp - previous, next - previous);
}

export type SkillSlot = {
  skillId: string;
  name: string;
  /** `ready` heisst benutzbar, `cooling` heisst abgeblendet mit Restrunden. */
  state: 'ready' | 'cooling';
  remaining: number;
};

/** Zustand eines Platzes in der Fertigkeitsleiste. */
export function skillSlotState(def: SkillDef, cooldown: number): SkillSlot {
  const remaining = Math.max(0, cooldown);
  return {
    skillId: def.id,
    name: def.name,
    state: remaining > 0 ? 'cooling' : 'ready',
    remaining,
  };
}

/** Hoechstzahl Plaetze in der Fertigkeitsleiste, SPEC Abschnitt 12 (F1 bis F6). */
export const SKILL_SLOTS = 6;

/** Die belegten Plaetze der Leiste, sortiert nach Stufe und Id. */
export function skillBar(state: GameState, content: ContentDb): SkillSlot[] {
  return Object.keys(state.player.skills)
    .map((skillId) => content.skills[skillId])
    .filter((def): def is SkillDef => def !== undefined && def.active && !def.locked)
    .filter((def) => (state.player.skills[def.id] ?? 0) > 0)
    .sort((a, b) => a.tier - b.tier || (a.id < b.id ? -1 : 1))
    .slice(0, SKILL_SLOTS)
    .map((def) => skillSlotState(def, state.player.cooldowns[def.id] ?? 0));
}

export type EffectChip = { id: string; remaining: number; sourceType: DamageType };

/** Laufende Statuseffekte in der festen Reihenfolge aus SPEC 4.5. */
export function effectChips(effects: readonly ActiveEffect[]): EffectChip[] {
  const chips: EffectChip[] = [];
  for (const id of EFFECT_ORDER) {
    const effect = effects.find((candidate) => candidate.id === id && candidate.remainingTurns > 0);
    if (effect === undefined) continue;
    chips.push({ id, remaining: effect.remainingTurns, sourceType: effect.sourceType });
  }
  return chips;
}

export type WeaponLine = { name: string; ammo: string };

/** Waffenzeile. Nahkampf zeigt statt eines Munitionsstands einen Strich. */
export function weaponLine(state: GameState, content: ContentDb): WeaponLine {
  const weapon = activeWeapon(state, content);
  const ammoType = weapon.ammoType;
  return {
    name: weapon.name,
    ammo: ammoType === null ? '—' : String(state.player.ammo[ammoType] ?? 0),
  };
}

export type HudModel = {
  health: Bar;
  armor: number;
  weapon: WeaponLine;
  effects: EffectChip[];
  level: number;
  xpRatio: number;
  skills: SkillSlot[];
  turnCount: number;
  mapName: string;
};

/** Alles, was das HUD anzeigt, in einem Durchgang berechnet. */
export function hudModel(state: GameState, content: ContentDb): HudModel {
  const stats = getDerivedStats(playerActor(state), content, state.difficulty);
  return {
    health: formatHealth(state.player.health, stats.maxHealth),
    armor: stats.armor,
    weapon: weaponLine(state, content),
    effects: effectChips(state.player.effects),
    level: state.player.level,
    xpRatio: xpProgress(state.player.level, state.player.xp, content.progression),
    skills: skillBar(state, content),
    turnCount: state.turnCount,
    mapName: content.maps[state.currentMapId]?.name ?? state.currentMapId,
  };
}

export type TargetModel = {
  name: string;
  health: Bar;
  rank: NonNullable<Entity['rank']>;
  element: DamageType;
  /** Nur die Resistenzen, die der Spieler selbst erlebt hat. */
  knownResistances: { type: DamageType; value: number }[];
};

/**
 * Zielanzeige. Resistenzwerte erscheinen erst, wenn der Spieler den Gegner mit
 * dieser Schadensart mindestens einmal getroffen hat (PHASE_4 Block 3).
 */
export function targetModel(
  state: GameState,
  content: ContentDb,
  entity: Entity,
  stats: DerivedStats
): TargetModel | null {
  const def = content.enemies[entity.defId];
  if (def === undefined) return null;

  const known: TargetModel['knownResistances'] = [];
  for (const type of Object.keys(stats.resistances).sort() as DamageType[]) {
    if (!knowsResistance(state, entity.defId, type)) continue;
    known.push({ type, value: stats.resistances[type] });
  }

  return {
    name: def.name,
    health: formatHealth(entity.health ?? 0, stats.maxHealth),
    rank: entity.rank ?? 'common',
    element: def.element,
    knownResistances: known,
  };
}
