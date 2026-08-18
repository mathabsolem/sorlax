/**
 * Texturzugriff mit eingebetteter Drehung nach SPEC v1.1 Abschnitt 6.
 * Die Drehung wirkt beim Auslesen, die Textur selbst liegt nur einmal vor.
 */
import type { Rotation } from '../core/tiles';
import type { PixelSurface } from '../core/types';

/**
 * Rechnet eine Abfragekoordinate auf die Koordinate in der ungedrehten Textur um.
 * Drehung 1 fragt (u, v) und trifft in der Quelle (v, size - 1 - u).
 */
export function rotateTexel(
  u: number,
  v: number,
  rotation: Rotation,
  size: number
): { u: number; v: number } {
  const last = size - 1;
  switch (rotation) {
    case 0:
      return { u, v };
    case 1:
      return { u: v, v: last - u };
    case 2:
      return { u: last - u, v: last - v };
    case 3:
      return { u: last - v, v: u };
  }
}

/** Liest ein Pixel aus einer quadratischen Textur, Koordinaten werden geklemmt. */
export function sampleTexture(
  surface: PixelSurface,
  u: number,
  v: number,
  rotation: Rotation
): number {
  const size = surface.width;
  const clampedU = u < 0 ? 0 : u >= size ? size - 1 : u;
  const clampedV = v < 0 ? 0 : v >= surface.height ? surface.height - 1 : v;
  const source = rotateTexel(clampedU, clampedV, rotation, size);
  return surface.pixels[source.v * size + source.u] ?? 0;
}
