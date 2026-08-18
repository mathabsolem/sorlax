import { describe, expect, it } from 'vitest';
import { FOV_RADIANS, PLANE_LENGTH, facingToAngle, makeCamera, rayDirection } from '../src/render/camera';

describe('facingToAngle', () => {
  it('bildet die vier Richtungen aus SPEC 3.1 ab', () => {
    // Nord zeigt nach -y, Ost nach +x, Sued nach +y, West nach -x
    for (const [facing, expected] of [
      [0, { x: 0, y: -1 }],
      [1, { x: 1, y: 0 }],
      [2, { x: 0, y: 1 }],
      [3, { x: -1, y: 0 }],
    ] as const) {
      const camera = makeCamera(0, 0, facingToAngle(facing));
      expect(camera.dirX).toBeCloseTo(expected.x, 10);
      expect(camera.dirY).toBeCloseTo(expected.y, 10);
    }
  });
});

describe('makeCamera', () => {
  it('stellt die Bildebene senkrecht auf die Blickrichtung', () => {
    const camera = makeCamera(2, 3, facingToAngle(1));
    expect(camera.dirX * camera.planeX + camera.dirY * camera.planeY).toBeCloseTo(0, 10);
    expect(Math.hypot(camera.planeX, camera.planeY)).toBeCloseTo(PLANE_LENGTH, 10);
  });

  it('nutzt ein Sichtfeld von 66 Grad', () => {
    expect(FOV_RADIANS).toBeCloseTo((66 * Math.PI) / 180, 10);
    expect(PLANE_LENGTH).toBeCloseTo(Math.tan(FOV_RADIANS / 2), 10);
  });
});

describe('rayDirection', () => {
  it('faechert von links nach rechts ueber das Sichtfeld auf', () => {
    const camera = makeCamera(0, 0, 0); // Blick nach Osten
    const left = rayDirection(camera, 0, 320);
    const centre = rayDirection(camera, 160, 320);
    const right = rayDirection(camera, 319, 320);

    expect(centre.x).toBeCloseTo(camera.dirX, 10);
    expect(centre.y).toBeCloseTo(camera.dirY, 10);
    // Blick nach Osten: links im Bild ist Norden, also kleineres y
    expect(left.y).toBeLessThan(centre.y);
    expect(right.y).toBeGreaterThan(centre.y);
  });

  it('haelt den halben Oeffnungswinkel am Bildrand ein', () => {
    const camera = makeCamera(0, 0, 0);
    const left = rayDirection(camera, 0, 320);
    const angle = Math.abs(Math.atan2(left.y, left.x));
    expect(angle).toBeCloseTo(FOV_RADIANS / 2, 2);
  });
});
