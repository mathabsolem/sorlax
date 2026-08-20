import { describe, expect, it } from 'vitest';
import {
  CURRENT_SAVE_VERSION,
  MAX_LOG_ENTRIES,
  createMapRuntime,
  createNewGame,
  deserialize,
  loadRng,
  pushLog,
  saveRng,
  serialize,
} from '../src/core/state';
import { migrate } from '../src/core/migrate';
import { Rng } from '../src/core/rng';
import { MAX_INVENTORY, addToInventory, createInstance } from '../src/core/items';
import { equipAction } from '../src/core/equipActions';
import { makeContent, makeMap, setup } from './fixtures/world';

describe('createNewGame', () => {
  it('setzt die Startwerte aus SPEC 5.1', () => {
    const { state } = setup();
    expect(state.version).toBe(CURRENT_SAVE_VERSION);
    expect(state.turnCount).toBe(0);
    expect(state.player.health).toBe(50);
    expect(state.player.attributes).toEqual({
      strength: 10,
      agility: 10,
      vitality: 10,
      focus: 10,
    });
    expect(state.player.level).toBe(1);
    expect(state.player.xp).toBe(0);
    expect(state.player.pos).toEqual({ x: 1, y: 1 });
    expect(state.currentMapId).toBe('test');
  });

  it('ruestet die erste Waffe der Inhalte aus', () => {
    const { state } = setup();
    expect(state.player.equippedWeaponId).toBe('fists');
    expect(state.player.weapons).toEqual(['fists']);
  });

  it('wirft bei unbekannter Startkarte', () => {
    const content = makeContent([makeMap()]);
    expect(() => createNewGame(1, content, 'nope')).toThrow();
  });
});

describe('createMapRuntime', () => {
  it('instanziiert Entitaeten mit fortlaufenden Ids', () => {
    const map = makeMap({
      entities: [
        { kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } },
        { kind: 'door', defId: 'door', pos: { x: 4, y: 1 }, locked: 'redkey' },
        { kind: 'item', defId: 'medkit', pos: { x: 5, y: 1 } },
      ],
    });
    const runtime = createMapRuntime(map, makeContent([map]), 1, 'normal');
    expect(runtime.entities.map((entity) => entity.id)).toEqual([1, 2, 3]);
    expect(runtime.nextEntityId).toBe(4);
    expect(runtime.entities[0]?.health).toBe(10);
    expect(runtime.entities[1]?.state).toBe('locked');
    expect(runtime.entities[2]?.health).toBeUndefined();
  });

  it('ueberspringt Gegner ohne Definition', () => {
    const map = makeMap({ entities: [{ kind: 'enemy', defId: 'ghost', pos: { x: 3, y: 1 } }] });
    expect(createMapRuntime(map, makeContent([map]), 1, 'normal').entities).toHaveLength(0);
  });
});

describe('pushLog', () => {
  it('kuerzt vorne bei mehr als 100 Eintraegen', () => {
    const { state } = setup();
    for (let i = 0; i < MAX_LOG_ENTRIES + 5; i++) pushLog(state, 'system', `entry ${i}`);
    expect(state.log).toHaveLength(MAX_LOG_ENTRIES);
    expect(state.log[0]?.text).toBe('entry 5');
    expect(state.log[MAX_LOG_ENTRIES - 1]?.text).toBe(`entry ${MAX_LOG_ENTRIES + 4}`);
  });
});

describe('loadRng und saveRng', () => {
  it('setzen den Zustand im Savegame fort', () => {
    const { state } = setup();
    const rng = loadRng(state);
    const first = rng.next();
    saveRng(state, rng);

    const continued = loadRng(state).next();
    const restarted = loadRng({ ...state, rngState: new Rng(1234).getState() }).next();
    expect(first).toBe(restarted);
    expect(continued).not.toBe(first);
  });
});

describe('serialize, deserialize und migrate', () => {
  it('ist verlustfrei', () => {
    const { state } = setup({ entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }] });
    expect(deserialize(serialize(state))).toEqual(state);
  });

  it('migrate reicht die aktuelle Version durch', () => {
    const { state } = setup();
    expect(migrate(JSON.parse(serialize(state)))).toEqual(state);
  });

  it('migrate wirft bei fremden Daten', () => {
    expect(() => migrate(null)).toThrow();
    expect(() => migrate({})).toThrow();
    expect(() => migrate({ version: CURRENT_SAVE_VERSION + 1 })).toThrow();
  });
});

describe('Rundreise mit Ausruestung', () => {
  // Test 16 aus PHASE_3_6
  it('ueberlebt vollen Inventar- und Ausruestungsbestand unveraendert', () => {
    const { state, content } = setup({ loot: true });
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const worn = createInstance(
      state,
      'suit_liner',
      12,
      'rare',
      [
        { affixId: 'pre_sturdy', value: 11 },
        { affixId: 'suf_of_embers', value: 17 },
      ],
      content
    );
    if (worn === null) throw new Error('kein Grundtyp');
    addToInventory(state, worn);
    expect(equipAction(state, content, worn.uid).ok).toBe(true);

    for (let index = 0; index < MAX_INVENTORY; index++) {
      const item = createInstance(state, 'belt_strap', index + 1, 'magic', [
        { affixId: 'suf_of_vigor', value: 15 + (index % 16) },
      ], content);
      if (item === null) throw new Error('kein Grundtyp');
      addToInventory(state, item);
    }
    const spare = createInstance(state, 'gloves_wrap', 3, 'normal', [], content);
    if (spare === null) throw new Error('kein Grundtyp');
    mapState.groundItems.push({ pos: { x: 2, y: 2 }, item: spare });

    expect(state.player.inventory).toHaveLength(MAX_INVENTORY);
    const restored = deserialize(serialize(state));

    expect(restored).toEqual(state);
    expect(restored.player.equipment['suit']).toEqual(worn);
    expect(restored.player.inventory).toHaveLength(MAX_INVENTORY);
    expect(restored.nextItemUid).toBe(state.nextItemUid);
    expect(restored.maps['test']?.groundItems).toEqual([{ pos: { x: 2, y: 2 }, item: spare }]);
  });
});

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
    expect(migrated.nextItemUid).toBe(1);
    expect(migrated.player.equipment).toEqual({});
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
