/**
 * `sweep` (Rundschlag), RPG.md Abschnitt 5.
 * Trifft jeden Gegner in Chebyshev-Distanz 1 mit einem eigenen Trefferwurf.
 * Die Reihenfolge ist die aufsteigende Entitaets-Id, damit der Ablauf
 * reproduzierbar bleibt (PHASE_3_7 Block 5).
 */
import { currentScene } from '../actionResult';
import { collectKills } from '../attack';
import { resolveAttack } from '../combat';
import { enemyActor, getDerivedStats, playerActor } from '../derived';
import { isAlive, isGuarded, vitalsOf } from '../entities';
import { chebyshev } from '../grid';
import { loadRng, saveRng } from '../rng';
import { executionBonus, sweepFactor } from './rules';
import type {
  ContentDb,
  EntityId,
  GameEvent,
  GameState,
  SkillDef,
  WeaponDef,
} from '../types';

/** Waffe mit dem anteiligen Schaden des Rundschlags. */
function sweepWeapon(weapon: WeaponDef, points: number): WeaponDef {
  const factor = sweepFactor(points);
  return {
    ...weapon,
    dmgMin: Math.max(1, Math.round(weapon.dmgMin * factor)),
    dmgMax: Math.max(1, Math.round(weapon.dmgMax * factor)),
  };
}

export function sweepHandler(
  state: GameState,
  _skill: SkillDef,
  points: number,
  _targetId: EntityId | undefined,
  content: ContentDb
): GameEvent[] {
  const here = currentScene(state, content);
  if (here === null) return [{ type: 'invalid', reason: 'unknown map' }];

  const weapon = content.weapons[state.player.equippedWeaponId];
  if (weapon === undefined) return [{ type: 'invalid', reason: 'no weapon equipped' }];

  const targets = here.mapState.entities
    .filter(
      (entity) =>
        entity.kind === 'enemy' &&
        isAlive(entity) &&
        chebyshev(state.player.pos, entity.pos) <= 1
    )
    .sort((a, b) => a.id - b.id);
  if (targets.length === 0) return [{ type: 'invalid', reason: 'no target' }];

  const scaled = sweepWeapon(weapon, points);
  const playerStats = getDerivedStats(playerActor(state), content, state.difficulty);
  const bonus = executionBonus(state.player, content);
  const rng = loadRng(state);
  const events: GameEvent[] = [];

  for (const target of targets) {
    const actor = enemyActor(target, content);
    if (actor === null) continue;
    events.push(
      ...resolveAttack(
        rng,
        { ref: 'player', stats: playerStats, vitals: state.player },
        {
          ref: target.id,
          stats: getDerivedStats(actor, content, state.difficulty),
          vitals: vitalsOf(target),
          guarded: isGuarded(target),
        },
        scaled,
        chebyshev(state.player.pos, target.pos),
        { executionBonus: bonus }
      )
    );
    target.active = true;
  }

  saveRng(state, rng);
  events.push(...collectKills(state, content, here.mapState, events));
  return events;
}
