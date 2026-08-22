/**
 * Reine Berechnungen fuer Charakterbogen und Fertigkeitenbaum,
 * PHASE_4_5 Bloecke 5 und 6.
 */
import { getDerivedStats } from '../core/derived';
import { collectEquipmentModifiers, collectSkillModifiers, flatOf, percentOf } from '../core/modifiers';
import { skillbarKey } from '../core/skillActions';
import { pointsInTree, skillPoints } from '../core/skills/rules';
import { SKILL_SLOTS } from './hudModel';
import type { ContentDb, GameState, SkillDef, SkillTreeId } from '../core/types';

/** Basiswert eines abgeleiteten Werts allein aus den Attributen, RPG.md Abschnitt 2. */
function attributeBase(state: GameState, stat: string): number {
  const { strength, agility, vitality, focus } = state.player.attributes;
  switch (stat) {
    case 'maxHealth':
      return 20 + 3 * vitality;
    case 'accuracy':
      return Math.floor(4 + 0.6 * agility);
    case 'evasion':
      return Math.floor(1 + 0.4 * agility);
    case 'armor':
      return 0;
    case 'meleeBonus':
      return 0.01 * (strength - 10);
    case 'elemBonus':
      return 0.01 * (focus - 10);
    case 'critBonus':
      return 0.002 * (focus - 10);
    case 'lightRadius':
      return 4;
    default:
      return 0;
  }
}

export type Breakdown = {
  stat: string;
  base: number;
  equipment: number;
  skills: number;
  total: number;
};

/**
 * Aufschluesselung eines abgeleiteten Werts in Basis, Ausruestung und
 * Fertigkeiten. Die Summe entspricht dem Wert aus getDerivedStats; genau das
 * prueft Test 10 aus PHASE_4_5.
 */
export function statBreakdown(state: GameState, content: ContentDb, stat: string): Breakdown {
  const stats = getDerivedStats({ kind: 'player', state: state.player }, content, state.difficulty);
  const total = (stats as unknown as Record<string, number>)[stat] ?? 0;

  const base = attributeBase(state, stat);
  const gear = collectEquipmentModifiers(state.player.equipment, content);
  const skills = collectSkillModifiers(state.player.skills, content);

  // Groessenwerte werden flach addiert, Verhaeltniswerte in Prozentpunkten
  // gefuehrt und durch 100 geteilt. Das folgt modifiers.ts.
  const ratio = ['meleeBonus', 'elemBonus', 'critBonus', 'freeActionChance', 'ammoSaveChance'];
  const scale = ratio.includes(stat) ? 0.01 : 1;
  const fromGear = (flatOf(gear, stat) + percentOf(gear, stat)) * scale;
  const fromSkills = (flatOf(skills, stat) + percentOf(skills, stat)) * scale;

  // Der Rest ist Rundung und Attributsaffixe, die ueber die Basis wirken.
  const rest = total - (base + fromGear + fromSkills);
  return {
    stat,
    base: base + rest,
    equipment: fromGear,
    skills: fromSkills,
    total,
  };
}

export type SkillNodeState =
  | { state: 'available'; points: number; maxPoints: number }
  | { state: 'maxed'; points: number; maxPoints: number }
  | { state: 'blocked'; points: number; maxPoints: number; reason: 'reqLevel' | 'reqPointsInTree'; needed: number }
  | { state: 'locked'; points: number; maxPoints: number };

/** Zustand einer Fertigkeit im Baum, PHASE_4_5 Block 6. */
export function skillNodeState(
  state: GameState,
  def: SkillDef,
  content: ContentDb
): SkillNodeState {
  const points = skillPoints(state.player, def.id);
  const shape = { points, maxPoints: def.maxPoints };

  if (def.locked) return { state: 'locked', ...shape };
  if (points >= def.maxPoints) return { state: 'maxed', ...shape };
  if (state.player.level < def.reqLevel) {
    return { state: 'blocked', ...shape, reason: 'reqLevel', needed: def.reqLevel };
  }
  const inTree = pointsInTree(state.player, def.tree, content, def.id);
  if (inTree < def.reqPointsInTree) {
    return { state: 'blocked', ...shape, reason: 'reqPointsInTree', needed: def.reqPointsInTree };
  }
  return { state: 'available', ...shape };
}

export type PointPreview = { stat: string; now: number; next: number } | null;

/**
 * Wirkung des naechsten Punkts, konkret ausgerechnet statt als Formel.
 * Also `Genauigkeit 9 auf 12`, nicht `plus 3 pro Punkt`.
 */
export function nextPointPreview(def: SkillDef, points: number): PointPreview {
  const modifier = def.modifiers?.[0];
  if (modifier === undefined) return null;
  return {
    stat: modifier.stat,
    now: modifier.perPoint * points,
    next: modifier.perPoint * (points + 1),
  };
}

/** Alle Fertigkeiten eines Baums, nach Stufe und Id sortiert. */
export function treeNodes(content: ContentDb, tree: SkillTreeId): SkillDef[] {
  return Object.values(content.skills)
    .filter((def) => def.tree === tree)
    .sort((a, b) => a.tier - b.tier || (a.id < b.id ? -1 : 1));
}

/** Alle Fertigkeiten, die auf die Leiste duerfen. */
export function assignableSkills(content: ContentDb): SkillDef[] {
  return Object.values(content.skills)
    .filter((def) => def.active && !def.locked)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * Die Fertigkeit auf einem Platz der Leiste, oder null.
 * Seit INTERFACES v1.4 traegt `flags` Zeichenketten, gespeichert wird die
 * `skillId` selbst.
 */
export function skillbarAssignment(
  state: GameState,
  content: ContentDb,
  index: number
): SkillDef | null {
  const value = state.flags[skillbarKey(index)];
  if (typeof value !== 'string') return null;
  return content.skills[value] ?? null;
}

/** Alle sechs Plaetze der Leiste. */
export function skillbarSlots(state: GameState, content: ContentDb): (SkillDef | null)[] {
  return Array.from({ length: SKILL_SLOTS }, (_unused, index) =>
    skillbarAssignment(state, content, index)
  );
}
