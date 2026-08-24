/**
 * Anzeige eines Speicherplatzes, PHASE_7 Block 4.
 *
 * Reine Aufbereitung ohne DOM: welcher Stand liegt wo, und was ist zu sehen,
 * wenn lokal und entfernt auseinanderlaufen.
 */
import { AUTOSAVE_SLOT } from '../net/localStore';
import type { SaveMeta } from '../core/types';

export type Origin = 'none' | 'local' | 'remote' | 'both' | 'diverged';

export type PlaceView = {
  slot: number;
  label: string;
  detail: string;
  origin: Origin;
  /** Bei Abweichung beide Zeitstempel, sonst leer. */
  stamps: string[];
};

/** Zeitstempel kurz und lesbar: "2026-08-23 10:00". */
export function shortStamp(iso: string): string {
  return iso.replace('T', ' ').slice(0, 16);
}

/** Kurzform der Herkunft fuer die Zeile im Menue. */
export function originLabel(origin: Origin): string {
  switch (origin) {
    case 'local':
      return 'nur auf diesem Gerät';
    case 'remote':
      return 'nur auf dem Server';
    case 'both':
      return 'abgeglichen';
    case 'diverged':
      return 'weicht ab';
    default:
      return 'leer';
  }
}

/** Woher stammt der Stand? `diverged` heisst: beide da, aber nicht gleich. */
export function originOf(local: SaveMeta | undefined, remote: SaveMeta | undefined): Origin {
  if (local === undefined && remote === undefined) return 'none';
  if (local === undefined) return 'remote';
  if (remote === undefined) return 'local';
  return local.checksum === remote.checksum ? 'both' : 'diverged';
}

/**
 * Eine Zeile der Platzliste. Ohne Konto gibt es keine entfernten Staende, dann
 * steht dort schlicht der lokale.
 */
export function describePlace(
  slot: number,
  local: SaveMeta | undefined,
  remote: SaveMeta | undefined
): PlaceView {
  const label = slot === AUTOSAVE_SLOT ? 'Autosave' : `Platz ${slot + 1}`;
  const origin = originOf(local, remote);
  const shown = local ?? remote;

  if (shown === undefined) {
    return { slot, label, detail: 'leer', origin, stamps: [] };
  }

  const minutes = Math.floor(shown.playTimeMs / 60000);
  const parts = [
    `Stufe ${shown.level}`,
    shown.mapName,
    `${minutes} min`,
    shortStamp(shown.updatedAt),
    originLabel(origin),
  ];

  // Bei Abweichung zaehlen beide Zeitstempel, sonst raet der Spieler.
  const stamps =
    origin === 'diverged' && local !== undefined && remote !== undefined
      ? [`hier ${shortStamp(local.updatedAt)}`, `Server ${shortStamp(remote.updatedAt)}`]
      : [];

  return { slot, label, detail: parts.join(' · '), origin, stamps };
}
