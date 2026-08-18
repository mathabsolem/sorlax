/**
 * Kopfloses Rendern: SceneRenderer zeichnet in einen Framebuffer, der ohne DOM
 * auskommt. Geprueft wird der fertige Pixelpuffer, nicht die Bildausgabe.
 */
import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/core/state';
import type { AssetBundle, GameState, PixelSurface } from '../src/core/types';
import { Framebuffer } from '../src/render/framebuffer';
import { SceneRenderer } from '../src/render/sceneRenderer';
import { createPlaceholderAssets } from '../src/render/placeholders';
import { DEV_MAP_ID, DEV_SEED, collectAssetNames, createDevContent } from '../src/app/devFixture';
import { setup } from './fixtures/world';

const WIDTH = 320;
const HEIGHT = 200;

/** FNV-1a ueber alle Pixelbytes. */
function fnv1a(data: Uint32Array): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    const value = data[i] ?? 0;
    for (let shift = 0; shift < 32; shift += 8) {
      hash ^= (value >>> shift) & 0xff;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash >>> 0;
}

function devAssets(): AssetBundle {
  const names = collectAssetNames(createDevContent());
  return createPlaceholderAssets(names.spriteNames, names.weaponNames);
}

/** Zeichnet eine Szene ohne Zeitfortschritt, damit das Bild reproduzierbar ist. */
function renderOnce(state: GameState, content: ReturnType<typeof createDevContent>, assets: AssetBundle): Framebuffer {
  const framebuffer = new Framebuffer(WIDTH, HEIGHT);
  const scene = new SceneRenderer(framebuffer, assets);
  scene.setScene(state, content);
  scene.render(0);
  return framebuffer;
}

const channels = (pixel: number): { r: number; g: number; b: number } => ({
  r: pixel & 0xff,
  g: (pixel >> 8) & 0xff,
  b: (pixel >> 16) & 0xff,
});

const luminance = (pixel: number): number => {
  const { r, g, b } = channels(pixel);
  return r + g + b;
};

describe('Framebuffer ohne DOM', () => {
  it('laesst sich aus Breite und Hoehe bauen und haelt einen Uint32Array', () => {
    const framebuffer = new Framebuffer(WIDTH, HEIGHT);
    expect(framebuffer.width).toBe(WIDTH);
    expect(framebuffer.height).toBe(HEIGHT);
    expect(framebuffer.pixels).toBeInstanceOf(Uint32Array);
    expect(framebuffer.pixels.length).toBe(WIDTH * HEIGHT);
  });

  it('fuellt beim Loeschen mit undurchsichtigem Schwarz', () => {
    const framebuffer = new Framebuffer(4, 4);
    framebuffer.clear();
    expect([...framebuffer.pixels]).toEqual(new Array(16).fill(0xff000000));
  });

  it('rechnet den Ausschnitt ganzzahlig und mittig', () => {
    const framebuffer = new Framebuffer(WIDTH, HEIGHT);
    expect(framebuffer.viewportFor(960, 600)).toEqual({ scale: 3, offsetX: 0, offsetY: 0 });
    // 1000 x 600: Faktor 3 passt, links und rechts bleiben je 20 Pixel schwarz.
    expect(framebuffer.viewportFor(1000, 600)).toEqual({ scale: 3, offsetX: 20, offsetY: 0 });
    expect(framebuffer.viewportFor(100, 100).scale).toBe(1);
  });

  it('rechnet Zielpixel in interne Pixel um und meldet Treffer daneben', () => {
    const framebuffer = new Framebuffer(WIDTH, HEIGHT);
    expect(framebuffer.toInternal(0, 0, 960, 600)).toEqual({ x: 0, y: 0 });
    expect(framebuffer.toInternal(480, 300, 960, 600)).toEqual({ x: 160, y: 100 });
    expect(framebuffer.toInternal(10, 300, 1000, 600)).toBeNull(); // im schwarzen Rand
  });
});

describe('SceneRenderer, kopflos', () => {
  it('zeichnet die Entwicklungsszene pixelgleich zur festgeschriebenen Pruefsumme', () => {
    const content = createDevContent();
    const state = createNewGame(DEV_SEED, content, DEV_MAP_ID);
    const framebuffer = renderOnce(state, content, devAssets());

    expect(fnv1a(framebuffer.pixels)).toBe(0xf97d0943);
  });

  it('zeichnet dasselbe Bild bei jedem Lauf', () => {
    const content = createDevContent();
    const assets = devAssets();
    const first = renderOnce(createNewGame(DEV_SEED, content, DEV_MAP_ID), content, assets);
    const second = renderOnce(createNewGame(DEV_SEED, content, DEV_MAP_ID), content, assets);
    expect(fnv1a(second.pixels)).toBe(fnv1a(first.pixels));
  });

  it('zeigt in der Bildmitte auf Wandhoehe kein Schwarz', () => {
    const content = createDevContent();
    const state = createNewGame(DEV_SEED, content, DEV_MAP_ID);
    const framebuffer = renderOnce(state, content, devAssets());

    // Der Spieler startet mit Blick nach Osten auf die geschlossene Tuer.
    const pixel = framebuffer.pixels[Math.floor(HEIGHT / 2) * WIDTH + Math.floor(WIDTH / 2)] ?? 0;
    expect(pixel >>> 24).toBe(0xff);
    expect(luminance(pixel)).toBeGreaterThan(0);
  });

  it('zeichnet unter einer Lampe heller als in einer unbeleuchteten Ecke', () => {
    // Zwei baugleiche Gaenge der Testkarte, nur einer hat eine Deckenlampe.
    // Das Licht entsteht aus `lamps`, weil `light` leer uebergeben wird.
    const lit = setup({ lamps: [{ pos: { x: 3, y: 1 }, radius: 5, intensity: 255 }], light: [] });
    const dark = setup({ lamps: [{ pos: { x: 3, y: 1 }, radius: 5, intensity: 255 }], light: [] });

    const assets = createPlaceholderAssets([], ['fists']);
    // Beide blicken nach Westen auf dieselbe Wand in derselben Entfernung.
    lit.state.player.pos = { x: 5, y: 1 };
    lit.state.player.facing = 3;
    dark.state.player.pos = { x: 5, y: 6 };
    dark.state.player.facing = 3;

    const index = Math.floor(HEIGHT / 2) * WIDTH + Math.floor(WIDTH / 2);
    const litPixel = renderOnce(lit.state, lit.content, assets).pixels[index] ?? 0;
    const darkPixel = renderOnce(dark.state, dark.content, assets).pixels[index] ?? 0;

    expect(luminance(litPixel)).toBeGreaterThan(luminance(darkPixel));
    expect(luminance(darkPixel)).toBeGreaterThan(0);
  });

  it('zeigt hinter einer geschlossenen Tuer nicht die Sprite-Farbe', () => {
    const green = 0xff00ff00;
    const isGreen = (pixel: number): boolean => {
      const { r, g, b } = channels(pixel);
      return r === 0 && b === 0 && g > 0;
    };

    const flat: PixelSurface = { width: 64, height: 64, pixels: new Uint32Array(64 * 64).fill(green) };
    const assets = createPlaceholderAssets([], ['fists']);
    assets.sprites['idle0'] = flat;

    const entities = [
      { kind: 'door' as const, defId: 'gate', pos: { x: 3, y: 1 } },
      { kind: 'enemy' as const, defId: 'grunt', pos: { x: 5, y: 1 } },
    ];

    const hidden = setup({ entities, spawn: { pos: { x: 1, y: 1 }, facing: 1 } });
    const behindDoor = renderOnce(hidden.state, hidden.content, assets);
    expect([...behindDoor.pixels].some(isGreen)).toBe(false);

    // Gegenprobe: bei offener Tuer muss derselbe Gegner sichtbar sein.
    const visible = setup({ entities, spawn: { pos: { x: 1, y: 1 }, facing: 1 } });
    const door = visible.state.maps['test']?.entities[0];
    if (!door) throw new Error('missing door');
    door.state = 'open';
    const throughDoor = renderOnce(visible.state, visible.content, assets);
    expect([...throughDoor.pixels].some(isGreen)).toBe(true);
  });
});
