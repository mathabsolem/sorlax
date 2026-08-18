/**
 * Kachelkodierung nach INTERFACES v1.1 Abschnitt 6 und SPEC v1.1 Abschnitt 6.
 * Boden-, Decken- und Wandwerte tragen ihre Drehung in den oberen Bits.
 * Kein Modul schreibt diese Werte von Hand hin.
 */

export const TEXTURE_ID_MASK = 0x0fff;
export const ROTATION_SHIFT = 12;
export const ROTATION_MASK = 0x3;

/** Vierteldrehungen im Uhrzeigersinn. */
export type Rotation = 0 | 1 | 2 | 3;

/** Textur-Id eines kodierten Kachelwerts, 0 bis 4095. */
export function textureIdOf(value: number): number {
  return value & TEXTURE_ID_MASK;
}

/** Drehung eines kodierten Kachelwerts. */
export function rotationOf(value: number): Rotation {
  // Die Maske laesst nur 0 bis 3 durch, der Cast ist damit sicher.
  return ((value >> ROTATION_SHIFT) & ROTATION_MASK) as Rotation;
}

/** Packt Textur-Id und Drehung in einen Kachelwert. */
export function encodeTile(textureId: number, rotation: Rotation): number {
  return (textureId & TEXTURE_ID_MASK) | ((rotation & ROTATION_MASK) << ROTATION_SHIFT);
}
