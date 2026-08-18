import { describe, expect, it } from 'vitest';
import { rotationOf, textureIdOf } from '../src/core/tiles';
import {
  DOOR_TILE_VALUE,
  TEXTURE_SIZE,
  TEX_CEILING,
  TEX_DOOR,
  TEX_FLOOR_PLATE,
  TEX_FLOOR_ROCK,
  TEX_WALL_PANEL,
  TEX_WALL_ROCK,
  TEX_WALL_RUST,
  LABEL_COLOR,
  USE_PLACEHOLDERS,
  WEAPON_HEIGHT,
  WEAPON_WIDTH,
  createPlaceholderAssets,
  spriteLabel,
  makeSpritePlaceholder,
  makeWeaponPlaceholder,
} from '../src/render/placeholders';

describe('Platzhaltergrafik', () => {
  it('ist eingeschaltet, solange keine PNG vorliegen', () => {
    expect(USE_PLACEHOLDERS).toBe(true);
  });

  it('liefert alle benoetigten Texturen in 64 x 64', () => {
    const assets = createPlaceholderAssets(['grubling_idle_0'], ['bolter']);
    const ids = [
      TEX_WALL_RUST,
      TEX_WALL_ROCK,
      TEX_WALL_PANEL,
      TEX_DOOR,
      TEX_FLOOR_PLATE,
      TEX_FLOOR_ROCK,
      TEX_CEILING,
    ];
    for (const id of ids) {
      const texture = assets.textures[id];
      expect(texture).toBeDefined();
      expect(texture?.width).toBe(TEXTURE_SIZE);
      expect(texture?.pixels.length).toBe(TEXTURE_SIZE * TEXTURE_SIZE);
    }
    expect(assets.sprites['grubling_idle_0']).toBeDefined();
    expect(assets.weaponSprites['bolter']?.width).toBe(160);
    expect(assets.ui).toEqual({});
  });

  it('kodiert die Tuerkachel ueber tiles.ts', () => {
    expect(textureIdOf(DOOR_TILE_VALUE)).toBe(TEX_DOOR);
    expect(rotationOf(DOOR_TILE_VALUE)).toBe(0);
  });

  it('erzeugt Texturen deterministisch', () => {
    const first = createPlaceholderAssets([], []).textures[TEX_WALL_RUST];
    const second = createPlaceholderAssets([], []).textures[TEX_WALL_RUST];
    expect(first?.pixels).toEqual(second?.pixels);
  });

  it('gibt Sprites einen transparenten Rand und undurchsichtige Flaeche', () => {
    const sprite = makeSpritePlaceholder('grubling');
    expect(sprite.pixels[0]).toBe(0); // Ecke bleibt frei
    expect(sprite.pixels.some((pixel) => pixel >>> 24 === 0xff)).toBe(true);
  });

  it('malt die Sprite-Flaeche quadratisch', () => {
    const sprite = makeSpritePlaceholder('grubling');
    let minX = sprite.width;
    let maxX = -1;
    let minY = sprite.height;
    let maxY = -1;
    for (let y = 0; y < sprite.height; y++) {
      for (let x = 0; x < sprite.width; x++) {
        if ((sprite.pixels[y * sprite.width + x] ?? 0) >>> 24 === 0) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    expect(maxX - minX).toBe(maxY - minY);
  });

  it('traegt ein Buchstabenkuerzel des defId', () => {
    const sprite = makeSpritePlaceholder('grubling_idle_0');
    const labelPixels = [...sprite.pixels].filter((pixel) => pixel === LABEL_COLOR).length;
    expect(labelPixels).toBeGreaterThan(0);
  });

  it('leitet das Kuerzel aus dem defId-Praefix des Framenamens ab', () => {
    expect(spriteLabel('grubling_idle_0')).toBe('GR');
    expect(spriteLabel('sentry_death_1')).toBe('SE');
    expect(spriteLabel('medkit')).toBe('ME');
    expect(spriteLabel('a')).toBe('AX');
  });

  it('setzt fuer verschiedene Kuerzel verschiedene Punkte', () => {
    const positions = (name: string): string =>
      [...makeSpritePlaceholder(name).pixels]
        .map((pixel, index) => (pixel === LABEL_COLOR ? index : -1))
        .filter((index) => index >= 0)
        .join(',');
    expect(positions('grubling')).not.toBe(positions('sentry'));
  });

  it('faerbt verschiedene Namen verschieden ein', () => {
    const a = makeSpritePlaceholder('grubling');
    const b = makeSpritePlaceholder('sentry');
    expect(a.pixels).not.toEqual(b.pixels);
  });

  it('liefert die Waffenansicht im Querformat 160 x 100', () => {
    const weapon = makeWeaponPlaceholder('bolter');
    expect(weapon.width).toBe(WEAPON_WIDTH);
    expect(weapon.height).toBe(WEAPON_HEIGHT);
    expect(weapon.pixels.length).toBe(WEAPON_WIDTH * WEAPON_HEIGHT);
  });

  it('zeichnet die Waffe breiter als hoch', () => {
    const weapon = makeWeaponPlaceholder('bolter');
    let minX = weapon.width;
    let maxX = -1;
    let minY = weapon.height;
    let maxY = -1;
    for (let y = 0; y < weapon.height; y++) {
      for (let x = 0; x < weapon.width; x++) {
        if ((weapon.pixels[y * weapon.width + x] ?? 0) >>> 24 === 0) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    expect(maxX - minX).toBeGreaterThan(maxY - minY);
  });
});
