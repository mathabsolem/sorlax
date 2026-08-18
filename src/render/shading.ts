/**
 * Helligkeit nach SPEC v1.1 Abschnitt 7 plus die Nachschlagetabelle aus
 * docs/tasks/PHASE_3.md. Statt drei Multiplikationen und drei Rundungen pro Pixel
 * kostet das Abdunkeln damit drei Array-Zugriffe.
 */

export const SHADE_LEVELS = 32;
export const MAX_VIEW_DIST = 16;
export const PLAYER_LIGHT_RANGE = 4;
export const PLAYER_LIGHT_STRENGTH = 0.35;
export const MIN_BRIGHTNESS = 0.04;

/** Nordsuedwaende, also Waende in der Ebene x = const, werden abgedunkelt. */
export const NORTH_SOUTH_FACTOR = 0.7;

function clamp(min: number, max: number, value: number): number {
  return value < min ? min : value > max ? max : value;
}

/** shadeLUT[level * 256 + value] = round(value * level / (LEVELS - 1)). */
export function buildShadeLut(): Uint8Array {
  const lut = new Uint8Array(SHADE_LEVELS * 256);
  for (let level = 0; level < SHADE_LEVELS; level++) {
    const factor = level / (SHADE_LEVELS - 1);
    const base = level * 256;
    for (let value = 0; value < 256; value++) {
      lut[base + value] = Math.round(value * factor);
    }
  }
  return lut;
}

/**
 * brightness = clamp(0.04, 1, ambientLight * staticLight * distanceFactor + playerLight)
 * `light` ist der rohe Kachelwert 0 bis 255.
 */
export function computeBrightness(light: number, dist: number, ambientLight: number): number {
  const staticLight = light / 255;
  const distanceFactor = clamp(0, 1, 1 - dist / MAX_VIEW_DIST);
  const playerLight = PLAYER_LIGHT_STRENGTH * clamp(0, 1, 1 - dist / PLAYER_LIGHT_RANGE);
  return clamp(MIN_BRIGHTNESS, 1, ambientLight * staticLight * distanceFactor + playerLight);
}

/** Quantisiert eine Helligkeit 0 bis 1 auf einen Tabellenlevel 0 bis 31. */
export function brightnessToLevel(brightness: number): number {
  const level = Math.round(clamp(0, 1, brightness) * (SHADE_LEVELS - 1));
  return level < 0 ? 0 : level > SHADE_LEVELS - 1 ? SHADE_LEVELS - 1 : level;
}

/**
 * Dunkelt ein Pixel im Format 0xAABBGGRR ab. Alpha wird auf 255 gesetzt,
 * der Renderer kennt kein Blending.
 */
export function shadePixel(lut: Uint8Array, pixel: number, level: number): number {
  const base = level * 256;
  const r = lut[base + (pixel & 0xff)] ?? 0;
  const g = lut[base + ((pixel >> 8) & 0xff)] ?? 0;
  const b = lut[base + ((pixel >> 16) & 0xff)] ?? 0;
  return ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
}
