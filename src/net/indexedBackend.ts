/**
 * SaveBackend auf IndexedDB, PHASE_4 Block 7.
 * Einziger Ort in src/net mit Browserzugriff; die Ablagelogik in localStore.ts
 * bleibt davon frei und damit pruefbar.
 */
import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { SaveBackend, StoredSave } from './localStore';
import type { TokenStore } from './apiClient';
import type { QueueEntry, QueueStore } from './sync';

const DB_NAME = 'sorlax';
const DB_VERSION = 2;
const STORE = 'saves';

/**
 * Zweiter Speicher fuer Sitzungstoken und Warteschlange, PHASE_7 Block 3.
 * Der Token gehoert nicht in localStorage.
 */
const NET_STORE = 'net';
const TOKEN_KEY = 'token';
const QUEUE_KEY = 'queue';

async function open(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(NET_STORE)) db.createObjectStore(NET_STORE);
    },
  });
}

export function createIndexedBackend(): SaveBackend {
  let handle: Promise<IDBPDatabase> | null = null;
  const db = (): Promise<IDBPDatabase> => (handle ??= open());

  return {
    async get(key: string): Promise<StoredSave | undefined> {
      return (await db()).get(STORE, key) as Promise<StoredSave | undefined>;
    },
    async put(key: string, value: StoredSave): Promise<void> {
      await (await db()).put(STORE, value, key);
    },
    async delete(key: string): Promise<void> {
      await (await db()).delete(STORE, key);
    },
    async keys(): Promise<string[]> {
      return (await (await db()).getAllKeys(STORE)).map(String);
    },
  };
}

/** Sitzungstoken in IndexedDB, nicht in localStorage. */
export function createTokenStore(): TokenStore {
  let handle: Promise<IDBPDatabase> | null = null;
  const db = (): Promise<IDBPDatabase> => (handle ??= open());

  return {
    async read(): Promise<string | null> {
      const value = await (await db()).get(NET_STORE, TOKEN_KEY);
      return typeof value === 'string' ? value : null;
    },
    async write(token: string | null): Promise<void> {
      const store = await db();
      if (token === null) await store.delete(NET_STORE, TOKEN_KEY);
      else await store.put(NET_STORE, token, TOKEN_KEY);
    },
  };
}

/** Warteschlange der noch nicht uebertragenen Staende. */
export function createQueueStore(): QueueStore {
  let handle: Promise<IDBPDatabase> | null = null;
  const db = (): Promise<IDBPDatabase> => (handle ??= open());

  return {
    async read(): Promise<QueueEntry[]> {
      const value = await (await db()).get(NET_STORE, QUEUE_KEY);
      return Array.isArray(value) ? (value as QueueEntry[]) : [];
    },
    async write(entries: QueueEntry[]): Promise<void> {
      await (await db()).put(NET_STORE, entries, QUEUE_KEY);
    },
  };
}
