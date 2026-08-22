/**
 * Lokale Ablage, PHASE_4 Block 7. Ohne IndexedDB, mit einer Attrappe.
 */
import { describe, expect, it } from 'vitest';
import {
  AUTOSAVE_SLOT,
  MANUAL_SLOTS,
  MAX_SAVE_BYTES,
  SaveTooLargeError,
  checksum,
  createLocalStore,
  metaFor,
  saveBytes,
  saveSizeOf,
  slotKey,
} from '../src/net/localStore';
import type { SaveBackend, StoredSave } from '../src/net/localStore';
import { serialize } from '../src/core/state';
import { setup } from './fixtures/world';

/** Attrappe des Speichers. Kein echtes IndexedDB im Test. */
function memoryBackend(): SaveBackend & { entries: Map<string, StoredSave> } {
  const entries = new Map<string, StoredSave>();
  return {
    entries,
    get: (key) => Promise.resolve(entries.get(key)),
    put: (key, value) => {
      // Wie IndexedDB: der Wert wird kopiert, nicht als Referenz gehalten.
      entries.set(key, JSON.parse(JSON.stringify(value)) as StoredSave);
      return Promise.resolve();
    },
    delete: (key) => {
      entries.delete(key);
      return Promise.resolve();
    },
    keys: () => Promise.resolve([...entries.keys()]),
  };
}

describe('slotKey und Plaetze', () => {
  it('bildet den Schluessel aus Grad und Platz', () => {
    expect(slotKey('normal', 0)).toBe('normal:0');
    expect(slotKey('nightmare', AUTOSAVE_SLOT)).toBe('nightmare:3');
    expect([...MANUAL_SLOTS]).toEqual([0, 1, 2]);
    expect(MANUAL_SLOTS).not.toContain(AUTOSAVE_SLOT);
  });
});

describe('saveSizeOf', () => {
  // Test 7 aus PHASE_4
  it('erkennt einen Zustand ueber zwei Megabyte', () => {
    expect(MAX_SAVE_BYTES).toBe(2 * 1024 * 1024);

    const small = saveSizeOf('{"a":1}');
    expect(small.ok).toBe(true);
    expect(small.bytes).toBe(7);

    const tooBig = saveSizeOf('x'.repeat(MAX_SAVE_BYTES + 1));
    expect(tooBig.ok).toBe(false);
    expect(tooBig.bytes).toBe(MAX_SAVE_BYTES + 1);

    // Genau auf der Grenze ist noch erlaubt.
    expect(saveSizeOf('x'.repeat(MAX_SAVE_BYTES)).ok).toBe(true);
  });

  it('zaehlt Bytes, nicht Zeichen', () => {
    // Ein Umlaut braucht in UTF-8 zwei Bytes.
    expect(saveBytes('ae')).toBe(2);
    expect(saveBytes('ä')).toBe(2);
    expect(saveBytes('—')).toBe(3);
  });
});

describe('checksum', () => {
  // Test 8 aus PHASE_4
  it('ist stabil und aendert sich mit dem Inhalt', async () => {
    const { state } = setup();
    const json = serialize(state);

    const first = await checksum(json);
    const second = await checksum(json);
    expect(first).toBe(second);
    expect(first).toMatch(/^[0-9a-f]{64}$/);

    state.turnCount += 1;
    expect(await checksum(serialize(state))).not.toBe(first);
  });
});

describe('metaFor', () => {
  it('uebernimmt die Kopfdaten aus dem Zustand', async () => {
    const { state } = setup();
    state.turnCount = 12;
    state.playTimeMs = 3456;
    const json = serialize(state);

    const meta = await metaFor(state, 1, json, '2026-08-20T10:00:00.000Z', 'Test Map');

    expect(meta).toEqual({
      slot: 1,
      turnCount: 12,
      level: 1,
      difficulty: 'normal',
      mapId: 'test',
      mapName: 'Test Map',
      playTimeMs: 3456,
      updatedAt: '2026-08-20T10:00:00.000Z',
      checksum: await checksum(json),
    });
  });
});

describe('createLocalStore', () => {
  // Test 9 aus PHASE_4
  it('liefert einen geschriebenen Zustand strukturgleich zurueck', async () => {
    const { state } = setup({ entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }] });
    const store = createLocalStore(memoryBackend(), () => '2026-08-20T10:00:00.000Z');

    const meta = await store.write('normal', 1, state);
    const restored = await store.read('normal', 1);

    expect(restored?.state).toEqual(state);
    expect(restored?.meta).toEqual(meta);
    expect(serialize(restored?.state ?? state)).toBe(serialize(state));
  });

  it('haelt Plaetze und Grade auseinander', async () => {
    const { state } = setup();
    const store = createLocalStore(memoryBackend());

    await store.write('normal', 0, state);
    state.turnCount = 99;
    await store.write('hard', 0, state);

    expect((await store.read('normal', 0))?.state.turnCount).toBe(0);
    expect((await store.read('hard', 0))?.state.turnCount).toBe(99);
    expect(await store.read('normal', 2)).toBeNull();
  });

  it('listet die Kopfdaten aller belegten Plaetze', async () => {
    const { state } = setup();
    const store = createLocalStore(memoryBackend(), () => '2026-08-20T10:00:00.000Z');

    await store.write('normal', 0, state);
    await store.write('normal', AUTOSAVE_SLOT, state);

    const list = await store.list();
    expect(list.map((meta) => meta.slot)).toEqual([0, AUTOSAVE_SLOT]);
    expect(list.every((meta) => meta.difficulty === 'normal')).toBe(true);
  });

  it('entfernt einen Platz', async () => {
    const { state } = setup();
    const store = createLocalStore(memoryBackend());

    await store.write('normal', 0, state);
    await store.remove('normal', 0);

    expect(await store.read('normal', 0)).toBeNull();
    expect(await store.list()).toEqual([]);
  });

  it('schreibt einen zu grossen Zustand nicht, sondern meldet ihn', async () => {
    const { state } = setup();
    // Ein aufgeblaehtes Log treibt den Stand ueber die Grenze.
    state.log = Array.from({ length: 3000 }, (_unused, index) => ({
      turn: index,
      kind: 'system' as const,
      text: 'x'.repeat(1000),
    }));
    const backend = memoryBackend();
    const store = createLocalStore(backend);

    await expect(store.write('normal', 0, state)).rejects.toBeInstanceOf(SaveTooLargeError);
    expect(backend.entries.size).toBe(0);
  });
});

describe('mapName aus INTERFACES v1.5', () => {
  it('loest den Kartennamen beim Schreiben auf', async () => {
    const { state, content } = setup();
    const store = createLocalStore(
      memoryBackend(),
      () => '2026-08-20T10:00:00.000Z',
      (mapId) => content.maps[mapId]?.name ?? mapId
    );

    const meta = await store.write('normal', 0, state);

    expect(meta.mapId).toBe('test');
    expect(meta.mapName).toBe('Test Map');
    // Die Platzliste kommt damit ohne ContentDb aus.
    expect((await store.list())[0]?.mapName).toBe('Test Map');
  });

  it('faellt ohne Aufloeser auf die Id zurueck', async () => {
    const { state } = setup();
    const store = createLocalStore(memoryBackend());
    expect((await store.write('normal', 0, state)).mapName).toBe('test');
  });
});
