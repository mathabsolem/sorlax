/**
 * Migration alter Spielstaende, aus state.test.ts herausgeloest.
 */
import { describe, expect, it } from 'vitest';
import { CURRENT_SAVE_VERSION, deserialize, serialize } from '../src/core/state';
import { migrate } from '../src/core/migrate';

describe('Migration von Version 1', () => {
  /** Ein Spielstand, wie ihn die v1.1-Fassung geschrieben hat. */
  function legacySave(): Record<string, unknown> {
    return {
      version: 1,
      rngState: [1, 2, 3, 4],
      turnCount: 7,
      playTimeMs: 1234,
      currentMapId: 'test',
      flags: { seen: true },
      log: [{ turn: 1, kind: 'system', text: 'hallo' }],
      player: {
        pos: { x: 3, y: 4 },
        facing: 1,
        stats: { health: 37, maxHealth: 50, armor: 0, accuracy: 10, evasion: 5 },
        level: 3,
        xp: 55,
        actionPoints: 0,
        equippedWeaponId: 'fists',
        weapons: ['fists', 'pistol'],
        ammo: { bullets: 12 },
        items: { medkit: 2 },
        keys: ['redkey'],
        effects: [{ id: 'burn', remainingTurns: 2, magnitude: 4 }],
      },
      maps: {
        test: {
          entities: [
            {
              id: 1,
              kind: 'enemy',
              defId: 'grunt',
              pos: { x: 5, y: 5 },
              facing: 0,
              stats: { health: 6, maxHealth: 10, armor: 0, accuracy: 5, evasion: 0 },
              actionPoints: 0,
              active: true,
              animation: { frame: 'idle', startedAtTurn: 0 },
            },
            {
              id: 2,
              kind: 'door',
              defId: 'door',
              pos: { x: 2, y: 1 },
              facing: 0,
              state: 'open',
              actionPoints: 0,
              active: false,
              animation: { frame: 'idle', startedAtTurn: 0 },
            },
          ],
          nextEntityId: 3,
          openedDoors: ['2,1'],
          takenItems: [],
          firedTriggers: ['once'],
          visited: true,
          explored: ['3,4'],
        },
      },
    };
  }

  // Test 13 aus PHASE_3_5
  it('rechnet die alten Kampfwerte in Attribute um', () => {
    const migrated = migrate(legacySave());

    expect(migrated.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.player.attributes).toEqual({
      vitality: 10, // (50 - 20) / 3
      agility: 10, // (10 - 4) / 0.6
      strength: 10,
      focus: 10,
    });
    expect(migrated.player.health).toBe(37);
  });

  it('uebernimmt Fortschritt, Bestand und Kartenzustand', () => {
    const migrated = migrate(legacySave());

    expect(migrated.turnCount).toBe(7);
    expect(migrated.player.level).toBe(3);
    expect(migrated.player.xp).toBe(55);
    expect(migrated.player.weapons).toEqual(['fists', 'pistol']);
    expect(migrated.player.ammo).toEqual({ bullets: 12 });
    expect(migrated.player.keys).toEqual(['redkey']);
    // Aus `items` wird `consumables`.
    expect(migrated.player.consumables).toEqual({ medkit: 2 });
    expect(migrated.maps['test']?.openedDoors).toEqual(['2,1']);
    expect(migrated.maps['test']?.firedTriggers).toEqual(['once']);
  });

  it('fuellt die neuen Felder mit Startwerten', () => {
    const migrated = migrate(legacySave());

    expect(migrated.difficulty).toBe('normal');
    expect(migrated.unlockedDifficulties).toEqual(['normal']);
    // Die Migration legt die Startwaffe als Instanz an und verbraucht uid 1.
    expect(migrated.nextItemUid).toBe(2);
    expect(migrated.player.equipment['weapon']?.baseId).toBe('item_w_prybar');
    // Der Waffenplatz ist seit Version 4 belegt, alle anderen bleiben leer.
    expect(Object.keys(migrated.player.equipment)).toEqual(['weapon']);
    expect(migrated.player.inventory).toEqual([]);
    expect(migrated.player.skills).toEqual({});
    expect(migrated.player.cooldowns).toEqual({});
    expect(migrated.player.unspentAttributePoints).toBe(0);
    expect(migrated.player.unspentSkillPoints).toBe(0);
    expect(migrated.maps['test']?.groundItems).toEqual([]);
    expect(migrated.maps['test']?.rolled).toBe(false);
  });

  it('gibt alten Effekten ihre Quelle zurueck', () => {
    const migrated = migrate(legacySave());
    expect(migrated.player.effects).toEqual([
      { id: 'burn', remainingTurns: 2, magnitude: 4, sourceType: 'fire' },
    ]);
  });

  it('zieht Entitaeten auf health und effects um', () => {
    const migrated = migrate(legacySave());
    const enemy = migrated.maps['test']?.entities[0];
    const door = migrated.maps['test']?.entities[1];

    expect(enemy?.health).toBe(6);
    expect(enemy?.effects).toEqual([]);
    expect(enemy?.monsterLevel).toBe(1);
    expect(enemy?.rank).toBe('common');
    expect(door?.health).toBeUndefined();
    expect(door?.state).toBe('open');
  });

  it('laesst sich nach der Migration serialisieren und wieder laden', () => {
    const migrated = migrate(legacySave());
    expect(deserialize(serialize(migrated))).toEqual(migrated);
  });
});
