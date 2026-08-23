/**
 * Waffen-, Gegner- und Gegenstandsdefinitionen der Testwelt.
 * Aus world.ts herausgeloest, damit beide Dateien klein bleiben.
 */
import type { EnemyDef, ItemDef, Resistances, WeaponDef } from '../../src/core/types';

export function noResistances(): Resistances {
  return { physical: 0, fire: 0, poison: 0, ice: 0, shock: 0, void: 0 };
}

function frames(): EnemyDef['frames'] {
  return { idle: ['idle0'], attack: ['attack0'], pain: ['pain0'], death: ['death0'] };
}

export const WEAPONS: Record<string, WeaponDef> = {
  fists: {
    id: 'fists',
    name: 'Fists',
    dmgMin: 2,
    dmgMax: 4,
    damageType: 'physical',
    critChance: 0,
    optimalRange: 1,
    maxRange: 1,
    ammoType: null,
    ammoPerShot: 0,
    sprite: 'fists',
    sound: 'punch',
  },
  pistol: {
    id: 'pistol',
    name: 'Pistol',
    dmgMin: 3,
    dmgMax: 6,
    damageType: 'physical',
    critChance: 0.1,
    optimalRange: 3,
    maxRange: 6,
    ammoType: 'bullets',
    ammoPerShot: 1,
    sprite: 'pistol',
    sound: 'shot',
  },
  launcher: {
    id: 'launcher',
    name: 'Launcher',
    dmgMin: 5,
    dmgMax: 8,
    damageType: 'fire',
    critChance: 0,
    optimalRange: 4,
    maxRange: 6,
    ammoType: 'rockets',
    ammoPerShot: 1,
    splash: { radius: 2, baseDamage: 20 },
    sprite: 'launcher',
    sound: 'boom',
  },
};

function enemy(overrides: Partial<EnemyDef> & { id: string }): EnemyDef {
  return {
    archetype: 'test',
    element: 'physical',
    name: overrides.id,
    baseHealth: 10,
    baseArmor: 0,
    baseAccuracy: 5,
    baseEvasion: 0,
    resistances: noResistances(),
    speed: 1,
    behavior: 'melee',
    aggroRange: 5,
    preferredRange: 1,
    weaponId: 'fists',
    baseXp: 10,
    spriteWidth: 0.8,
    frames: frames(),
    ...overrides,
  };
}

export const ENEMIES: Record<string, EnemyDef> = {
  grunt: enemy({ id: 'grunt' }),
  runner: enemy({ id: 'runner', behavior: 'charger', speed: 2, aggroRange: 8, baseXp: 15 }),
  crawler: enemy({ id: 'crawler', speed: 0.5, aggroRange: 8, baseXp: 5 }),
  sniper: enemy({
    id: 'sniper',
    behavior: 'ranged',
    aggroRange: 8,
    preferredRange: 3,
    weaponId: 'pistol',
    baseXp: 20,
  }),
  emplacement: enemy({
    id: 'emplacement',
    behavior: 'turret',
    aggroRange: 8,
    weaponId: 'pistol',
    baseXp: 8,
  }),
  sleeper: enemy({ id: 'sleeper', aggroRange: 1, baseXp: 1 }),
  fireproof: enemy({
    id: 'fireproof',
    baseHealth: 999,
    resistances: { ...noResistances(), fire: 60 },
  }),
  tank: enemy({
    id: 'tank',
    baseHealth: 999,
    baseAccuracy: 0,
    aggroRange: 0,
    baseXp: 0,
  }),

  // Bosse und ihre Gefolgschaft, PHASE_3_7. Die Ids der gerufenen Gegner
  // muessen zu SPORE_DEF_ID und SORLAX_MINIONS passen. `guaranteedUniqueId`
  // spiegelt CONTENT_TABLES Abschnitt 2, damit die Bossbeute pruefbar bleibt.
  boss_halvern: enemy({
    id: 'boss_halvern',
    behavior: 'scripted',
    scriptId: 'halvern',
    guaranteedUniqueId: 'uq_halvern_visier',
    baseHealth: 200,
    aggroRange: 10,
    baseXp: 400,
  }),
  boss_sporemother: enemy({
    id: 'boss_sporemother',
    behavior: 'scripted',
    scriptId: 'sporemother',
    guaranteedUniqueId: 'uq_sporenlunge',
    baseHealth: 300,
    aggroRange: 10,
    baseXp: 700,
  }),
  boss_rime: enemy({
    id: 'boss_rime',
    behavior: 'scripted',
    scriptId: 'rime',
    guaranteedUniqueId: 'uq_frostkern',
    baseHealth: 400,
    aggroRange: 12,
    preferredRange: 6,
    weaponId: 'pistol',
    baseXp: 1100,
  }),
  boss_sorlax: enemy({
    id: 'boss_sorlax',
    behavior: 'scripted',
    scriptId: 'sorlax',
    guaranteedUniqueId: 'uq_sorlax_auge',
    baseHealth: 600,
    aggroRange: 14,
    baseXp: 3000,
  }),
  spore_poison: enemy({ id: 'spore_poison', baseHealth: 18, aggroRange: 6, baseXp: 12 }),
  rat_physical: enemy({ id: 'rat_physical', behavior: 'charger', speed: 2, baseXp: 10 }),
  miner_physical: enemy({ id: 'miner_physical', baseHealth: 30, baseXp: 20 }),

  // Fuer die Fehlerpfade aus PHASE_3_7 Block 6.
  ghost_script: enemy({ id: 'ghost_script', behavior: 'scripted', scriptId: 'gibtsnicht' }),
  no_script: enemy({ id: 'no_script', behavior: 'scripted' }),
};

function item(overrides: Partial<ItemDef> & { id: string; type: ItemDef['type'] }): ItemDef {
  return {
    name: overrides.id,
    amount: 1,
    reqLevel: 1,
    reqStrength: 0,
    reqAgility: 0,
    sprite: overrides.id,
    icon: overrides.id,
    ...overrides,
  };
}

/** ItemDef zu einer Testwaffe, damit sie in den Platz `weapon` passt. */
function weaponItem(weaponId: string, name: string): ItemDef {
  return {
    id: `item_${weaponId}`,
    name,
    type: 'weapon',
    slots: ['weapon'],
    weaponId,
    amount: 1,
    reqLevel: 1,
    reqStrength: 0,
    reqAgility: 0,
    sprite: `item_${weaponId}`,
    icon: `item_${weaponId}`,
  };
}

export const ITEMS: Record<string, ItemDef> = {
  item_fists: weaponItem('fists', 'Fists'),
  item_pistol: weaponItem('pistol', 'Pistol'),
  item_launcher: weaponItem('launcher', 'Launcher'),
  medkit: item({ id: 'medkit', name: 'Medkit', type: 'heal', amount: 20 }),
  // `ammoType` ist bei Munition Pflicht, INTERFACES v1.6.
  bullets: item({
    id: 'bullets',
    name: 'Bullets',
    type: 'ammo',
    ammoType: 'bullets',
    amount: 10,
  }),
  redkey: item({ id: 'redkey', name: 'Red Key', type: 'key' }),
  shield: item({ id: 'shield', name: 'Shield', type: 'armor', amount: 4 }),
  relic: item({ id: 'relic', name: 'Relic', type: 'quest' }),
  stim: item({
    id: 'stim',
    name: 'Stim',
    type: 'powerup',
    effect: { id: 'burn', turns: 3, magnitude: 4 },
  }),
};
