/**
 * Erzeugt die 28 Gegnervarianten des Sohlenplans und die dazu gehoerenden
 * geklonten Elementwaffen, PHASE_5 Block 4.
 *
 * Kein Laufzeitcode. Das Ergebnis wird nach content/ geschrieben und committet.
 * Aufruf: npm run gen:enemies
 *
 * Die Bosse aus content/enemies.json bleiben unangetastet, sie stammen aus
 * BESTIARY Abschnitt 6 und CONTENT_TABLES Abschnitt 3 und sind von Hand
 * gesetzt. Ihre Elementwaffen werden aber mitgeklont, damit es nur eine Stelle
 * gibt, die Klone erzeugt.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DAMAGE_TYPE_NAMES } from '../src/core/text.ts';
import type { DamageType, EnemyDef, ItemDef, WeaponDef } from '../src/core/types';
import {
  ARCHETYPES,
  ARCHETYPE_DROPS,
  ELEMENT_EFFECTS,
  ELEMENT_MODIFIERS,
  PLANNED_VARIANTS,
  RESIST_PROFILES,
  variantName,
  weaponFor,
} from './canonical.ts';

const ENEMIES_PATH = new URL('../content/enemies.json', import.meta.url);
const WEAPONS_PATH = new URL('../content/weapons.json', import.meta.url);
const ITEMS_PATH = new URL('../content/items.json', import.meta.url);

function readJson<T>(path: URL): Record<string, T> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, T>;
}

function writeJson(path: URL, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

/** Frames eines Archetyps. Varianten teilen sich die Dateien, BESTIARY Abschnitt 4. */
function framesFor(archetype: string): EnemyDef['frames'] {
  return {
    idle: [0, 1, 2, 3].map((index) => `${archetype}_idle_${index}`),
    attack: [0, 1, 2].map((index) => `${archetype}_attack_${index}`),
    pain: [`${archetype}_pain_0`],
    death: [0, 1, 2, 3].map((index) => `${archetype}_death_${index}`),
  };
}

/**
 * Stapel aus der Menge der Tabelle. BESTIARY Abschnitt 9 nennt Stueckzahlen,
 * `EnemyDef.drops.amount` zaehlt Stapel. Umgerechnet wird ueber die
 * Stapelgroesse aus `ItemDef.amount`; mindestens ein Stapel faellt immer.
 */
function stacksFor(units: number, item: ItemDef | undefined): number {
  const size = item?.amount ?? 1;
  return Math.max(1, Math.round(units / (size > 0 ? size : 1)));
}

function dropsFor(
  archetype: string,
  items: Record<string, ItemDef>
): NonNullable<EnemyDef['drops']> {
  return (ARCHETYPE_DROPS[archetype] ?? []).map((drop) => ({
    defId: drop.defId,
    amount: stacksFor(drop.units, items[drop.defId]),
    chance: drop.chance,
  }));
}

/** Eine Variante aus Archetyp mal Elementmodifikator, BESTIARY Abschnitt 3 und 4. */
function buildEnemy(id: string, items: Record<string, ItemDef>): EnemyDef {
  const cut = id.lastIndexOf('_');
  const archetypeId = id.slice(0, cut);
  const element = id.slice(cut + 1) as DamageType;
  const base = ARCHETYPES[archetypeId];
  if (base === undefined) throw new Error(`unbekannter Archetyp: ${archetypeId}`);
  const modifier = ELEMENT_MODIFIERS[element];
  if (modifier === undefined) throw new Error(`unbekanntes Element: ${element}`);

  return {
    id,
    archetype: archetypeId,
    element,
    name: variantName(archetypeId, element),
    // Der Modifikator wirkt nur auf Leben, Genauigkeit und Ausweichen.
    baseHealth: Math.round(base.hp * modifier.health),
    baseArmor: base.armor,
    baseAccuracy: base.acc + modifier.acc,
    baseEvasion: base.eva + modifier.eva,
    resistances: { ...RESIST_PROFILES[element] },
    speed: base.speed,
    behavior: base.behavior,
    aggroRange: base.aggro,
    // melee und charger lesen preferredRange nie, die Tabelle laesst ihn offen.
    preferredRange: base.pref ?? 1,
    weaponId: weaponFor(base, element),
    baseXp: base.xp,
    spriteWidth: base.width,
    frames: framesFor(archetypeId),
    drops: dropsFor(archetypeId, items),
    dropTableId: 'common_drop',
  };
}

/** Klon einer Gegnerwaffe im Element, BESTIARY Abschnitt 5. */
function buildWeaponClone(id: string, weapons: Record<string, WeaponDef>): WeaponDef {
  const cut = id.lastIndexOf('_');
  const baseId = id.slice(0, cut);
  const element = id.slice(cut + 1) as DamageType;
  const base = weapons[baseId];
  if (base === undefined) throw new Error(`Grundform fehlt: ${baseId}`);
  const effect = ELEMENT_EFFECTS[element];

  return {
    ...base,
    id,
    name: `${base.name} (${DAMAGE_TYPE_NAMES[element]})`,
    damageType: element,
    sprite: id,
    sound: id,
    ...(effect === undefined ? {} : { appliesEffect: effect }),
  };
}

function main(): void {
  const enemies = readJson<EnemyDef>(ENEMIES_PATH);
  const weapons = readJson<WeaponDef>(WEAPONS_PATH);
  const items = readJson<ItemDef>(ITEMS_PATH);

  const bosses = Object.values(enemies).filter((def) => def.id.startsWith('boss_'));
  const variants = PLANNED_VARIANTS.map((id) => buildEnemy(id, items));

  const nextEnemies: Record<string, EnemyDef> = {};
  for (const def of [...bosses, ...variants]) nextEnemies[def.id] = def;

  // Klone entstehen fuer die Varianten und fuer die Bosswaffen. Die Grundformen
  // bleiben in ihrer Reihenfolge stehen, die Klone kommen sortiert dahinter.
  const cloneIds = new Set<string>();
  for (const def of [...variants, ...bosses]) {
    if (weapons[def.weaponId] === undefined || def.weaponId.startsWith('nw_')) {
      const cut = def.weaponId.lastIndexOf('_');
      const stem = def.weaponId.slice(0, cut);
      if (weapons[stem] !== undefined && weapons[stem]?.id !== def.weaponId) {
        cloneIds.add(def.weaponId);
      }
    }
  }

  const nextWeapons: Record<string, WeaponDef> = {};
  for (const [id, def] of Object.entries(weapons)) {
    if (!cloneIds.has(id)) nextWeapons[id] = def;
  }
  for (const id of [...cloneIds].sort()) nextWeapons[id] = buildWeaponClone(id, weapons);

  writeJson(ENEMIES_PATH, nextEnemies);
  writeJson(WEAPONS_PATH, nextWeapons);

  const cloneCount = cloneIds.size;
  console.log(`${variants.length} Varianten, ${bosses.length} Bosse, ${cloneCount} Waffenklone`);
}

main();
