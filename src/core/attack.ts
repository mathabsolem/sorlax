/**
 * Angriffe des Spielers. Zielwahl, Munition, Schaden, Effekte, Flaechenschaden
 * und die Vergabe von XP fuer erlegte Gegner.
 */
import { applySplash, resolveAttack } from './combat';
import type { SplashTarget } from './combat';
import { enemyActor, getDerivedStats } from './derived';
import { applyEffectDefault } from './effects';
import { isAlive, isGuarded, vitalsOf } from './entities';
import { chebyshev, hasLineOfSight } from './grid';
import { grantXp } from './progression';
import { scaledXpReward } from './scaling';
import { executionBonus } from './skills/rules';
import { loadRng, saveRng } from './rng';
import { playerDerived, reapDead } from './turn';
import type {
  ContentDb,
  Entity,
  EntityId,
  GameEvent,
  GameState,
  MapDef,
  MapRuntimeState,
} from './types';
import type { ActionResult } from './actionResult';
import { currentScene } from './actionResult';

/** Naechster sichtbarer Gegner in Reichweite, bei Gleichstand die kleinere Id. */
function autoTarget(
  state: GameState,
  map: MapDef,
  mapState: MapRuntimeState,
  maxRange: number
): Entity | undefined {
  let best: Entity | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const entity of mapState.entities) {
    if (entity.kind !== 'enemy' || !isAlive(entity)) continue;
    const distance = chebyshev(state.player.pos, entity.pos);
    if (distance > maxRange) continue;
    if (!hasLineOfSight(map, state.player.pos, entity.pos, mapState)) continue;
    if (distance < bestDistance || (distance === bestDistance && best !== undefined && entity.id < best.id)) {
      best = entity;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Vergibt XP fuer alle in `events` getoeteten Gegner, raeumt sie ab und laesst
 * ihre Ausruestung fallen. Wird auch von den aktiven Fertigkeiten benutzt.
 */
export function collectKills(
  state: GameState,
  content: ContentDb,
  mapState: MapRuntimeState,
  events: GameEvent[]
): GameEvent[] {
  let reward = 0;
  for (const event of events) {
    if (event.type !== 'died' || event.who === 'player') continue;
    const entity = mapState.entities.find((candidate) => candidate.id === event.who);
    if (entity === undefined || entity.kind !== 'enemy') continue;
    const def = content.enemies[entity.defId];
    if (def === undefined) continue;
    reward += scaledXpReward(def, entity.monsterLevel ?? 1, state.difficulty);
  }
  const after = reapDead(state, mapState, content);
  if (reward > 0) after.push(...grantXp(state.player, reward, content.progression));
  return after;
}

/** Alle moeglichen Ziele einer Explosion, Spieler eingeschlossen. */
function splashTargets(
  state: GameState,
  content: ContentDb,
  mapState: MapRuntimeState
): SplashTarget[] {
  const targets: SplashTarget[] = [
    {
      ref: 'player',
      stats: playerDerived(state, content),
      vitals: state.player,
      pos: state.player.pos,
    },
  ];
  for (const entity of [...mapState.entities]) {
    if (entity.kind !== 'enemy' || !isAlive(entity)) continue;
    const actor = enemyActor(entity, content);
    if (actor === null) continue;
    targets.push({
      ref: entity.id,
      stats: getDerivedStats(actor, content, state.difficulty),
      vitals: vitalsOf(entity),
      pos: entity.pos,
    });
  }
  return targets;
}

/**
 * Stellschrauben eines Angriffs, die nicht aus den abgeleiteten Werten kommen.
 * `armorPierce` ist der Anteil der Ruestung, den der Angriff ignoriert; er kommt
 * aus der Fertigkeit `breach` (PHASE_3_7 Block 5) und laesst die Resistenz
 * ausdruecklich unberuehrt.
 */
export type AttackModifiers = { armorPierce?: number };

/** Angriff auf ein Ziel oder auf den naechsten sichtbaren Gegner. */
export function attackAction(
  state: GameState,
  content: ContentDb,
  targetId?: EntityId,
  modifiers: AttackModifiers = {}
): ActionResult {
  const here = currentScene(state, content);
  if (here === null) return { ok: false, reason: 'unknown map' };
  const weapon = content.weapons[state.player.equippedWeaponId];
  if (weapon === undefined) return { ok: false, reason: 'no weapon equipped' };

  const ammoType = weapon.ammoType;
  if (ammoType !== null && (state.player.ammo[ammoType] ?? 0) < weapon.ammoPerShot) {
    return { ok: false, reason: 'out of ammo' };
  }

  const target =
    targetId === undefined
      ? autoTarget(state, here.map, here.mapState, weapon.maxRange)
      : here.mapState.entities.find((candidate) => candidate.id === targetId);
  if (target === undefined || target.kind !== 'enemy' || !isAlive(target)) {
    return { ok: false, reason: 'no target' };
  }
  const targetActor = enemyActor(target, content);
  if (targetActor === null) return { ok: false, reason: 'unknown enemy' };

  const distance = chebyshev(state.player.pos, target.pos);
  if (distance > weapon.maxRange) return { ok: false, reason: 'target out of range' };
  if (!hasLineOfSight(here.map, state.player.pos, target.pos, here.mapState)) {
    return { ok: false, reason: 'no line of sight' };
  }

  const playerStats = playerDerived(state, content);
  const rng = loadRng(state);

  if (ammoType !== null) {
    // SPEC 4.4: ammoSaveChance verhindert den Verbrauch, nicht den Schuss.
    // Bei Chance 0 wird kein Wurf verbraucht, damit der Zufallsstrom ohne
    // entsprechende Ausruestung unveraendert bleibt.
    const saved = playerStats.ammoSaveChance > 0 && rng.next() < playerStats.ammoSaveChance;
    if (!saved) {
      state.player.ammo[ammoType] = (state.player.ammo[ammoType] ?? 0) - weapon.ammoPerShot;
    }
  }

  // `breach` senkt die Ruestung des Ziels vor der Anwendung, die Resistenz
  // bleibt unberuehrt (PHASE_3_7 Block 5).
  const targetStats = getDerivedStats(targetActor, content, state.difficulty);
  const pierce = modifiers.armorPierce ?? 0;
  const defenderStats =
    pierce > 0
      ? { ...targetStats, armor: Math.floor(targetStats.armor * (1 - pierce)) }
      : targetStats;

  const events = resolveAttack(
    rng,
    { ref: 'player', stats: playerStats, vitals: state.player },
    { ref: target.id, stats: defenderStats, vitals: vitalsOf(target), guarded: isGuarded(target) },
    weapon,
    distance,
    { executionBonus: executionBonus(state.player, content) }
  );
  saveRng(state, rng);
  target.active = true;

  const hit = events.some((event) => event.type === 'attack' && event.hit);
  const effectId = weapon.appliesEffect;
  if (hit && effectId !== undefined && isAlive(target)) {
    events.push(...applyEffectDefault(targetActor, effectId, content, state.difficulty));
  }

  const splash = weapon.splash;
  if (splash !== undefined) {
    events.push(
      ...applySplash(
        splashTargets(state, content, here.mapState),
        target.pos,
        splash,
        weapon.damageType,
        'player'
      )
    );
  }

  events.push(...collectKills(state, content, here.mapState, events));
  return { ok: true, events };
}
