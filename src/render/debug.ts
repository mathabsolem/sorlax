/**
 * Debugansichten des Renderers. Ersetzen die Textur durch eine berechnete Farbe,
 * damit Beleuchtung und Kachelkodierung im Bild pruefbar werden.
 *
 * Die Umschaltung haengt am Bootstrap und gilt nur im Entwicklungsbetrieb.
 */
import type { Rotation } from '../core/tiles';

export type DebugView = 'off' | 'light' | 'rotation';

function rgb(r: number, g: number, b: number): number {
  return ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** Farbcode je Kacheldrehung: 0 rot, 1 gruen, 2 blau, 3 gelb. */
export function rotationColor(rotation: Rotation): number {
  switch (rotation) {
    case 0:
      return rgb(220, 40, 40);
    case 1:
      return rgb(40, 200, 60);
    case 2:
      return rgb(60, 90, 230);
    case 3:
      return rgb(230, 210, 60);
  }
}

/** Helligkeit 0 bis 1 als Graustufe. */
export function greyPixel(brightness: number): number {
  const clamped = brightness < 0 ? 0 : brightness > 1 ? 1 : brightness;
  const value = Math.round(clamped * 255);
  return rgb(value, value, value);
}
