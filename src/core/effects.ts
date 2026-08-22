/**
 * Statuseffekte nach SPEC v1.2 Abschnitt 4.5.
 *
 * Kein Stapeln, die Dauer wird erneuert. Feste Abarbeitungsreihenfolge
 * `burn`, `toxin`, `drain`, `chill`, `jolt`. Ein Effekt greift nicht, wenn die
 * Resistenz des Ziels gegen sein Element 50 oder hoeher ist.
 */
import { enemyActor, getDerivedStats, playerActor } from './derived';
import {
  BOON_STATS,
  EFFECT_DEFS,
  EFFECT_ORDER,
  EFFECT_RESIST_THRESHOLD,
  isEffectId,
} from './effectDefs';
import type { EffectId } from './effectDefs';
import { isAlive } from './entities';
import type {
  ActiveEffect,
  Actor,
  ContentDb,
  DamageType,
  Difficulty,
  EntityId,
  GameEvent,
  GameState,
} from './types';

/** Effektliste eines Akteurs. Wird in place veraendert. */
function effectsOf(actor: Actor): ActiveEffect[] {
  return actor.kind === 'player' ? actor.state.effects : actor.entity.effects;
}

function refOf(actor: Actor): EntityId | 'player' {
  return actor.kind === 'player' ? 'player' : actor.entity.id;
}

function healthOf(actor: Actor): number {
  return actor.kind === 'player' ? actor.state.health : (actor.entity.health ?? 0);
}

function setHealth(actor: Actor, value: number): void {
  if (actor.kind === 'player') {
    actor.state.health = value;
  } else {
    actor.entity.health = value;
  }
}

/**
 * Legt einen Effekt an oder erneuert seine Dauer.
 *
 * Der letzte Parameter steht nicht in der Skizze in PHASE_3_5.md, wird aber
 * gebraucht: die Resistenzschwelle haengt ueber getDerivedStats am
 * Schwierigkeitsgrad. INTERFACES definiert diese Funktion nicht.
 */
export function applyEffect(
  target: Actor,
  effectId: string,
  sourceType: DamageType,
  magnitude: number,
  content: ContentDb,
  difficulty: Difficulty
): GameEvent[] {
  if (!isEffectId(effectId)) return [];
  const def = EFFECT_DEFS[effectId];

  const stats = getDerivedStats(target, content, difficulty);
  if (stats.resistances[sourceType] >= EFFECT_RESIST_THRESHOLD) return [];

  const effects = effectsOf(target);
  const existing = effects.find((effect) => effect.id === effectId);
  if (existing !== undefined) {
    // Kein Stapeln: nur die Dauer wird erneuert.
    existing.remainingTurns = def.turns;
    existing.magnitude = magnitude;
    existing.sourceType = sourceType;
  } else {
    effects.push({ id: effectId, remainingTurns: def.turns, magnitude, sourceType });
  }

  return [{ type: 'effectApplied', who: refOf(target), effectId, turns: def.turns }];
}

/** Legt einen Effekt mit den Standardwerten aus der Tabelle an. */
/**
 * Setzt einen foerderlichen Effekt aus CONTENT_TABLES Abschnitt 1.
 * Dauer und Staerke kommen aus dem `ItemDef`, nicht aus der Effekttabelle, und
 * es gibt keine Resistenzpruefung: das ist kein Angriff.
 */
export function applyBoon(
  target: Actor,
  effectId: string,
  turns: number,
  magnitude: number
): GameEvent[] {
  if (BOON_STATS[effectId] === undefined) return [];

  const effects = effectsOf(target);
  const existing = effects.find((effect) => effect.id === effectId);
  if (existing !== undefined) {
    existing.remainingTurns = turns;
    existing.magnitude = magnitude;
  } else {
    effects.push({ id: effectId, remainingTurns: turns, magnitude, sourceType: 'physical' });
  }
  return [{ type: 'effectApplied', who: refOf(target), effectId, turns }];
}

/** Entfernt einen laufenden Effekt. Liefert das `effectExpired`-Ereignis. */
export function removeEffect(target: Actor, effectId: string): GameEvent[] {
  const effects = effectsOf(target);
  const index = effects.findIndex((effect) => effect.id === effectId);
  if (index < 0) return [];
  effects.splice(index, 1);
  return [{ type: 'effectExpired', who: refOf(target), effectId }];
}

export function applyEffectDefault(
  target: Actor,
  effectId: string,
  content: ContentDb,
  difficulty: Difficulty
): GameEvent[] {
  if (!isEffectId(effectId)) return [];
  const def = EFFECT_DEFS[effectId];
  return applyEffect(target, effectId, def.sourceType, def.magnitude, content, difficulty);
}

/** Schaden pro Runde. burn und toxin ignorieren Ruestung und Resistenz. */
function tickDamage(effect: ActiveEffect, id: EffectId): number {
  return id === 'burn' || id === 'toxin' ? Math.max(0, Math.round(effect.magnitude)) : 0;
}

/**
 * Arbeitet die Effekte eines Akteurs ab und zaehlt die Dauer herunter.
 * `died` wird nur fuer Gegner gemeldet; der Tod des Spielers wird einmal in
 * advanceRound gemeldet, sonst gaebe es das Ereignis doppelt.
 */
function tickActor(actor: Actor, content: ContentDb, difficulty: Difficulty): GameEvent[] {
  const events: GameEvent[] = [];
  const effects = effectsOf(actor);
  if (effects.length === 0) return events;
  const who = refOf(actor);

  for (const id of EFFECT_ORDER) {
    const effect = effects.find((candidate) => candidate.id === id);
    if (effect === undefined || effect.remainingTurns <= 0) continue;
    if (healthOf(actor) <= 0) break;

    const damage = tickDamage(effect, id);
    if (damage > 0) {
      setHealth(actor, healthOf(actor) - damage);
      events.push({ type: 'effectTick', who, effectId: id, damage });
      if (healthOf(actor) <= 0) {
        setHealth(actor, 0);
        if (actor.kind === 'enemy') events.push({ type: 'died', who });
      }
    }

    effect.remainingTurns -= 1;
    if (effect.remainingTurns <= 0) {
      events.push({ type: 'effectExpired', who, effectId: id });
    }
  }

  // Foerderliche Effekte richten keinen Schaden an, laufen aber genauso ab
  // (CONTENT_TABLES Abschnitt 1). Sie stehen nicht in EFFECT_ORDER.
  for (const effect of effects) {
    if (BOON_STATS[effect.id] === undefined || effect.remainingTurns <= 0) continue;
    effect.remainingTurns -= 1;
    if (effect.remainingTurns <= 0) {
      events.push({ type: 'effectExpired', who, effectId: effect.id });
    }
  }

  // Abgelaufene Effekte erst nach der Schleife entfernen, damit die Reihenfolge steht.
  const remaining = effects.filter((effect) => effect.remainingTurns > 0);
  effects.length = 0;
  effects.push(...remaining);

  // `drain` senkt maxHealth ueber getDerivedStats. Faellt maxHealth unter die
  // aktuelle health, wird health mitgesenkt (RPG.md Abschnitt 2).
  const maxHealth = getDerivedStats(actor, content, difficulty).maxHealth;
  if (healthOf(actor) > maxHealth) setHealth(actor, maxHealth);

  return events;
}

/** Schritt 4 der Runde: alle Statuseffekte abarbeiten. */
export function tickEffects(state: GameState, content: ContentDb): GameEvent[] {
  const events: GameEvent[] = [];
  events.push(...tickActor(playerActor(state), content, state.difficulty));

  const mapState = state.maps[state.currentMapId];
  if (mapState === undefined) return events;

  for (const entity of [...mapState.entities]) {
    if (entity.kind !== 'enemy' || !isAlive(entity)) continue;
    const actor = enemyActor(entity, content);
    if (actor === null) continue;
    events.push(...tickActor(actor, content, state.difficulty));
  }

  return events;
}

/** Laeuft bei diesem Akteur gerade `chill`? SPEC 3.2, Schritt 3. */
export function hasChill(effects: readonly ActiveEffect[]): boolean {
  return effects.some((effect) => effect.id === 'chill' && effect.remainingTurns > 0);
}
