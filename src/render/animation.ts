/**
 * Animationszustand des Renderers. Vollstaendig getrennt vom Spielzustand,
 * `consume` startet Tweens, `advance` treibt sie voran. Dauern nach
 * docs/tasks/PHASE_3.md.
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

function center(pos: TileCoord): { x: number; y: number } {
  return { x: pos.x + 0.5, y: pos.y + 0.5 };
}

function pick(frames: string[], progress: number): string | undefined {
  if (frames.length === 0) return undefined;
  const index = Math.min(frames.length - 1, Math.floor(progress * frames.length));
  return frames[index];
}

export class AnimationState {
  private moves = new Map<ActorKey, MoveTween>();
  private frames = new Map<EntityId, FrameTween>();
  private lastSeen = new Map<EntityId, { defId: string; x: number; y: number }>();
  private corpses: Corpse[] = [];
  private turn: TurnTween | null = null;
  private weapon: Timer | null = null;
  private flash: Timer | null = null;
  private angle = 0;
  private idleTime = 0;

  /** Setzt den Renderwinkel ohne Tween, etwa beim ersten Bild oder nach Kartenwechsel. */
  snapTo(state: GameState): void {
    this.angle = facingToAngle(state.player.facing);
    this.moves.clear();
    this.turn = null;
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
          this.moves.set(event.who, {
            fromX: from.x,
            fromY: from.y,
            toX: to.x,
            toY: to.y,
            elapsed: 0,
          });
          break;
        }
        case 'turned': {
          if (event.who !== 'player') break;
          this.turn = { from: this.angle, to: facingToAngle(event.facing), elapsed: 0 };
          break;
        }
        case 'attack': {
          if (event.attacker === 'player') {
            this.weapon = { elapsed: 0, duration: WEAPON_MS };
          } else {
            this.frames.set(event.attacker, {
              phase: 'attack',
              elapsed: 0,
              duration: ENEMY_ATTACK_MS,
            });
          }
          if (!event.hit) break;
          if (event.target === 'player') {
            this.flash = { elapsed: 0, duration: FLASH_MS };
          } else {
            this.frames.set(event.target, { phase: 'pain', elapsed: 0, duration: PAIN_MS });
          }
          break;
        }
        case 'died': {
          if (event.who === 'player') break;
          this.frames.delete(event.who);
          const seen = this.lastSeen.get(event.who);
          if (seen !== undefined) {
            this.corpses.push({ defId: seen.defId, x: seen.x, y: seen.y, elapsed: 0 });
            this.lastSeen.delete(event.who);
          }
          this.moves.delete(event.who);
          break;
        }
        default:
          break;
      }
    }
  }

  advance(dtMs: number): void {
    this.idleTime += dtMs;

    for (const [key, tween] of this.moves) {
      tween.elapsed += dtMs;
      if (tween.elapsed >= MOVE_MS) this.moves.delete(key);
    }
    for (const [key, tween] of this.frames) {
      tween.elapsed += dtMs;
      if (tween.elapsed >= tween.duration) this.frames.delete(key);
    }
    for (const corpse of this.corpses) {
      if (corpse.elapsed < DEATH_MS) corpse.elapsed += dtMs;
    }
    if (this.turn !== null) {
      this.turn.elapsed += dtMs;
      if (this.turn.elapsed >= TURN_MS) {
        this.angle = this.turn.to;
        this.turn = null;
      }
    }
    if (this.weapon !== null) {
      this.weapon.elapsed += dtMs;
      if (this.weapon.elapsed >= this.weapon.duration) this.weapon = null;
    }
    if (this.flash !== null) {
      this.flash.elapsed += dtMs;
      if (this.flash.elapsed >= this.flash.duration) this.flash = null;
    }
  }

  /** Blockierend sind Bewegung, Drehung und Angriff. Der Trefferblitz nicht. */
  isAnimating(): boolean {
    if (this.moves.size > 0) return true;
    if (this.turn !== null) return true;
    if (this.weapon !== null) return true;
    for (const tween of this.frames.values()) {
      if (tween.phase === 'attack') return true;
    }
    return false;
  }

  /** Interpolierte Weltposition eines Akteurs, sonst die Kachelmitte aus dem Zustand. */
  positionOf(key: ActorKey, pos: TileCoord): { x: number; y: number } {
    const tween = this.moves.get(key);
    if (tween === undefined) return center(pos);
    const t = Math.min(1, tween.elapsed / MOVE_MS);
    return {
      x: tween.fromX + (tween.toX - tween.fromX) * t,
      y: tween.fromY + (tween.toY - tween.fromY) * t,
    };
  }

  /** Interpolierter Blickwinkel des Spielers. */
  angleOf(): number {
    if (this.turn === null) return this.angle;
    return lerpAngle(this.turn.from, this.turn.to, Math.min(1, this.turn.elapsed / TURN_MS));
  }

  /** Framename eines Gegners, gesteuert ueber Renderzeit statt turnCount. */
  frameOf(id: EntityId, def: EnemyDef): string | undefined {
    const tween = this.frames.get(id);
    if (tween !== undefined) {
      const progress = Math.min(0.999, tween.elapsed / tween.duration);
      const list = tween.phase === 'attack' ? def.frames.attack : def.frames.pain;
      const frame = pick(list, progress);
      if (frame !== undefined) return frame;
    }
    const idle = def.frames.idle;
    if (idle.length === 0) return undefined;
    const step = Math.floor((this.idleTime / 1000) * IDLE_FPS) % idle.length;
    return idle[step];
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
    if (this.weapon === null) return 0;
    return Math.sin(Math.min(1, this.weapon.elapsed / this.weapon.duration) * Math.PI);
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
