import { describe, expect, it } from 'vitest';
import { makeCamera, rayDirection } from '../src/render/camera';
import type { Camera } from '../src/render/camera';
import { NORTH_SOUTH_FACTOR, buildShadeLut } from '../src/render/shading';
import type { PixelSurface } from '../src/core/types';
import { SIDE_EAST_WEST, SIDE_NORTH_SOUTH, castRay, drawWalls } from '../src/render/raycaster';
import { makeRenderMap } from './fixtures/renderWorld';

const SCREEN_WIDTH = 320;
const SCREEN_HEIGHT = 200;

/** 8 x 8, offen, mit einer durchgehenden Wand in Spalte 5. */
const wallAtFive = makeRenderMap(8, 8, (x) => x === 5);

describe('castRay', () => {
  // Test 2 aus PHASE_3
  it('liefert fuer eine Wand in Distanz 3 die perpendikulare Distanz 3', () => {
    const hit = castRay(wallAtFive, 2, 1.5, 1, 0);
    expect(hit.hit).toBe(true);
    expect(hit.perpDist).toBeCloseTo(3, 2);
    expect(hit.side).toBe(SIDE_NORTH_SOUTH);
  });

  it('meldet die Seite der getroffenen Wandflaeche', () => {
    const floor = makeRenderMap(8, 8, (_x, y) => y === 6);
    const hit = castRay(floor, 2.5, 2.5, 0, 1);
    expect(hit.hit).toBe(true);
    expect(hit.side).toBe(SIDE_EAST_WEST);
    expect(hit.perpDist).toBeCloseTo(3.5, 2);
  });

  it('liefert einen Fehlschlag, wenn die Ray die Karte verlaesst', () => {
    const empty = makeRenderMap(8, 8, () => false);
    const hit = castRay(empty, 2.5, 2.5, 1, 0);
    expect(hit.hit).toBe(false);
    expect(hit.perpDist).toBe(Number.POSITIVE_INFINITY);
  });

  it('liest das Licht aus der letzten begehbaren Kachel vor dem Treffer', () => {
    const map = makeRenderMap(8, 8, (x) => x === 5);
    map.light[1 * 8 + 4] = 77;
    const hit = castRay(map, 2, 1.5, 1, 0);
    expect(hit.lightIndex).toBe(1 * 8 + 4);
    expect(map.light[hit.lightIndex]).toBe(77);
  });

  it('gibt den Trefferpunkt auf der Wandbreite als Bruch zurueck', () => {
    const hit = castRay(wallAtFive, 2, 1.25, 1, 0);
    expect(hit.wallX).toBeCloseTo(0.25, 6);
  });
});

describe('Fischaugenausgleich', () => {
  // Test 3 aus PHASE_3
  it('gibt einer geraden Wand ueber alle Spalten dieselbe Hoehe', () => {
    const map = makeRenderMap(8, 8, (x) => x === 6);
    const camera = makeCamera(2.5, 3.5, 0); // Winkel 0 zeigt nach Osten

    let min = Number.POSITIVE_INFINITY;
    let max = 0;
    for (let column = 0; column < SCREEN_WIDTH; column++) {
      const ray = rayDirection(camera, column, SCREEN_WIDTH);
      const hit = castRay(map, camera.x, camera.y, ray.x, ray.y);
      expect(hit.hit).toBe(true);
      const lineHeight = SCREEN_HEIGHT / hit.perpDist;
      min = Math.min(min, lineHeight);
      max = Math.max(max, lineHeight);
    }

    expect(max - min).toBeLessThanOrEqual(1);
  });
});

describe('drawWalls', () => {
  const white: PixelSurface = {
    width: 64,
    height: 64,
    pixels: new Uint32Array(64 * 64).fill(0xffffffff),
  };
  const textures = { 1: white };
  const lut = buildShadeLut();

  function draw(map: ReturnType<typeof makeRenderMap>, camera: Camera) {
    const target = new Uint32Array(SCREEN_WIDTH * SCREEN_HEIGHT);
    const zBuffer = new Float32Array(SCREEN_WIDTH);
    drawWalls(target, SCREEN_WIDTH, SCREEN_HEIGHT, camera, map, textures, lut, zBuffer);
    return { target, zBuffer };
  }

  it('fuellt den zBuffer mit der perpendikularen Distanz je Spalte', () => {
    const map = makeRenderMap(8, 8, (x) => x === 6);
    const { zBuffer } = draw(map, makeCamera(2.5, 3.5, 0));
    expect(zBuffer[160]).toBeCloseTo(3.5, 2);
    expect(zBuffer.every((value) => value > 0 && Number.isFinite(value))).toBe(true);
  });

  it('zeichnet die Wand um die Bildmitte und laesst Boden und Decke frei', () => {
    const map = makeRenderMap(8, 8, (x) => x === 6);
    const { target } = draw(map, makeCamera(2.5, 3.5, 0));
    expect(target[100 * SCREEN_WIDTH + 160]).not.toBe(0);
    expect(target[160]).toBe(0); // oberste Zeile bleibt der Decke ueberlassen
  });

  it('setzt den zBuffer auf unendlich, wo keine Wand steht', () => {
    const { zBuffer, target } = draw(makeRenderMap(8, 8, () => false), makeCamera(2.5, 3.5, 0));
    expect(zBuffer[160]).toBe(Number.POSITIVE_INFINITY);
    expect(target.every((pixel) => pixel === 0)).toBe(true);
  });

  it('dunkelt Nordsuedwaende um den Faktor 0.7 gegenueber Ostwestwaenden ab', () => {
    const northSouth = draw(makeRenderMap(8, 8, (x) => x === 6), makeCamera(2.5, 3.5, 0));
    const eastWest = draw(
      makeRenderMap(8, 8, (_x, y) => y === 6),
      makeCamera(3.5, 2.5, Math.PI / 2)
    );

    const nsPixel = northSouth.target[100 * SCREEN_WIDTH + 160] ?? 0;
    const ewPixel = eastWest.target[100 * SCREEN_WIDTH + 160] ?? 0;
    expect(nsPixel & 0xff).toBeLessThan(ewPixel & 0xff);
    expect(NORTH_SOUTH_FACTOR).toBe(0.7);
  });
});
