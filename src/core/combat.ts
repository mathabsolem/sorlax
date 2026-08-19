/**
 * Kampfformeln nach SPEC v1.2 Abschnitt 4. Die Reihenfolge in Abschnitt 4.2 ist
 * verbindlich: Wurf, Typbonus, Kritischer Treffer, Resistenz, Ruestung.
 * Erst Resistenz, dann Ruestung. Nicht umsortieren.
 */
import type { Rng } from './rng';
import type {
  DamageType,
  DerivedStats,
  EntityId,
  GameEvent,
  TileCoord,
  WeaponDef,
} from './types';

export type ActorRef = EntityId | 'player';

/** Traeger des aktuellen Lebenswerts. Schaden wird hier hineingeschrieben. */
export type Vitals = { health: number };

export type CombatSide = {
  ref: ActorRef;
  stats: DerivedStats;
  vitals: Vitals;
};

/** Ziel einer Explosion, siehe applySplash. */
export type SplashTarget = CombatSide & { pos: TileCoord };

function clamp(min: number, max: number, value: number): number {
  return value < min ? min : value > max ? max : value;
}

/** SPEC 4.1. Distanz ist die Chebyshev-Distanz in Kacheln. */
export function hitChance(
  attacker: DerivedStats,
  defender: DerivedStats,
  weapon: WeaponDef,
  distance: number
): number {
  const rangePenalty = Math.max(0, distance - weapon.optimalRange) * 0.05;
  return clamp(0.05, 0.95, 0.75 + (attacker.accuracy - defender.evasion) * 0.02 - rangePenalty);
}

/**
 * SPEC 4.2, zweiter Schritt. Nahkampf zaehlt nur bei physischem Schaden und
 * optimalRange kleiner gleich 1, alles Nichtphysische nimmt den Elementarbonus.
 */
export function typeBonus(attacker: DerivedStats, weapon: WeaponDef): number {
  if (weapon.damageType === 'physical') {
    return weapon.optimalRange <= 1 ? attacker.meleeBonus : 0;
  }
  return attacker.elemBonus;
}

/**
 * SPEC 4.2, Schritte 1 bis 4. Die Reihenfolge der beiden Ziehungen ist Teil des
 * Determinismus: erst der Schadenswurf, dann der Kritwurf.
 */
export function rollDamage(
  rng: Rng,
  weapon: WeaponDef,
  attacker: DerivedStats
): { raw: number; crit: boolean } {
  const roll = rng.randInt(weapon.dmgMin, weapon.dmgMax);
  const withBonus = Math.round(roll * (1 + typeBonus(attacker, weapon)));
  const crit = rng.next() < weapon.critChance + attacker.critBonus;
  return { raw: crit ? withBonus * 2 : withBonus, crit };
}

/** SPEC 4.2, Resistenzschritt. Mindestens 1 Schaden. */
export function applyResistance(raw: number, resist: number): number {
  return Math.max(1, Math.floor(raw * (1 - resist / 100)));
}

/** SPEC 4.2, Ruestungsschritt. Mindestens 1 Schaden. */
export function applyArmor(afterResist: number, armor: number): number {
  return Math.max(1, afterResist - Math.floor(armor * 0.5));
}

/** SPEC 4.3. Linearer Abfall, danach Resistenz, danach Ruestung. */
export function splashDamage(
  baseDamage: number,
  radius: number,
  distance: number,
  resist: number,
  armor: number
): number {
  const scaled = Math.floor(baseDamage * (1 - distance / radius) * (1 - resist / 100));
  return Math.max(1, scaled - Math.floor(armor * 0.5));
}

function damageEvent(
  attacker: ActorRef,
  target: ActorRef,
  hit: boolean,
  damage: number,
  crit: boolean,
  damageType: DamageType
): GameEvent {
  return { type: 'attack', attacker, target, hit, damage, crit, damageType };
}

/** Zieht Schaden ab und meldet den Tod, wenn der Lebenswert auf 0 faellt. */
function dealDamage(defender: CombatSide, damage: number, events: GameEvent[]): void {
  defender.vitals.health -= damage;
  if (defender.vitals.health <= 0) {
    defender.vitals.health = 0;
    events.push({ type: 'died', who: defender.ref });
  }
}

/**
 * Wuerfelt Treffer und Schaden, zieht Leben ab und liefert das `attack`-Ereignis
 * mit der Schadensart, bei toedlichem Ausgang zusaetzlich ein `died`-Ereignis.
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
    return [damageEvent(attacker.ref, defender.ref, false, 0, false, weapon.damageType)];
  }

  const { raw, crit } = rollDamage(rng, weapon, attacker.stats);
  const resist = defender.stats.resistances[weapon.damageType];
  const damage = applyArmor(applyResistance(raw, resist), defender.stats.armor);

  const events: GameEvent[] = [
    damageEvent(attacker.ref, defender.ref, true, damage, crit, weapon.damageType),
  ];
  dealDamage(defender, damage, events);
  return events;
}

/**
 * SPEC 4.3 auf eine Zielliste angewendet. Der Aufrufer stellt die Ziele samt
 * abgeleiteter Werte zusammen, damit combat.ts weder Zustand noch Inhalte kennt.
 * Eigene Explosionen treffen den Spieler nur zur Haelfte.
 */
export function applySplash(
  targets: readonly SplashTarget[],
  center: TileCoord,
  splash: { radius: number; baseDamage: number },
  damageType: DamageType,
  attacker: ActorRef
): GameEvent[] {
  const events: GameEvent[] = [];

  for (const target of targets) {
    // Der Ausloeser trifft sich nicht selbst. Einzige Ausnahme ist der Spieler,
    // der aus eigenen Explosionen halben Schaden nimmt (SPEC 4.3).
    if (target.ref === attacker && attacker !== 'player') continue;
    const distance = Math.max(
      Math.abs(center.x - target.pos.x),
      Math.abs(center.y - target.pos.y)
    );
    if (distance > splash.radius) continue;

    const full = splashDamage(
      splash.baseDamage,
      splash.radius,
      distance,
      target.stats.resistances[damageType],
      target.stats.armor
    );
    const damage =
      attacker === 'player' && target.ref === 'player' ? Math.max(1, Math.floor(full * 0.5)) : full;

    events.push(damageEvent(attacker, target.ref, true, damage, false, damageType));
    dealDamage(target, damage, events);
  }

  return events;
}
