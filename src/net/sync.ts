/**
 * Abgleich zwischen lokalem Stand und Server, PHASE_7 Block 3 und SPEC 11.
 *
 * Zwei Regeln stehen ueber allem:
 * - lokal wird immer zuerst und unabhaengig gespeichert
 * - ein Netzfehler blockiert das Spiel nie, er landet in der Warteschlange
 */
import type { ApiClient, Difficulty, GameState, SaveMeta } from '../core/types';
import type { LocalStore } from './localStore';

/** Ein Push darf hoechstens einmal je Minute laufen, PHASE_7 Block 3. */
export const PUSH_INTERVAL_MS = 60000;

export type QueueEntry = { difficulty: Difficulty; slot: number; queuedAt: number };

/** Ablage der Warteschlange. Liegt im Betrieb in IndexedDB. */
export interface QueueStore {
  read(): Promise<QueueEntry[]>;
  write(entries: QueueEntry[]): Promise<void>;
}

/** Was der Abgleich beim Start gefunden hat. */
export type SyncPlan = {
  /** Der Server ist weiter, sein Stand wird geholt. */
  pull: SaveMeta[];
  /** Lokal ist weiter, der Stand wird geschickt. */
  push: SaveMeta[];
  /** Gleicher Rundenstand, unterschiedliche Pruefsumme: die Oberflaeche fragt. */
  conflicts: { local: SaveMeta; remote: SaveMeta }[];
};

export type SyncOptions = {
  api: ApiClient;
  store: LocalStore;
  queue: QueueStore;
  now?: () => number;
};

/**
 * Vergleicht die Kopfdaten beider Seiten.
 *
 * Konfliktregel aus SPEC Abschnitt 11: hoeherer `turnCount` gewinnt. Bei
 * Gleichstand entscheidet niemand automatisch, sondern die Oberflaeche fragt.
 */
export function comparePlaces(local: readonly SaveMeta[], remote: readonly SaveMeta[]): SyncPlan {
  const plan: SyncPlan = { pull: [], push: [], conflicts: [] };
  const key = (meta: SaveMeta): string => `${meta.difficulty}:${meta.slot}`;
  const remoteByKey = new Map(remote.map((meta) => [key(meta), meta]));

  for (const here of local) {
    const there = remoteByKey.get(key(here));
    if (there === undefined) {
      plan.push.push(here);
      continue;
    }
    if (there.checksum === here.checksum) continue;
    if (there.turnCount > here.turnCount) plan.pull.push(there);
    else if (here.turnCount > there.turnCount) plan.push.push(here);
    else plan.conflicts.push({ local: here, remote: there });
  }

  for (const there of remote) {
    if (!local.some((here) => key(here) === key(there))) plan.pull.push(there);
  }
  return plan;
}

export interface Sync {
  /** Stellt einen Stand zum Senden ein. Wirft nie. */
  queueSave(difficulty: Difficulty, slot: number): Promise<void>;
  /** Arbeitet die Warteschlange ab. Gibt die Zahl der offenen Eintraege zurueck. */
  flush(): Promise<number>;
  /** Vergleicht beim Start beide Seiten. Wirft nie. */
  plan(): Promise<SyncPlan>;
  /** Wie viele Staende warten noch? Fuer den Kontobereich im Menue. */
  pending(): Promise<number>;
}

export function createSync(options: SyncOptions): Sync {
  const now = options.now ?? (() => Date.now());
  // Vor dem ersten Senden gibt es keine Wartezeit; 0 waere bei einer
  // eingespeisten Uhr, die bei 0 beginnt, faelschlich "gerade eben".
  let lastPush: number | null = null;

  const key = (entry: QueueEntry): string => `${entry.difficulty}:${entry.slot}`;

  async function enqueue(entry: QueueEntry): Promise<void> {
    const entries = await options.queue.read();
    // Ein Platz steht hoechstens einmal an. Der neuere Stand ersetzt den alten,
    // die Reihenfolge der Warteschlange bleibt dabei erhalten.
    const index = entries.findIndex((other) => key(other) === key(entry));
    if (index >= 0) entries[index] = entry;
    else entries.push(entry);
    await options.queue.write(entries);
  }

  return {
    async queueSave(difficulty: Difficulty, slot: number): Promise<void> {
      const entry: QueueEntry = { difficulty, slot, queuedAt: now() };
      await enqueue(entry);
      // Hoechstens einmal je Minute wird gesendet, der Rest wartet.
      if (lastPush !== null && now() - lastPush < PUSH_INTERVAL_MS) return;
      await this.flush();
    },

    async flush(): Promise<number> {
      const entries = await options.queue.read();
      if (entries.length === 0) return 0;

      lastPush = now();
      const left: QueueEntry[] = [];
      for (const [index, entry] of entries.entries()) {
        const stored = await options.store.read(entry.difficulty, entry.slot);
        if (stored === null) continue;
        try {
          await options.api.pushSave(entry.slot, stored.state as GameState);
        } catch {
          // Nach dem ersten Fehler wird abgebrochen. Der Rest bleibt in der
          // Reihenfolge stehen, in der er eingestellt wurde.
          left.push(...entries.slice(index));
          break;
        }
      }
      await options.queue.write(left);
      return left.length;
    },

    async plan(): Promise<SyncPlan> {
      try {
        const [here, there] = await Promise.all([options.store.list(), options.api.listSaves()]);
        return comparePlaces(here, there);
      } catch {
        // Ohne Netz gibt es nichts abzugleichen, und das ist kein Fehler.
        return { pull: [], push: [], conflicts: [] };
      }
    },

    async pending(): Promise<number> {
      return (await options.queue.read()).length;
    },
  };
}
