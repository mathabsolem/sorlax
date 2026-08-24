/**
 * Abgleich zwischen lokalem Stand und Server, PHASE_7 Tests 4 bis 7.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { createNewGame } from '../src/core/state';
import { createLocalStore } from '../src/net/localStore';
import type { SaveBackend, StoredSave } from '../src/net/localStore';
import { comparePlaces, createSync } from '../src/net/sync';
import type { QueueEntry, QueueStore } from '../src/net/sync';
import { FIRST_MAP_ID, createGameContent } from '../src/app/gameContent';
import type { ApiClient, Difficulty, GameState, SaveMeta } from '../src/core/types';

const content = createGameContent();

function memoryBackend(): SaveBackend {
  const data = new Map<string, StoredSave>();
  return {
    get: async (key) => data.get(key),
    put: async (key, value) => {
      data.set(key, value);
    },
    delete: async (key) => {
      data.delete(key);
    },
    keys: async () => [...data.keys()],
  };
}

function memoryQueue(): QueueStore {
  let entries: QueueEntry[] = [];
  return {
    read: async () => [...entries],
    write: async (next) => {
      entries = [...next];
    },
  };
}

function meta(slot: number, turnCount: number, checksum: string, difficulty: Difficulty = 'normal'): SaveMeta {
  return {
    slot,
    turnCount,
    level: 1,
    difficulty,
    mapId: 'sohle_01',
    mapName: 'Sohle 1, Industrie',
    playTimeMs: 0,
    updatedAt: '2026-08-23T10:00:00Z',
    checksum,
  };
}

/** ApiClient-Attrappe, die auf Wunsch scheitert. */
function fakeApi(): ApiClient & { pushed: number[]; fail: boolean; saves: SaveMeta[] } {
  const api = {
    pushed: [] as number[],
    fail: false,
    saves: [] as SaveMeta[],
    async register() {
      throw new Error('nicht benutzt');
    },
    async login() {
      throw new Error('nicht benutzt');
    },
    async logout() {},
    async listSaves(): Promise<SaveMeta[]> {
      return api.saves;
    },
    async pullSave(): Promise<{ meta: SaveMeta; state: GameState }> {
      throw new Error('nicht benutzt');
    },
    async pushSave(slot: number): Promise<SaveMeta> {
      if (api.fail) throw new Error('kein Netz');
      api.pushed.push(slot);
      return meta(slot, 0, 'x');
    },
  };
  return api as unknown as ApiClient & { pushed: number[]; fail: boolean; saves: SaveMeta[] };
}

describe('comparePlaces', () => {
  // Test 5
  it('holt den entfernten Stand, wenn er mehr Runden hat', () => {
    const plan = comparePlaces([meta(1, 900, 'lokal')], [meta(1, 1200, 'entfernt')]);
    expect(plan.pull.map((entry) => entry.turnCount)).toEqual([1200]);
    expect(plan.push).toEqual([]);
    expect(plan.conflicts).toEqual([]);
  });

  it('schickt den lokalen Stand, wenn er mehr Runden hat', () => {
    const plan = comparePlaces([meta(1, 1200, 'lokal')], [meta(1, 900, 'entfernt')]);
    expect(plan.push.map((entry) => entry.turnCount)).toEqual([1200]);
    expect(plan.pull).toEqual([]);
  });

  // Test 6
  it('meldet bei gleichem Rundenstand einen Konflikt, statt zu ueberschreiben', () => {
    const plan = comparePlaces([meta(1, 900, 'lokal')], [meta(1, 900, 'entfernt')]);
    expect(plan.pull).toEqual([]);
    expect(plan.push).toEqual([]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.conflicts[0]?.local.checksum).toBe('lokal');
  });

  it('laesst gleiche Staende in Ruhe und kennt beide Richtungen', () => {
    expect(comparePlaces([meta(1, 900, 'gleich')], [meta(1, 900, 'gleich')])).toEqual({
      pull: [],
      push: [],
      conflicts: [],
    });
    expect(comparePlaces([], [meta(2, 5, 'nur entfernt')]).pull).toHaveLength(1);
    expect(comparePlaces([meta(3, 5, 'nur lokal')], []).push).toHaveLength(1);
  });

  it('haelt Schwierigkeitsgrade auseinander', () => {
    const plan = comparePlaces([meta(1, 900, 'lokal', 'hard')], [meta(1, 1200, 'entfernt')]);
    expect(plan.push).toHaveLength(1);
    expect(plan.pull).toHaveLength(1);
    expect(plan.conflicts).toEqual([]);
  });
});

describe('createSync', () => {
  async function world() {
    const store = createLocalStore(memoryBackend(), () => '2026-08-23T10:00:00Z');
    const state = createNewGame(7, content, FIRST_MAP_ID);
    await store.write('normal', 0, state);
    await store.write('normal', 1, state);
    const api = fakeApi();
    const queue = memoryQueue();
    let clock = 0;
    const sync = createSync({ api, store, queue, now: () => clock });
    return { api, queue, sync, tick: (ms: number) => (clock += ms) };
  }

  // Test 4
  it('holt einen gescheiterten Push beim naechsten Versuch in der alten Reihenfolge nach', async () => {
    const { api, sync, queue, tick } = await world();
    api.fail = true;

    await sync.queueSave('normal', 0);
    tick(120000);
    await sync.queueSave('normal', 1);
    expect(await sync.pending()).toBe(2);
    expect(api.pushed).toEqual([]);
    expect((await queue.read()).map((entry) => entry.slot)).toEqual([0, 1]);

    api.fail = false;
    expect(await sync.flush()).toBe(0);
    expect(api.pushed).toEqual([0, 1]);
    expect(await sync.pending()).toBe(0);
  });

  it('sendet hoechstens einmal je Minute', async () => {
    const { api, sync, tick } = await world();

    await sync.queueSave('normal', 0);
    expect(api.pushed).toEqual([0]);

    await sync.queueSave('normal', 1);
    expect(api.pushed).toEqual([0]);

    tick(60001);
    await sync.queueSave('normal', 1);
    expect(api.pushed).toEqual([0, 1]);
  });

  it('stellt einen Platz nur einmal in die Warteschlange', async () => {
    const { api, sync, queue } = await world();
    api.fail = true;

    await sync.queueSave('normal', 0);
    await sync.queueSave('normal', 0);
    expect((await queue.read()).map((entry) => entry.slot)).toEqual([0]);
  });

  it('liefert ohne Netz einen leeren Plan statt einer Ausnahme', async () => {
    const { sync, api } = await world();
    api.listSaves = async () => {
      throw new Error('kein Netz');
    };
    await expect(sync.plan()).resolves.toEqual({ pull: [], push: [], conflicts: [] });
  });
});

describe('Netzfehler und Spiel', () => {
  // Test 7
  it('laesst applyCommand unberuehrt, wenn der Abgleich scheitert', async () => {
    const store = createLocalStore(memoryBackend(), () => '2026-08-23T10:00:00Z');
    const api = fakeApi();
    api.fail = true;
    const sync = createSync({ api, store, queue: memoryQueue() });

    const state = createNewGame(11, content, FIRST_MAP_ID);
    await store.write('normal', 3, state);

    // Der Abgleich scheitert, das Spiel laeuft weiter.
    await expect(sync.queueSave('normal', 3)).resolves.toBeUndefined();
    const events = applyCommand(state, { type: 'turn', dir: 'cw' }, content);

    expect(events.some((event) => event.type === 'turned')).toBe(true);
    expect(await sync.pending()).toBe(1);
  });
});
