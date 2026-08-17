import { describe, expect, it } from 'vitest';
import {
  CURRENT_SAVE_VERSION,
  MAX_LOG_ENTRIES,
  createMapRuntime,
  createNewGame,
  deserialize,
  loadRng,
  migrate,
  pushLog,
  saveRng,
  serialize,
} from '../src/core/state';
import { Rng } from '../src/core/rng';
import { makeContent, makeMap, setup } from './fixtures/world';

describe('createNewGame', () => {
  it('setzt die Startwerte aus SPEC 5.1', () => {
    const { state } = setup();
    expect(state.version).toBe(CURRENT_SAVE_VERSION);
    expect(state.turnCount).toBe(0);
    expect(state.player.stats).toEqual({
      health: 50,
      maxHealth: 50,
      armor: 0,
      accuracy: 10,
      evasion: 5,
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
    const runtime = createMapRuntime(map, makeContent([map]));
    expect(runtime.entities.map((entity) => entity.id)).toEqual([1, 2, 3]);
    expect(runtime.nextEntityId).toBe(4);
    expect(runtime.entities[0]?.stats?.health).toBe(10);
    expect(runtime.entities[1]?.state).toBe('locked');
    expect(runtime.entities[2]?.stats).toBeUndefined();
  });

  it('ueberspringt Gegner ohne Definition', () => {
    const map = makeMap({ entities: [{ kind: 'enemy', defId: 'ghost', pos: { x: 3, y: 1 } }] });
    expect(createMapRuntime(map, makeContent([map])).entities).toHaveLength(0);
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
