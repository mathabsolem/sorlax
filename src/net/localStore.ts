/**
 * Lokale Ablage der Spielstaende, PHASE_4 Block 7.
 *
 * Die Anbindung an den PHP-Endpunkt kommt in Phase 8; `ApiClient` aus
 * INTERFACES Abschnitt 13 wird hier nicht angefasst.
 *
 * Der Speicher liegt hinter `SaveBackend`, damit die Ablagelogik ohne
 * IndexedDB pruefbar ist. Die idb-Fassung steht in indexedBackend.ts.
 */
import { serialize } from '../core/state';
import type { Difficulty, GameState, SaveMeta } from '../core/types';

/** Obergrenze eines serialisierten Standes, SPEC Abschnitt 11. Kein Richtwert. */
export const MAX_SAVE_BYTES = 2 * 1024 * 1024;

/** Plaetze je Schwierigkeitsgrad: drei manuelle, einer fuer den Autosave. */
export const MANUAL_SLOTS = [0, 1, 2] as const;
export const AUTOSAVE_SLOT = 3;

export type StoredSave = { meta: SaveMeta; state: GameState };

/** Minimaler Schluessel-Wert-Speicher. Die Tests setzen eine Attrappe ein. */
export interface SaveBackend {
  get(key: string): Promise<StoredSave | undefined>;
  put(key: string, value: StoredSave): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export interface LocalStore {
  list(): Promise<SaveMeta[]>;
  read(difficulty: Difficulty, slot: number): Promise<StoredSave | null>;
  write(difficulty: Difficulty, slot: number, state: GameState): Promise<SaveMeta>;
  remove(difficulty: Difficulty, slot: number): Promise<void>;
}

/** Schluessel eines Platzes. */
export function slotKey(difficulty: Difficulty, slot: number): string {
  return `${difficulty}:${slot}`;
}

/** Groesse des serialisierten Standes in Bytes, UTF-8. */
export function saveBytes(json: string): number {
  return new TextEncoder().encode(json).length;
}

/** Passt der Stand in die Grenze aus SPEC Abschnitt 11? */
export function saveSizeOf(json: string): { bytes: number; ok: boolean } {
  const bytes = saveBytes(json);
  return { bytes, ok: bytes <= MAX_SAVE_BYTES };
}

/** SHA-256 ueber den serialisierten Zustand, als Hexzeichenkette. */
export async function checksum(json: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Kopfdaten eines Standes fuer die Platzliste im Menue. */
export async function metaFor(
  state: GameState,
  slot: number,
  json: string,
  now: string
): Promise<SaveMeta> {
  return {
    slot,
    turnCount: state.turnCount,
    level: state.player.level,
    difficulty: state.difficulty,
    mapId: state.currentMapId,
    playTimeMs: state.playTimeMs,
    updatedAt: now,
    checksum: await checksum(json),
  };
}

/** Fehler beim Schreiben eines zu grossen Standes. */
export class SaveTooLargeError extends Error {
  constructor(readonly bytes: number) {
    super(`savegame is ${bytes} bytes, limit is ${MAX_SAVE_BYTES}`);
    this.name = 'SaveTooLargeError';
  }
}

/**
 * Ablage auf einem beliebigen Hintergrundspeicher.
 * `now` ist einspeisbar, damit ein Test keinen Zeitstempel raten muss.
 */
export function createLocalStore(
  backend: SaveBackend,
  now: () => string = () => new Date().toISOString()
): LocalStore {
  return {
    async list(): Promise<SaveMeta[]> {
      const keys = (await backend.keys()).sort();
      const metas: SaveMeta[] = [];
      for (const key of keys) {
        const entry = await backend.get(key);
        if (entry !== undefined) metas.push(entry.meta);
      }
      return metas;
    },

    async read(difficulty: Difficulty, slot: number): Promise<StoredSave | null> {
      return (await backend.get(slotKey(difficulty, slot))) ?? null;
    },

    async write(difficulty: Difficulty, slot: number, state: GameState): Promise<SaveMeta> {
      const json = serialize(state);
      const size = saveSizeOf(json);
      if (!size.ok) throw new SaveTooLargeError(size.bytes);

      const meta = await metaFor(state, slot, json, now());
      await backend.put(slotKey(difficulty, slot), { meta, state: JSON.parse(json) as GameState });
      return meta;
    },

    async remove(difficulty: Difficulty, slot: number): Promise<void> {
      await backend.delete(slotKey(difficulty, slot));
    },
  };
}
