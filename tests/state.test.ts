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
import {
  MAX_INVENTORY,
  addToInventory,
  createInstance,
  equippedWeapon,
} from '../src/core/items';
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

  // Test 8 aus PHASE_3_8
  it('startet mit der Brechstange im Waffenplatz', () => {
    const { state, content } = setup();
    const weapon = state.player.equipment['weapon'];

    expect(weapon?.baseId).toBe('item_w_prybar');
    expect(weapon?.rarity).toBe('normal');
    expect(weapon?.affixes).toEqual([]);
    expect(equippedWeapon(state, content)?.id).toBe('w_prybar');
    expect(state.player.weapons).toEqual(['w_prybar']);
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
    // Leichte Ausruestung verlangt Geschick 14, BESTIARY Abschnitt 8.
    state.player.attributes.agility = 14;
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const worn = createInstance(
      state,
      'suit_overall',
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
      const item = createInstance(state, 'belt_tool', index + 1, 'magic', [
        { affixId: 'suf_of_vigor', value: 15 + (index % 16) },
      ], content);
      if (item === null) throw new Error('kein Grundtyp');
      addToInventory(state, item);
    }
    const spare = createInstance(state, 'gloves_grip', 3, 'normal', [], content);
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
