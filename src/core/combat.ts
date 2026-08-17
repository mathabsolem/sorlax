/**
 * Kampfformeln nach SPEC Abschnitt 4. Die Formeln sind verbindlich,
 * hier steht keine eigene Variante.
 */
import { chebyshev } from './grid';
import { isAlive } from './entities';
import type { Rng } from './rng';
import type {
  EntityId,
  GameEvent,
  MapRuntimeState,
  PlayerState,
  Stats,
  TileCoord,
  WeaponDef,
} from './types';

/** Referenz auf einen Kampfteilnehmer, so wie GameEvent sie fuehrt. */
export type ActorRef = EntityId | 'player';

/** Angreifer oder Verteidiger mit den Stats, die veraendert werden duerfen. */
export type CombatSide = { ref: ActorRef; stats: Stats };

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

/** SPEC 4.1. Distanz ist die Chebyshev-Distanz in Kacheln. */
export function hitChance(
  attacker: Stats,
  defender: Stats,
  weapon: WeaponDef,
  distance: number
): number {
  const rangePenalty = Math.max(0, distance - weapon.optimalRange) * 0.05;
  return clamp(0.05, 0.95, 0.75 + (attacker.accuracy - defender.evasion) * 0.02 - rangePenalty);
}

/**
 * SPEC 4.2, erster Teil. Die Reihenfolge der beiden Ziehungen ist Teil des
 * Determinismus und darf nicht getauscht werden.
 */
export function rollDamage(rng: Rng, weapon: WeaponDef): { raw: number; crit: boolean } {
  const roll = rng.randInt(weapon.dmgMin, weapon.dmgMax);
  const crit = rng.next() < weapon.critChance;
  return { raw: crit ? roll * 2 : roll, crit };
}

/** SPEC 4.2, zweiter Teil. Mindestens 1 Schaden. */
export function applyArmor(raw: number, armor: number): number {
  return Math.max(1, raw - Math.floor(armor * 0.5));
}

/** SPEC 4.3. Linearer Abfall bis zum Radius. */
export function splashDamage(
  baseDamage: number,
  radius: number,
  distance: number,
  armor: number
): number {
  return Math.max(1, Math.floor(baseDamage * (1 - distance / radius)) - Math.floor(armor * 0.5));
}

/**
 * Wuerfelt Treffer und Schaden, zieht Leben ab und liefert das `attack`-Event,
 * bei toedlichem Ausgang zusaetzlich ein `died`-Event.
 */
export function resolveAttack(
  rng: Rng,
  attacker: CombatSide,
  defender: CombatSide,
  weapon: WeaponDef,
  distance: number
): GameEvent[] {
  const chance = hitChance(attacker.stats, defender.stats, weapon, distance);
  if (rng.next() >= chance) {
    return [
      { type: 'attack', attacker: attacker.ref, target: defender.ref, hit: false, damage: 0, crit: false },
    ];
  }

  const { raw, crit } = rollDamage(rng, weapon);
  const damage = applyArmor(raw, defender.stats.armor);
  defender.stats.health -= damage;

  const events: GameEvent[] = [
    { type: 'attack', attacker: attacker.ref, target: defender.ref, hit: true, damage, crit },
  ];
  if (defender.stats.health <= 0) {
    defender.stats.health = 0;
    events.push({ type: 'died', who: defender.ref });
  }
  return events;
}

/**
 * SPEC 4.3 auf die Karte angewendet: alle Akteure im Radius nehmen Schaden.
 * Eigene Explosionen treffen den Spieler nur zu 50 Prozent.
 */
export function applySplash(
  player: PlayerState,
  mapState: MapRuntimeState,
  center: TileCoord,
  splash: { radius: number; baseDamage: number },
  attacker: ActorRef
): GameEvent[] {
  const events: GameEvent[] = [];

  for (const entity of [...mapState.entities]) {
    if (entity.kind !== 'enemy' || !isAlive(entity)) continue;
    const stats = entity.stats;
    if (stats === undefined) continue;
    if (entity.id === attacker) continue;
    const distance = chebyshev(center, entity.pos);
    if (distance > splash.radius) continue;
    const damage = splashDamage(splash.baseDamage, splash.radius, distance, stats.armor);
    stats.health -= damage;
    entity.active = true;
    events.push({ type: 'attack', attacker, target: entity.id, hit: true, damage, crit: false });
    if (stats.health <= 0) {
      stats.health = 0;
      events.push({ type: 'died', who: entity.id });
    }
  }

  const playerDistance = chebyshev(center, player.pos);
  if (playerDistance <= splash.radius) {
    const full = splashDamage(splash.baseDamage, splash.radius, playerDistance, player.stats.armor);
    const damage = attacker === 'player' ? Math.max(1, Math.floor(full * 0.5)) : full;
    player.stats.health -= damage;
    events.push({ type: 'attack', attacker, target: 'player', hit: true, damage, crit: false });
    if (player.stats.health <= 0) player.stats.health = 0;
  }

  return events;
}
