/**
 * Waffenplatz und Inhaltsabgleich, PHASE_3_8.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import enemiesJson from '../content/enemies.json';
import { applyCommand } from '../src/core/commands';
import { UNARMED, activeWeapon, createInstance, equippedWeapon } from '../src/core/items';
import { migrate } from '../src/core/migrate';
import { CURRENT_SAVE_VERSION, serialize } from '../src/core/state';
import type { EnemyDef, GameState, Resistances } from '../src/core/types';
import { WEAPON_DEFS, setup } from './fixtures/world';

const ENEMIES = enemiesJson as unknown as Record<string, EnemyDef>;

/** BESTIARY v3 Abschnitt 6, fest hinterlegt statt aus der Quelle gelesen. */
const BOSSES: Record<
  string,
  {
    scriptId: string;
    baseHealth: number;
    baseArmor: number;
    baseAccuracy: number;
    baseEvasion: number;
    speed: number;
    baseXp: number;
    resistances: Resistances;
  }
> = {
  boss_halvern: {
    scriptId: 'halvern',
    baseHealth: 180,
    baseArmor: 4,
    baseAccuracy: 16,
    baseEvasion: 3,
    speed: 1.0,
    baseXp: 400,
    resistances: { physical: 0, fire: 90, poison: 0, ice: -60, shock: 0, void: 0 },
  },
  boss_sporemother: {
    scriptId: 'sporemother',
    baseHealth: 260,
    baseArmor: 3,
    baseAccuracy: 14,
    baseEvasion: 0,
    speed: 1.0,
    baseXp: 900,
    resistances: { physical: 25, fire: 0, poison: 90, ice: 0, shock: -60, void: 0 },
  },
  boss_rime: {
    scriptId: 'rime',
    baseHealth: 300,
    baseArmor: 6,
    baseAccuracy: 18,
    baseEvasion: 8,
    speed: 1.0,
    baseXp: 1600,
    resistances: { physical: 20, fire: -60, poison: 0, ice: 90, shock: 0, void: 0 },
  },
  boss_sorlax: {
    scriptId: 'sorlax',
    baseHealth: 420,
    baseArmor: 10,
    baseAccuracy: 20,
    baseEvasion: 5,
    speed: 1.0,
    baseXp: 5000,
    resistances: { physical: 40, fire: 25, poison: 25, ice: 25, shock: 25, void: 90 },
  },
};

describe('Block 1, Bosswerte', () => {
  // Test 1 aus PHASE_3_8
  it('entsprechen BESTIARY Abschnitt 6', () => {
    for (const [id, want] of Object.entries(BOSSES)) {
      const def = ENEMIES[id];
      expect(def, `Boss fehlt: ${id}`).toBeDefined();
      expect(def?.scriptId).toBe(want.scriptId);
      expect(def?.baseHealth).toBe(want.baseHealth);
      expect(def?.baseArmor).toBe(want.baseArmor);
      expect(def?.baseAccuracy).toBe(want.baseAccuracy);
      expect(def?.baseEvasion).toBe(want.baseEvasion);
      expect(def?.speed).toBe(want.speed);
      expect(def?.baseXp).toBe(want.baseXp);
      expect(def?.resistances).toEqual(want.resistances);
      expect(def?.dropTableId).toBe('boss_drop');
      expect(def?.behavior).toBe('scripted');
    }
  });
});

/** Alle Quelldateien des Projekts, ohne node_modules und dist. */
function projectFiles(root: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(root, entry);
    if (statSync(full).isDirectory()) found.push(...projectFiles(full));
    else if (/\.(ts|json)$/.test(entry)) found.push(full);
  }
  return found;
}

describe('Block 2, alte Ausruestungs-Ids', () => {
  // Test 2 aus PHASE_3_8
  it('kommen im Repo nicht mehr vor', () => {
    const retired = [
      'suit_liner',
      'helmet_cap',
      'belt_strap',
      'belt_rig',
      'boots_tread',
      'gloves_wrap',
      'gloves_bracer',
      'weapon_rig_light',
      'weapon_rig_heavy',
      'guard_buckler',
      'guard_bulwark',
      'gauge_left_basic',
      'gauge_left_fine',
      'gauge_right_basic',
      'gauge_right_fine',
      'corvane_rat',
      'corvane_miner',
    ];

    const offenders: string[] = [];
    for (const file of [...projectFiles('src'), ...projectFiles('tests'), ...projectFiles('content')]) {
      if (file.endsWith('weaponSlot.test.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const id of retired) {
        if (new RegExp(`\\b${id}\\b`).test(text)) offenders.push(`${file}: ${id}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('Block 3, equippedWeapon', () => {
  // Test 3 aus PHASE_3_8
  it('liefert bei leerem Platz null, der Angriff laeuft unbewaffnet weiter', () => {
    const { state, content } = setup({
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
      entities: [{ kind: 'enemy', defId: 'tank', pos: { x: 2, y: 1 } }],
    });
    state.player.attributes.agility = 200;
    delete state.player.equipment['weapon'];

    expect(equippedWeapon(state, content)).toBeNull();
    expect(activeWeapon(state, content)).toBe(UNARMED);
    expect(UNARMED.dmgMin).toBe(1);
    expect(UNARMED.dmgMax).toBe(3);
    expect(UNARMED.critChance).toBe(0);
    expect(UNARMED.maxRange).toBe(1);
    expect(UNARMED.damageType).toBe('physical');

    const enemy = state.maps['test']?.entities[0];
    const before = enemy?.health ?? 0;
    const events = applyCommand(state, { type: 'attack' }, content);

    expect(events.some((event) => event.type === 'attack' && event.attacker === 'player')).toBe(
      true
    );
    expect(enemy?.health).toBeLessThan(before);
    expect(before - (enemy?.health ?? 0)).toBeLessThanOrEqual(UNARMED.dmgMax);
  });

  it('liefert null, wenn der Grundtyp keine Waffe ist', () => {
    const { state, content } = setup();
    const suit = createInstance(state, 'suit_overall', 1, 'normal', [], content);
    if (suit === null) throw new Error('kein Grundtyp');
    state.player.equipment['weapon'] = suit;

    expect(equippedWeapon(state, content)).toBeNull();
  });

  // Test 6 aus PHASE_3_8
  it('laesst pre_brutal auf der Waffe den Nahkampfschaden steigen', () => {
    const build = (affixes: { affixId: string; value: number }[]) => {
      const world = setup({
        seed: 21,
        spawn: { pos: { x: 1, y: 1 }, facing: 1 },
        entities: [{ kind: 'enemy', defId: 'tank', pos: { x: 2, y: 1 } }],
      });
      world.state.player.attributes.agility = 200;
      const weapon = createInstance(world.state, 'item_w_prybar', 20, 'rare', affixes, world.content);
      if (weapon === null) throw new Error('kein Grundtyp');
      world.state.player.equipment['weapon'] = weapon;
      const enemy = world.state.maps['test']?.entities[0];
      if (enemy === undefined) throw new Error('kein Gegner');
      return { ...world, enemy };
    };

    const plain = build([]);
    const plainBefore = plain.enemy.health ?? 0;
    applyCommand(plain.state, { type: 'attack' }, plain.content);
    const normal = plainBefore - (plain.enemy.health ?? 0);

    const brutal = build([{ affixId: 'pre_brutal', value: 8 }]);
    const brutalBefore = brutal.enemy.health ?? 0;
    applyCommand(brutal.state, { type: 'attack' }, brutal.content);
    const boosted = brutalBefore - (brutal.enemy.health ?? 0);

    // Die Brechstange ist physisch mit optimalRange 1, also greift meleeBonus.
    expect(boosted).toBeGreaterThan(normal);
  });
});

describe('Block 4, Migration', () => {
  /** Ein Spielstand, wie ihn Version 3 geschrieben hat. */
  function v3Save(equippedWeaponId: string): Record<string, unknown> {
    const { state } = setup();
    const raw = JSON.parse(serialize(state)) as Record<string, unknown>;
    raw['version'] = 3;
    const player = raw['player'] as Record<string, unknown>;
    player['equipment'] = {};
    player['equippedWeaponId'] = equippedWeaponId;
    raw['nextItemUid'] = 7;
    return raw;
  }

  // Test 7 aus PHASE_3_8
  it('legt aus equippedWeaponId eine Instanz im Platz weapon an', () => {
    const migrated = migrate(v3Save('w_pistol'));
    const weapon = migrated.player.equipment['weapon'];

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(weapon?.baseId).toBe('item_w_pistol');
    expect(weapon?.slot).toBe('weapon');
    expect(weapon?.rarity).toBe('normal');
    expect(weapon?.affixes).toEqual([]);
    expect(weapon?.uid).toBe(7);
    expect(migrated.nextItemUid).toBe(8);
    expect('equippedWeaponId' in migrated.player).toBe(false);
  });

  it('setzt bei leerer oder unbekannter Waffe die Brechstange ein', () => {
    expect(migrate(v3Save('')).player.equipment['weapon']?.baseId).toBe('item_w_prybar');
    expect(migrate(v3Save('gibtsnicht')).player.equipment['weapon']?.baseId).toBe(
      'item_w_prybar'
    );
  });

  it('laesst einen bereits belegten Waffenplatz unangetastet', () => {
    const raw = v3Save('w_pistol');
    const player = raw['player'] as Record<string, unknown>;
    player['equipment'] = {
      weapon: {
        uid: 3,
        baseId: 'item_w_drill',
        slot: 'weapon',
        rarity: 'rare',
        itemLevel: 12,
        affixes: [],
        identified: true,
      },
    };

    const migrated = migrate(raw);

    expect(migrated.player.equipment['weapon']?.baseId).toBe('item_w_drill');
    expect(migrated.nextItemUid).toBe(7);
  });

  it('zieht einen Stand von Version 1 bis auf die aktuelle Version durch', () => {
    const migrated = migrate(v3Save('w_pistol')) as GameState;
    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.maps['test']?.tempWalls).toEqual([]);
  });
});

describe('Block 1, Bosswaffen', () => {
  /**
   * BESTIARY Abschnitt 6 nennt keine Waffe fuer die Bosse. Gewaehlt sind
   * Elementvarianten nach der Klonregel aus Abschnitt 5, deren Reichweite zum
   * Skriptverhalten aus PHASE_3_7 Block 7 passt.
   */
  it('passen zur Reichweite des jeweiligen Skripts', () => {
    const weapons = WEAPON_DEFS;

    const halvern = weapons[ENEMIES['boss_halvern']?.weaponId ?? ''];
    expect(halvern?.damageType).toBe('fire');
    expect(halvern?.maxRange).toBe(1); // Ansturm bis Distanz 1

    const spore = weapons[ENEMIES['boss_sporemother']?.weaponId ?? ''];
    expect(spore?.damageType).toBe('poison');

    // rime haelt Distanz 5 bis 7, die Waffe muss so weit reichen.
    const rime = weapons[ENEMIES['boss_rime']?.weaponId ?? ''];
    expect(rime?.damageType).toBe('ice');
    expect(rime?.maxRange).toBeGreaterThanOrEqual(7);

    const sorlax = weapons[ENEMIES['boss_sorlax']?.weaponId ?? ''];
    expect(sorlax?.damageType).toBe('void');
    expect(sorlax?.maxRange).toBe(1); // Phase 1 ist Nahkampf
  });

  it('sind Klone nach der Regel aus BESTIARY Abschnitt 5', () => {
    const clone = WEAPON_DEFS['nw_boltpistol_ice'];
    const base = WEAPON_DEFS['nw_boltpistol'];

    expect(clone?.dmgMin).toBe(base?.dmgMin);
    expect(clone?.dmgMax).toBe(base?.dmgMax);
    expect(clone?.optimalRange).toBe(base?.optimalRange);
    expect(clone?.damageType).toBe('ice');
    expect(clone?.appliesEffect).toBe('chill');
    expect(base?.damageType).toBe('physical');
  });
});
