/**
 * Herkunft eines Speicherplatzes, PHASE_7 Block 4.
 */
import { describe, expect, it } from 'vitest';
import { describePlace, originOf, shortStamp } from '../src/ui/saveModel';
import { AUTOSAVE_SLOT } from '../src/net/localStore';
import type { SaveMeta } from '../src/core/types';

function meta(patch: Partial<SaveMeta> = {}): SaveMeta {
  return {
    slot: 0,
    turnCount: 120,
    level: 4,
    difficulty: 'normal',
    mapId: 'sohle_02',
    mapName: 'Sohle 2, Industrie',
    playTimeMs: 3 * 60000,
    updatedAt: '2026-08-23T10:15:00Z',
    checksum: 'abc',
    ...patch,
  };
}

describe('originOf', () => {
  it('kennt leer, nur lokal, nur entfernt, gleich und abweichend', () => {
    expect(originOf(undefined, undefined)).toBe('none');
    expect(originOf(meta(), undefined)).toBe('local');
    expect(originOf(undefined, meta())).toBe('remote');
    expect(originOf(meta(), meta())).toBe('both');
    expect(originOf(meta(), meta({ checksum: 'anders' }))).toBe('diverged');
  });
});

describe('describePlace', () => {
  it('nennt Stufe, Karte, Spielzeit, Zeitstempel und Herkunft', () => {
    const view = describePlace(0, meta(), undefined);
    expect(view.label).toBe('Platz 1');
    expect(view.detail).toBe('Stufe 4 · Sohle 2, Industrie · 3 min · 2026-08-23 10:15 · nur auf diesem Gerät');
    expect(view.stamps).toEqual([]);
  });

  it('nennt den Autosave-Platz beim Namen', () => {
    expect(describePlace(AUTOSAVE_SLOT, meta(), undefined).label).toBe('Autosave');
  });

  it('zeigt bei Abweichung beide Zeitstempel', () => {
    const view = describePlace(
      1,
      meta({ updatedAt: '2026-08-23T10:15:00Z' }),
      meta({ updatedAt: '2026-08-24T09:00:00Z', checksum: 'anders' })
    );
    expect(view.origin).toBe('diverged');
    expect(view.stamps).toEqual(['hier 2026-08-23 10:15', 'Server 2026-08-24 09:00']);
  });

  it('bleibt bei einem leeren Platz kurz', () => {
    const view = describePlace(2, undefined, undefined);
    expect(view.detail).toBe('leer');
    expect(view.origin).toBe('none');
  });

  it('zeigt den entfernten Stand, wenn lokal keiner liegt', () => {
    const view = describePlace(1, undefined, meta());
    expect(view.origin).toBe('remote');
    expect(view.detail).toContain('nur auf dem Server');
  });

  it('kuerzt den Zeitstempel auf Minuten', () => {
    expect(shortStamp('2026-08-23T10:15:42.123Z')).toBe('2026-08-23 10:15');
  });
});
