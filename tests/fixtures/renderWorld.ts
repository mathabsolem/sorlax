/**
 * Hilfen fuer die Renderer-Tests. Getestet wird nur Mathematik, nie Bildausgabe.
 */
import { encodeTile } from '../../src/core/tiles';
import type { PixelSurface } from '../../src/core/types';
import type { RenderMap } from '../../src/render/renderMap';

/** Karte aus einem Praedikat, ohne Umweg ueber MapDef. */
export function makeRenderMap(
  width: number,
  height: number,
  solid: (x: number, y: number) => boolean,
  options: { light?: number; ambientLight?: number } = {}
): RenderMap {
  const size = width * height;
  const walls = new Int32Array(size);
  const floors = new Int32Array(size);
  const ceilings = new Int32Array(size);
  const light = new Uint8Array(size);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      walls[index] = solid(x, y) ? encodeTile(1, 0) : 0;
      floors[index] = encodeTile(10, 0);
      ceilings[index] = encodeTile(20, 0);
      light[index] = options.light ?? 255;
    }
  }

  return { width, height, walls, floors, ceilings, light, ambientLight: options.ambientLight ?? 1 };
}

/** Textur, in der jedes Pixel seine eigene Position kodiert. */
export function makeIndexSurface(size: number): PixelSurface {
  const pixels = new Uint32Array(size * size);
  for (let v = 0; v < size; v++) {
    for (let u = 0; u < size; u++) {
      pixels[v * size + u] = (0xff000000 | (v << 8) | u) >>> 0;
    }
  }
  return { width: size, height: size, pixels };
}
