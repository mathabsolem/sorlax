/**
 * Animationszustand des Renderers. Vollstaendig getrennt vom Spielzustand,
 * `consumeEvents` reiht Schritte ein, `advance` treibt sie voran. Dauern nach
 * docs/tasks/PHASE_3.md.
 *
 * Es laeuft immer nur ein Objekt: Spieler und Gegner animieren nacheinander,
 * nie gleichzeitig. Die Ereignisse einer Runde landen deshalb in einer
 * Warteschlange und werden in ihrer Reihenfolge abgespielt. Ein Gegner, dessen
 * Schritt noch aussteht, steht so lange auf seiner alten Kachel, obwohl der
 * Spielzustand ihn schon versetzt hat.
 *
 * Nicht in der Reihe stehen zwei Dinge, die kein Objekt bewegen: der rote
 * Trefferblitz und die verblassenden Leichen.
 */
import { facingToAngle } from './camera';
import type { EnemyDef, EntityId, GameEvent, GameState, TileCoord } from '../core/types';

export const MOVE_MS = 180;
export const TURN_MS = 140;
export const WEAPON_MS = 200;
export const ENEMY_ATTACK_MS = 220;
export const FLASH_MS = 250;
export const PAIN_MS = 180;
export const DEATH_MS = 400;
export const IDLE_FPS = 4;

const TAU = Math.PI * 2;

/** Winkel auf [0, 2 Pi). */
export function normalizeAngle(angle: number): number {
  return ((angle % TAU) + TAU) % TAU;
}

/** Interpoliert ueber den kuerzeren der beiden Wege, 350 nach 10 Grad laeuft ueber 0. */
export function lerpAngle(from: number, to: number, t: number): number {
  const delta = normalizeAngle(to - from + Math.PI) - Math.PI;
  return from + delta * t;
}

type MoveTween = { fromX: number; fromY: number; toX: number; toY: number; elapsed: number };
type TurnTween = { from: number; to: number; elapsed: number };
type Timer = { elapsed: number; duration: number };
type FrameTween = { phase: 'attack' | 'pain'; elapsed: number; duration: number };
type Corpse = { defId: string; x: number; y: number; elapsed: number };

type ActorKey = EntityId | 'player';

/** Ein Schritt der Warteschlange. Es laeuft immer nur der erste. */
type Step =
  | { kind: 'move'; who: ActorKey; tween: MoveTween }
  | { kind: 'turn'; tween: TurnTween }
  | { kind: 'weapon'; timer: Timer }
  | { kind: 'frame'; who: EntityId; tween: FrameTween };

function center(pos: TileCoord): { x: number; y: number } {
  return { x: pos.x + 0.5, y: pos.y + 0.5 };
}

/** Dauer eines Schritts in Millisekunden. */
function durationOf(step: Step): number {
  switch (step.kind) {
    case 'move':
      return MOVE_MS;
    case 'turn':
      return TURN_MS;
    case 'weapon':
      return step.timer.duration;
    default:
      return step.tween.duration;
  }
}

function elapsedOf(step: Step): number {
  return step.kind === 'weapon' ? step.timer.elapsed : step.tween.elapsed;
}

function addElapsed(step: Step, dtMs: number): void {
  if (step.kind === 'weapon') step.timer.elapsed += dtMs;
  else step.tween.elapsed += dtMs;
}

function pick(frames: string[], progress: number): string | undefined {
  if (frames.length === 0) return undefined;
  const index = Math.min(frames.length - 1, Math.floor(progress * frames.length));
  return frames[index];
}

export class AnimationState {
  /** Warteschlange. Index 0 laeuft, der Rest wartet. */
  private queue: Step[] = [];
  private lastSeen = new Map<EntityId, { defId: string; x: number; y: number }>();
  private corpses: Corpse[] = [];
  private flash: Timer | null = null;
  private angle = 0;
  private idleTime = 0;

  /** Der gerade laufende Schritt, oder null bei leerer Reihe. */
  private current(): Step | null {
    return this.queue[0] ?? null;
  }

  /** Setzt den Renderwinkel ohne Tween, etwa beim ersten Bild oder nach Kartenwechsel. */
  snapTo(state: GameState): void {
    this.angle = facingToAngle(state.player.facing);
    this.queue = [];
  }

  /** Merkt sich Position und Definition aller Gegner, damit `died` eine Leiche ablegen kann. */
  observe(state: GameState): void {
    const mapState = state.maps[state.currentMapId];
    if (mapState === undefined) return;
    for (const entity of mapState.entities) {
      if (entity.kind !== 'enemy') continue;
      const at = center(entity.pos);
      this.lastSeen.set(entity.id, { defId: entity.defId, x: at.x, y: at.y });
    }
  }

  consumeEvents(events: GameEvent[]): void {
    for (const event of events) {
      switch (event.type) {
        case 'moved': {
          const from = center(event.from);
          const to = center(event.to);
          this.queue.push({
            kind: 'move',
            who: event.who,
            tween: { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, elapsed: 0 },
          });
          break;
        }
        case 'turned': {
          if (event.who !== 'player') break;
          // Die Drehung beginnt dort, wo die vorigen Schritte enden.
          this.queue.push({
            kind: 'turn',
            tween: { from: this.pendingAngle(), to: facingToAngle(event.facing), elapsed: 0 },
          });
          break;
        }
        case 'attack': {
          if (event.attacker === 'player') {
            this.queue.push({ kind: 'weapon', timer: { elapsed: 0, duration: WEAPON_MS } });
          } else {
            this.queue.push({
              kind: 'frame',
              who: event.attacker,
              tween: { phase: 'attack', elapsed: 0, duration: ENEMY_ATTACK_MS },
            });
          }
          if (!event.hit) break;
          if (event.target === 'player') {
            // Der Blitz ist ein Bildeffekt und haelt die Reihe nicht auf.
            this.flash = { elapsed: 0, duration: FLASH_MS };
          } else {
            this.queue.push({
              kind: 'frame',
              who: event.target,
              tween: { phase: 'pain', elapsed: 0, duration: PAIN_MS },
            });
          }
          break;
        }
        case 'died': {
          if (event.who === 'player') break;
          // Ein Toter animiert nicht mehr: seine Schritte fallen aus der Reihe.
          this.queue = this.queue.filter(
            (step) => !('who' in step && step.who === event.who)
          );
          const seen = this.lastSeen.get(event.who);
          if (seen !== undefined) {
            this.corpses.push({ defId: seen.defId, x: seen.x, y: seen.y, elapsed: 0 });
            this.lastSeen.delete(event.who);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  /** Blickwinkel, nachdem alle eingereihten Drehungen gelaufen sind. */
  private pendingAngle(): number {
    for (let index = this.queue.length - 1; index >= 0; index--) {
      const step = this.queue[index];
      if (step?.kind === 'turn') return step.tween.to;
    }
    return this.angle;
  }

  advance(dtMs: number): void {
    this.idleTime += dtMs;

    for (const corpse of this.corpses) {
      if (corpse.elapsed < DEATH_MS) corpse.elapsed += dtMs;
    }
    if (this.flash !== null) {
      this.flash.elapsed += dtMs;
      if (this.flash.elapsed >= this.flash.duration) this.flash = null;
    }

    // Nur der erste Schritt laeuft. Ist er fertig, ruecken die uebrigen nach;
    // eine Restzeit wird an den naechsten weitergereicht, sonst haengt die
    // Reihe an der Bildrate.
    let left = dtMs;
    while (left > 0) {
      const step = this.current();
      if (step === null) break;

      const duration = durationOf(step);
      const elapsed = elapsedOf(step);
      const missing = duration - elapsed;
      if (left < missing) {
        addElapsed(step, left);
        break;
      }

      left -= missing;
      if (step.kind === 'turn') this.angle = step.tween.to;
      this.queue.shift();
    }
  }

/** Blockierend ist alles, was noch in der Reihe steht. Der Trefferblitz nicht. */
  isAnimating(): boolean {
    return this.queue.length > 0;
  }

  /** Zahl der wartenden Schritte, fuer Tests und Fehlersuche. */
  queued(): number {
    return this.queue.length;
  }

  /** Interpolierte Weltposition eines Akteurs, sonst die Kachelmitte aus dem Zustand. */
  positionOf(key: ActorKey, pos: TileCoord): { x: number; y: number } {
    const index = this.queue.findIndex((step) => step.kind === 'move' && step.who === key);
    const step = index < 0 ? undefined : this.queue[index];
    if (step === undefined || step.kind !== 'move') return center(pos);

    // Ein Schritt, der noch wartet, haelt den Akteur auf seiner alten Kachel.
    // Sonst spraenge er erst ans Ziel und liefe dann von vorn los.
    const t = index === 0 ? Math.min(1, step.tween.elapsed / MOVE_MS) : 0;
    return {
      x: step.tween.fromX + (step.tween.toX - step.tween.fromX) * t,
      y: step.tween.fromY + (step.tween.toY - step.tween.fromY) * t,
    };
  }

  /** Interpolierter Blickwinkel des Spielers. */
  angleOf(): number {
    const step = this.current();
    if (step === null || step.kind !== 'turn') return this.angle;
    return lerpAngle(
      step.tween.from,
      step.tween.to,
      Math.min(1, step.tween.elapsed / TURN_MS)
    );
  }

  /** Framename eines Gegners, gesteuert ueber Renderzeit statt turnCount. */
  frameOf(id: EntityId, def: EnemyDef): string | undefined {
    // Nur der laufende Schritt zeigt Angriff oder Schmerz, wartende nicht.
    const step = this.current();
    if (step !== null && step.kind === 'frame' && step.who === id) {
      const progress = Math.min(0.999, step.tween.elapsed / step.tween.duration);
      const list = step.tween.phase === 'attack' ? def.frames.attack : def.frames.pain;
      const frame = pick(list, progress);
      if (frame !== undefined) return frame;
    }
    const idle = def.frames.idle;
    if (idle.length === 0) return undefined;
    const at = Math.floor((this.idleTime / 1000) * IDLE_FPS) % idle.length;
    return idle[at];
  }

  /** Leichen mit ihrem aktuellen Death-Frame. Der letzte Frame bleibt liegen. */
  corpseFrames(defs: Record<string, EnemyDef>): { defId: string; x: number; y: number; frame: string }[] {
    const out: { defId: string; x: number; y: number; frame: string }[] = [];
    for (const corpse of this.corpses) {
      const def = defs[corpse.defId];
      if (def === undefined) continue;
      const frame = pick(def.frames.death, Math.min(0.999, corpse.elapsed / DEATH_MS));
      if (frame === undefined) continue;
      out.push({ defId: corpse.defId, x: corpse.x, y: corpse.y, frame });
    }
    return out;
  }

  /** Rueckstoss der Waffenansicht, 0 bis 1 und wieder zurueck. */
  weaponRecoil(): number {
    const step = this.current();
    if (step === null || step.kind !== 'weapon') return 0;
    return Math.sin(Math.min(1, step.timer.elapsed / step.timer.duration) * Math.PI);
  }

  /** Deckkraft des roten Trefferblitzes, faellt linear ab. */
  flashAlpha(): number {
    if (this.flash === null) return 0;
    return Math.max(0, 1 - this.flash.elapsed / this.flash.duration);
  }

  /** Leichen einer verlassenen Karte verwerfen. */
  clearCorpses(): void {
    this.corpses = [];
    this.lastSeen.clear();
  }
}
