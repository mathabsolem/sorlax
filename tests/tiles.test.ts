import { describe, expect, it } from 'vitest';
import {
  ROTATION_MASK,
  ROTATION_SHIFT,
  TEXTURE_ID_MASK,
  encodeTile,
  rotationOf,
  textureIdOf,
} from '../src/core/tiles';
import type { Rotation } from '../src/core/tiles';

const ROTATIONS: Rotation[] = [0, 1, 2, 3];

describe('Kachelkodierung', () => {
  it('haelt die Konstanten aus INTERFACES Abschnitt 6', () => {
    expect(TEXTURE_ID_MASK).toBe(0x0fff);
    expect(ROTATION_SHIFT).toBe(12);
    expect(ROTATION_MASK).toBe(0x3);
  });

  // Test 1 aus PHASE_3
  it('ist fuer alle Drehungen und die Randwerte der Textur-Id invers', () => {
    for (const textureId of [0, 1, 4095]) {
      for (const rotation of ROTATIONS) {
        const value = encodeTile(textureId, rotation);
        expect(textureIdOf(value)).toBe(textureId);
        expect(rotationOf(value)).toBe(rotation);
      }
    }
  });

  it('trennt Textur-Id und Drehung sauber', () => {
    const value = encodeTile(4095, 3);
    expect(value).toBe(0x3fff);
    expect(textureIdOf(0)).toBe(0);
    expect(rotationOf(0)).toBe(0);
  });

  it('schneidet zu grosse Eingaben auf die Maske zurueck', () => {
    expect(textureIdOf(encodeTile(0x1234, 1))).toBe(0x234);
  });
});
