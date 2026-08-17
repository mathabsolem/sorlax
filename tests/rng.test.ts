import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';

describe('Rng', () => {
  it('liefert bei gleichem Seed die gleiche Sequenz', () => {
    const a = new Rng(12345);
    const b = new Rng(12345);
    const seqA = Array.from({ length: 100 }, () => a.next());
    const seqB = Array.from({ length: 100 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('liefert bei unterschiedlichem Seed eine andere Sequenz', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).not.toEqual(seqB);
  });

  it('liefert Floats in [0, 1)', () => {
    const rng = new Rng(777);
    for (let i = 0; i < 10000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('stellt die Sequenz per setState exakt wieder her', () => {
    const rng = new Rng(4242);
    for (let i = 0; i < 37; i++) rng.next();

    const snapshot = rng.getState();
    const expected = Array.from({ length: 50 }, () => rng.next());

    rng.setState(snapshot);
    const replayed = Array.from({ length: 50 }, () => rng.next());
    expect(replayed).toEqual(expected);

    // Auch eine fremde Instanz muss den Zustand uebernehmen koennen (Savegame laden).
    const restored = new Rng(0);
    restored.setState(snapshot);
    expect(Array.from({ length: 50 }, () => restored.next())).toEqual(expected);
  });

  it('gibt von getState eine Kopie zurueck, keine Referenz', () => {
    const rng = new Rng(9);
    const first = rng.getState();
    rng.next();
    expect(rng.getState()).not.toEqual(first);
  });

  it('haelt randInt ueber 10000 Ziehungen in den Grenzen', () => {
    const rng = new Rng(2026);
    for (let i = 0; i < 10000; i++) {
      const value = rng.randInt(3, 9);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
    }
  });

  it('trifft bei randInt beide Grenzen', () => {
    const rng = new Rng(31337);
    const seen = new Set<number>();
    for (let i = 0; i < 10000; i++) seen.add(rng.randInt(1, 6));
    expect(seen).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it('liefert bei min gleich max genau diesen Wert', () => {
    const rng = new Rng(5);
    for (let i = 0; i < 100; i++) expect(rng.randInt(4, 4)).toBe(4);
  });
});
