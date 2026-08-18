import { describe, expect, it } from 'vitest';
import { rotateTexel, sampleTexture } from '../src/render/texture';
import { makeIndexSurface } from './fixtures/renderWorld';

const SIZE = 64;
const surface = makeIndexSurface(SIZE);

describe('rotateTexel', () => {
  it('laesst Drehung 0 unveraendert', () => {
    expect(rotateTexel(7, 11, 0, SIZE)).toEqual({ u: 7, v: 11 });
  });

  it('dreht in Vierteln und ist nach vier Schritten wieder am Anfang', () => {
    let point = { u: 5, v: 9 };
    for (let i = 0; i < 4; i++) point = rotateTexel(point.u, point.v, 1, SIZE);
    expect(point).toEqual({ u: 5, v: 9 });
  });

  it('kehrt Drehung 2 die Mitte um', () => {
    expect(rotateTexel(0, 0, 2, SIZE)).toEqual({ u: 63, v: 63 });
    expect(rotateTexel(63, 63, 2, SIZE)).toEqual({ u: 0, v: 0 });
  });
});

describe('sampleTexture', () => {
  // Test 9 aus PHASE_3
  it('liefert bei Drehung 1 fuer (u, v) den Pixel der ungedrehten Textur bei (v, 63 - u)', () => {
    for (const [u, v] of [
      [0, 0],
      [1, 0],
      [17, 42],
      [63, 63],
      [5, 60],
    ]) {
      if (u === undefined || v === undefined) continue;
      expect(sampleTexture(surface, u, v, 1)).toBe(sampleTexture(surface, v, 63 - u, 0));
    }
  });

  it('klemmt Koordinaten auf die Textur', () => {
    expect(sampleTexture(surface, -5, 0, 0)).toBe(sampleTexture(surface, 0, 0, 0));
    expect(sampleTexture(surface, 999, 999, 0)).toBe(sampleTexture(surface, 63, 63, 0));
  });

  it('liest bei Drehung 3 spiegelbildlich zu Drehung 1', () => {
    expect(sampleTexture(surface, 10, 20, 3)).toBe(sampleTexture(surface, 63 - 20, 10, 0));
  });
});
