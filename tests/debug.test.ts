/**
 * Debugansichten, kopflos gerendert. F7 zeigt Helligkeit als Graustufe,
 * F8 die Drehung jeder Bodenkachel als Farbe.
 */
import { describe, expect, it, vi } from 'vitest';
import { createNewGame } from '../src/core/state';
import { greyPixel, rotationColor } from '../src/render/debug';
import type { DebugView } from '../src/render/debug';
import { Framebuffer } from '../src/render/framebuffer';
import { SceneRenderer } from '../src/render/sceneRenderer';
import { createPlaceholderAssets } from '../src/render/placeholders';
import { collectAssetNames, createDevContent, DEV_MAP_ID, DEV_SEED } from '../src/app/devFixture';
import { attachKeyboard } from '../src/input/keyboard';

const WIDTH = 320;
const HEIGHT = 200;

function renderDev(view: DebugView): Framebuffer {
  const content = createDevContent();
  const state = createNewGame(DEV_SEED, content, DEV_MAP_ID);
  const names = collectAssetNames(content);
  const framebuffer = new Framebuffer(WIDTH, HEIGHT);
  const scene = new SceneRenderer(
    framebuffer,
    createPlaceholderAssets(names.spriteNames, names.weaponNames)
  );
  scene.setScene(state, content);
  scene.setDebugView(view);
  scene.render(0);
  return framebuffer;
}

const isGrey = (pixel: number): boolean => {
  const r = pixel & 0xff;
  const g = (pixel >> 8) & 0xff;
  const b = (pixel >> 16) & 0xff;
  return r === g && g === b;
};

describe('rotationColor', () => {
  it('vergibt rot, gruen, blau und gelb', () => {
    // Kanaele einzeln, damit die Reihenfolge im Wort festgeschrieben ist.
    const channels = (pixel: number) => [pixel & 0xff, (pixel >> 8) & 0xff, (pixel >> 16) & 0xff];
    expect(channels(rotationColor(0))).toEqual([220, 40, 40]);
    expect(channels(rotationColor(1))).toEqual([40, 200, 60]);
    expect(channels(rotationColor(2))).toEqual([60, 90, 230]);
    expect(channels(rotationColor(3))).toEqual([230, 210, 60]);
  });

  it('liefert vier unterscheidbare Farben', () => {
    const all = new Set([rotationColor(0), rotationColor(1), rotationColor(2), rotationColor(3)]);
    expect(all.size).toBe(4);
  });
});

describe('greyPixel', () => {
  it('bildet 0 bis 1 auf Schwarz bis Weiss ab', () => {
    expect(greyPixel(0)).toBe(0xff000000);
    expect(greyPixel(1)).toBe(0xffffffff);
    expect(isGrey(greyPixel(0.5))).toBe(true);
  });

  it('klemmt Werte ausserhalb des Bereichs', () => {
    expect(greyPixel(-1)).toBe(0xff000000);
    expect(greyPixel(5)).toBe(0xffffffff);
  });
});

describe('Helligkeitsansicht (F7)', () => {
  it('zeichnet Wand, Boden und Decke als Graustufe', () => {
    const framebuffer = renderDev('light');
    const at = (x: number, y: number): number => framebuffer.pixels[y * WIDTH + x] ?? 0;

    expect(isGrey(at(160, 100))).toBe(true); // Wand auf Augenhoehe
    expect(isGrey(at(20, 101))).toBe(true); // Boden knapp unter dem Horizont
    expect(isGrey(at(20, 20))).toBe(true); // Decke
  });

  it('unterscheidet sich vom Normalbild', () => {
    const normal = renderDev('off');
    const light = renderDev('light');
    expect(light.pixels[100 * WIDTH + 160]).not.toBe(normal.pixels[100 * WIDTH + 160]);
  });

  it('bildet naeher am Spieler heller ab als weiter weg', () => {
    const framebuffer = renderDev('light');
    const near = (framebuffer.pixels[199 * WIDTH + 20] ?? 0) & 0xff;
    const far = (framebuffer.pixels[101 * WIDTH + 20] ?? 0) & 0xff;
    expect(near).toBeGreaterThan(far);
  });
});

describe('Drehungsansicht (F8)', () => {
  it('faerbt Bodenkacheln nach ihrer Drehung', () => {
    const framebuffer = renderDev('rotation');
    const palette = new Set([
      rotationColor(0),
      rotationColor(1),
      rotationColor(2),
      rotationColor(3),
    ]);

    // Unterster Bildstreifen links neben der Waffenansicht: dort liegt sicher
    // Boden, Waende reichen bei dieser Entfernung nicht so weit herunter.
    let floorPixels = 0;
    for (let y = HEIGHT - 10; y < HEIGHT; y++) {
      for (let x = 0; x < 60; x++) {
        const pixel = framebuffer.pixels[y * WIDTH + x] ?? 0;
        if (pixel === 0xff000000) continue; // ausserhalb der Karte
        expect(palette.has(pixel)).toBe(true);
        floorPixels++;
      }
    }
    expect(floorPixels).toBeGreaterThan(0);
  });

  it('zeigt in der Entwicklungskarte mehr als eine Drehung', () => {
    const framebuffer = renderDev('rotation');
    const seen = new Set<number>();
    for (let i = 0; i < framebuffer.pixels.length; i++) {
      const pixel = framebuffer.pixels[i] ?? 0;
      for (const rotation of [0, 1, 2, 3] as const) {
        if (pixel === rotationColor(rotation)) seen.add(rotation);
      }
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('laesst die Decke texturiert, faerbt nur den Boden', () => {
    const framebuffer = renderDev('rotation');
    const palette = new Set([
      rotationColor(0),
      rotationColor(1),
      rotationColor(2),
      rotationColor(3),
    ]);
    let ceilingInPalette = 0;
    for (let y = 0; y < HEIGHT / 2 - 2; y++) {
      for (let x = 0; x < 40; x++) {
        if (palette.has(framebuffer.pixels[y * WIDTH + x] ?? 0)) ceilingInPalette++;
      }
    }
    expect(ceilingInPalette).toBe(0);
  });
});

describe('Umschaltung', () => {
  it('startet aus und merkt sich die gewaehlte Ansicht', () => {
    const scene = new SceneRenderer(new Framebuffer(8, 8), createPlaceholderAssets([], []));
    expect(scene.debugView()).toBe('off');
    scene.setDebugView('light');
    expect(scene.debugView()).toBe('light');
    scene.setDebugView('off');
    expect(scene.debugView()).toBe('off');
  });

  it('meldet F7 und F8 ueber den Debug-Callback, nicht als Command', () => {
    const target = new EventTarget();
    const views: string[] = [];
    const commands: unknown[] = [];
    attachKeyboard(target, {
      onCommand: (cmd) => commands.push(cmd),
      onToggleDebug: (view) => views.push(view),
    });

    for (const key of ['F7', 'F8']) {
      const event = new Event('keydown', { cancelable: true });
      Object.assign(event, { key, repeat: false });
      target.dispatchEvent(event);
    }

    expect(views).toEqual(['light', 'rotation']);
    expect(commands).toEqual([]);
  });

  it('ignoriert F7 und F8 ohne Callback', () => {
    const target = new EventTarget();
    const onCommand = vi.fn();
    attachKeyboard(target, { onCommand });
    const event = new Event('keydown', { cancelable: true });
    Object.assign(event, { key: 'F7', repeat: false });
    target.dispatchEvent(event);
    expect(onCommand).not.toHaveBeenCalled();
  });
});
