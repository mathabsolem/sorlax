/**
 * Die Regel aus src/render/mount.ts: der Wirt behaelt seine Geometrie.
 *
 * Der Fehler dahinter kam aus dem Prototyp. In einem fremden Rahmen setzte der
 * Bootstrap `position: relative` inline auf `#app` und verdraengte damit das
 * `fixed` der Seite; der Canvas stand im Fluss und wuchs ueber den
 * ResizeObserver ins Uferlose. Sichtbar war ein Bild, das sich nicht mehr
 * aenderte, waehrend Automap und HUD weiterliefen.
 */
import { describe, expect, it } from 'vitest';
import { needsPositioning } from '../src/render/mount';

describe('needsPositioning', () => {
  it('setzt einen Bezugspunkt nur, wenn die Seite keinen gesetzt hat', () => {
    expect(needsPositioning('static')).toBe(true);
    expect(needsPositioning('')).toBe(true);
  });

  it('laesst jede Angabe der Seite stehen', () => {
    for (const placed of ['fixed', 'absolute', 'relative', 'sticky']) {
      expect(needsPositioning(placed)).toBe(false);
    }
  });
});
