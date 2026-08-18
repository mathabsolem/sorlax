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

/** Vollflaechig deckendes Sprite, quadratisch wie die echten 64 x 64 Sprites. */
function solidSurface(size = 64): { width: number; height: number; pixels: Uint32Array } {
  return { width: size, height: size, pixels: new Uint32Array(size * size).fill(0xff40c0ff) };
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

  it('zeichnet ein quadratisches Quellsprite in Distanz 2 quadratisch', () => {
    const target = new Uint32Array(WIDTH * HEIGHT);
    const camera = makeCamera(8.5, 8.5, 0);
    const rects = drawSprites(
      target,
      WIDTH,
      HEIGHT,
      camera,
      map,
      [billboard(8.5 + 2, 8.5)],
      lut,
      openZBuffer()
    );
    const rect = rects[0];
    expect(rect).toBeDefined();
    if (!rect) return;

    const rectWidth = rect.x1 - rect.x0;
    const rectHeight = rect.y1 - rect.y0;
    const deviation = Math.abs(rectWidth - rectHeight) / Math.max(rectWidth, rectHeight);
    expect(deviation).toBeLessThan(0.02);
  });

  // Bei kleinen Sprites schlaegt das Runden der Rechteckgrenzen durch, deshalb hier
  // ein Pixelbudget statt einer Prozentschranke. Die Geometrie selbst ist exakt.
  it('bleibt ueber alle Distanzen quadratisch, bis auf das Runden auf ganze Pixel', () => {
    const camera = makeCamera(8.5, 8.5, 0);
    for (const depth of [1, 1.5, 2, 3, 5, 7]) {
      const target = new Uint32Array(WIDTH * HEIGHT);
      const rects = drawSprites(
        target,
        WIDTH,
        HEIGHT,
        camera,
        map,
        [billboard(8.5 + depth, 8.5)],
        lut,
        openZBuffer()
      );
      const rect = rects[0];
      expect(rect).toBeDefined();
      if (!rect) continue;
      expect(Math.abs((rect.x1 - rect.x0) - (rect.y1 - rect.y0))).toBeLessThanOrEqual(2);
    }
  });

  it('behaelt das Seitenverhaeltnis einer nicht quadratischen Quelle bei', () => {
    const target = new Uint32Array(WIDTH * HEIGHT);
    const camera = makeCamera(8.5, 8.5, 0);
    const wide = billboard(8.5 + 3, 8.5);
    wide.surface = { width: 160, height: 100, pixels: new Uint32Array(16000).fill(0xff40c0ff) };

    const rects = drawSprites(target, WIDTH, HEIGHT, camera, map, [wide], lut, openZBuffer());
    const rect = rects[0];
    expect(rect).toBeDefined();
    if (!rect) return;

    const ratio = (rect.y1 - rect.y0) / (rect.x1 - rect.x0);
    expect(Math.abs(ratio - 100 / 160)).toBeLessThan(0.03);
  });

  it('skaliert die Breite mit spriteWidth und mittig zur Blickachse', () => {
    const target = new Uint32Array(WIDTH * HEIGHT);
    const camera = makeCamera(8.5, 8.5, 0);
    const narrow = billboard(8.5 + 3, 8.5);
    narrow.widthTiles = DEFAULT_SPRITE_WIDTH / 2;

    const wideRects = drawSprites(
      target,
      WIDTH,
      HEIGHT,
      camera,
      map,
      [billboard(8.5 + 3, 8.5)],
      lut,
      openZBuffer()
    );
    const narrowRects = drawSprites(
      new Uint32Array(WIDTH * HEIGHT),
      WIDTH,
      HEIGHT,
      camera,
      map,
      [narrow],
      lut,
      openZBuffer()
    );

    const wide = wideRects[0];
    const thin = narrowRects[0];
    expect(wide).toBeDefined();
    expect(thin).toBeDefined();
    if (!wide || !thin) return;
    expect((wide.x1 - wide.x0) / (thin.x1 - thin.x0)).toBeCloseTo(2, 0);
    expect(Math.abs((wide.x0 + wide.x1) / 2 - WIDTH / 2)).toBeLessThanOrEqual(2);
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
