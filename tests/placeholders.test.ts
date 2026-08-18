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
  USE_PLACEHOLDERS,
  createPlaceholderAssets,
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

  it('faerbt verschiedene Namen verschieden ein', () => {
    const a = makeSpritePlaceholder('grubling');
    const b = makeSpritePlaceholder('sentry');
    expect(a.pixels).not.toEqual(b.pixels);
  });

  it('liefert die Waffenansicht in 160 x 100', () => {
    const weapon = makeWeaponPlaceholder('bolter');
    expect(weapon.width).toBe(160);
    expect(weapon.height).toBe(100);
    expect(weapon.pixels.length).toBe(16000);
  });
});
