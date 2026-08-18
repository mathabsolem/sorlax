import { describe, expect, it } from 'vitest';
import { drawFloorAndCeiling, rowDistance } from '../src/render/floorcast';
import { makeCamera } from '../src/render/camera';
import { buildShadeLut } from '../src/render/shading';
import { makeIndexSurface, makeRenderMap } from './fixtures/renderWorld';

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 200;

describe('rowDistance', () => {
  // Test 4 aus PHASE_3
  it('ist direkt unter dem Horizont deutlich groesser als in der untersten Zeile', () => {
    const nearHorizon = rowDistance(SCREEN_HEIGHT / 2 + 1, SCREEN_HEIGHT);
    const bottom = rowDistance(SCREEN_HEIGHT - 1, SCREEN_HEIGHT);

    expect(Number.isFinite(nearHorizon)).toBe(true);
    expect(Number.isFinite(bottom)).toBe(true);
    expect(nearHorizon).toBeGreaterThan(0);
    expect(bottom).toBeGreaterThan(0);
    expect(nearHorizon).toBeGreaterThan(bottom * 10);
  });

  it('faellt monoton zur unteren Bildkante', () => {
    let previous = Number.POSITIVE_INFINITY;
    for (let y = SCREEN_HEIGHT / 2 + 1; y < SCREEN_HEIGHT; y++) {
      const distance = rowDistance(y, SCREEN_HEIGHT);
      expect(distance).toBeLessThan(previous);
      previous = distance;
    }
  });
});

describe('drawFloorAndCeiling', () => {
  it('fuellt untere und obere Bildhaelfte, laesst den Horizont frei', () => {
    const target = new Uint32Array(SCREEN_WIDTH * SCREEN_HEIGHT);
    const map = makeRenderMap(16, 16, () => false);
    const textures = { 10: makeIndexSurface(64), 20: makeIndexSurface(64) };

    drawFloorAndCeiling(
      target,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      makeCamera(8.5, 8.5, 0),
      map,
      textures,
      buildShadeLut()
    );

    const horizon = SCREEN_HEIGHT / 2;
    expect(target[(SCREEN_HEIGHT - 1) * SCREEN_WIDTH + 160]).not.toBe(0); // Boden
    expect(target[160]).not.toBe(0); // Decke
    expect(target[horizon * SCREEN_WIDTH + 160]).toBe(0); // Horizontzeile bleibt leer
  });

  it('laesst Pixel ausserhalb der Karte schwarz', () => {
    const target = new Uint32Array(SCREEN_WIDTH * SCREEN_HEIGHT);
    const map = makeRenderMap(2, 2, () => false);
    const textures = { 10: makeIndexSurface(64), 20: makeIndexSurface(64) };

    drawFloorAndCeiling(
      target,
      SCREEN_WIDTH,
      SCREEN_HEIGHT,
      makeCamera(1, 1, 0),
      map,
      textures,
      buildShadeLut()
    );

    // Die Zeile direkt unter dem Horizont blickt weit hinaus und trifft nichts.
    expect(target[(SCREEN_HEIGHT / 2 + 1) * SCREEN_WIDTH]).toBe(0);
  });
});
