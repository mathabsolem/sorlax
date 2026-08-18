import { describe, expect, it } from 'vitest';
import { makeCamera } from '../src/render/camera';
import { buildShadeLut } from '../src/render/shading';
import { DEFAULT_SPRITE_WIDTH, MIN_SPRITE_DISTANCE, drawSprites } from '../src/render/sprites';
import type { Billboard } from '../src/render/sprites';
import { makeRenderMap } from './fixtures/renderWorld';

const WIDTH = 320;
const HEIGHT = 200;
const lut = buildShadeLut();
const map = makeRenderMap(16, 16, () => false);

/** Vollflaechig deckendes Sprite. */
function solidSurface(): { width: number; height: number; pixels: Uint32Array } {
  return { width: 8, height: 8, pixels: new Uint32Array(64).fill(0xff40c0ff) };
}

function billboard(x: number, y: number, id: number | null = 1): Billboard {
  return { id, x, y, widthTiles: DEFAULT_SPRITE_WIDTH, surface: solidSurface() };
}

function openZBuffer(): Float32Array {
  return new Float32Array(WIDTH).fill(100);
}

describe('drawSprites', () => {
  it('zeichnet ein Sprite vor der Kamera und meldet sein Rechteck', () => {
    const target = new Uint32Array(WIDTH * HEIGHT);
    const camera = makeCamera(8.5, 8.5, 0); // Blick nach Osten
    const rects = drawSprites(target, WIDTH, HEIGHT, camera, map, [billboard(11.5, 8.5)], lut, openZBuffer());

    expect(rects).toHaveLength(1);
    expect(rects[0]?.id).toBe(1);
    expect(target.some((pixel) => pixel !== 0)).toBe(true);
  });

  it('trifft die erwartete Bildgeometrie: mittig, Hoehe eine Kachel, Breite nach spriteWidth', () => {
    const target = new Uint32Array(WIDTH * HEIGHT);
    const camera = makeCamera(8.5, 8.5, 0);
    const depth = 3; // Sprite genau 3 Kacheln voraus
    const board = billboard(8.5 + depth, 8.5);

    const rects = drawSprites(target, WIDTH, HEIGHT, camera, map, [board], lut, openZBuffer());
    const rect = rects[0];
    expect(rect).toBeDefined();
    if (!rect) return;

    const scale = HEIGHT / depth;
    // Das Rechteck wird auf ganze Pixel aufgerundet, deshalb zwei Pixel Toleranz.
    const near = (actual: number, expected: number): void => {
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(2);
    };

    // Hoehe entspricht einer Kachel, senkrecht um den Horizont zentriert.
    near(rect.y1 - rect.y0, scale);
    near((rect.y0 + rect.y1) / 2, HEIGHT / 2);
    // Breite folgt spriteWidth, waagerecht um die Bildmitte zentriert.
    near(rect.x1 - rect.x0, scale * DEFAULT_SPRITE_WIDTH);
    near((rect.x0 + rect.x1) / 2, WIDTH / 2);
  });

  it('setzt ein Sprite links vom Blick auch links ins Bild', () => {
    const target = new Uint32Array(WIDTH * HEIGHT);
    const camera = makeCamera(8.5, 8.5, 0); // Blick nach Osten, links ist Norden
    const rects = drawSprites(target, WIDTH, HEIGHT, camera, map, [billboard(11.5, 7.5)], lut, openZBuffer());
    const rect = rects[0];
    expect(rect).toBeDefined();
    if (!rect) return;
    expect((rect.x0 + rect.x1) / 2).toBeLessThan(WIDTH / 2);
  });

  it('verwirft Sprites hinter der Kamera und zu nahe Sprites', () => {
    const target = new Uint32Array(WIDTH * HEIGHT);
    const camera = makeCamera(8.5, 8.5, 0);
    const behind = drawSprites(target, WIDTH, HEIGHT, camera, map, [billboard(4.5, 8.5)], lut, openZBuffer());
    expect(behind).toEqual([]);

    const tooClose = drawSprites(
      target,
      WIDTH,
      HEIGHT,
      camera,
      map,
      [billboard(8.5 + MIN_SPRITE_DISTANCE / 2, 8.5)],
      lut,
      openZBuffer()
    );
    expect(tooClose).toEqual([]);
  });

  it('laesst sich vom zBuffer verdecken', () => {
    const target = new Uint32Array(WIDTH * HEIGHT);
    const camera = makeCamera(8.5, 8.5, 0);
    const wallInFront = new Float32Array(WIDTH).fill(1);

    const rects = drawSprites(target, WIDTH, HEIGHT, camera, map, [billboard(11.5, 8.5)], lut, wallInFront);
    expect(rects).toEqual([]);
    expect(target.every((pixel) => pixel === 0)).toBe(true);
  });

  it('ueberspringt vollstaendig transparente Pixel', () => {
    const target = new Uint32Array(WIDTH * HEIGHT);
    const camera = makeCamera(8.5, 8.5, 0);
    const invisible = billboard(11.5, 8.5);
    invisible.surface.pixels.fill(0);

    const rects = drawSprites(target, WIDTH, HEIGHT, camera, map, [invisible], lut, openZBuffer());
    expect(rects).toEqual([]);
    expect(target.every((pixel) => pixel === 0)).toBe(true);
  });

  it('zeichnet von weit nach nah, das nahe Sprite gewinnt', () => {
    const target = new Uint32Array(WIDTH * HEIGHT);
    const camera = makeCamera(8.5, 8.5, 0);
    const far = billboard(13.5, 8.5, 1);
    const near = billboard(10.5, 8.5, 2);
    near.surface.pixels.fill(0xff00ff00);

    const rects = drawSprites(target, WIDTH, HEIGHT, camera, map, [near, far], lut, openZBuffer());
    expect(rects.map((rect) => rect.id)).toEqual([1, 2]);
    expect(target[100 * WIDTH + 160]).toBe(0xff00ff00);
  });

  it('meldet Leichen ohne Id nicht fuer die Zielauswahl', () => {
    const target = new Uint32Array(WIDTH * HEIGHT);
    const camera = makeCamera(8.5, 8.5, 0);
    const rects = drawSprites(target, WIDTH, HEIGHT, camera, map, [billboard(11.5, 8.5, null)], lut, openZBuffer());
    expect(rects).toEqual([]);
    expect(target.some((pixel) => pixel !== 0)).toBe(true);
  });
});
