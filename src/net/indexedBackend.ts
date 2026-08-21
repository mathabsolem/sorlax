/**
 * SaveBackend auf IndexedDB, PHASE_4 Block 7.
 * Einziger Ort in src/net mit Browserzugriff; die Ablagelogik in localStore.ts
 * bleibt davon frei und damit pruefbar.
 */
import { openDB } from 'idb';
import type { IDBPDatabase } from 'idb';
import type { SaveBackend, StoredSave } from './localStore';

const DB_NAME = 'sorlax';
const DB_VERSION = 1;
const STORE = 'saves';

async function open(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
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
