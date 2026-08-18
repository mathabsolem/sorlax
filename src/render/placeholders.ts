/**
 * Prozedurale Platzhaltergrafik als PixelSurface. Ersetzt die PNG-Assets,
 * solange keine echten Bilder vorliegen. Umschaltung ueber USE_PLACEHOLDERS.
 *
 * Pixelformat 0xAABBGGRR, Alpha 0 bedeutet transparent.
 */
import { encodeTile } from '../core/tiles';
import type { AssetBundle, PixelSurface } from '../core/types';

/** Solange true, baut der Bootstrap seine Assets aus diesem Modul. */
export const USE_PLACEHOLDERS = true;

export const TEXTURE_SIZE = 64;

/** Textur-Ids der Platzhalter. Karten verweisen ueber encodeTile auf sie. */
export const TEX_WALL_RUST = 1;
export const TEX_WALL_ROCK = 2;
export const TEX_WALL_PANEL = 3;
export const TEX_DOOR = 4;
export const TEX_FLOOR_PLATE = 10;
export const TEX_FLOOR_ROCK = 11;
export const TEX_CEILING = 20;

/** Fertig kodierter Wandwert einer Tuer, vom Renderer in die Karte gelegt. */
export const DOOR_TILE_VALUE = encodeTile(TEX_DOOR, 0);

function rgb(r: number, g: number, b: number): number {
  return ((0xff << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

function surface(width: number, height: number): PixelSurface {
  return { width, height, pixels: new Uint32Array(width * height) };
}

/** Deterministisches Rauschen, damit die Platzhalter bei jedem Start gleich aussehen. */
function noise(x: number, y: number): number {
  const h = Math.imul(x * 374761393 + y * 668265263, 1274126177);
  return ((h ^ (h >>> 13)) >>> 0) / 0xffffffff;
}

function wallTexture(base: [number, number, number], blockHeight: number): PixelSurface {
  const out = surface(TEXTURE_SIZE, TEXTURE_SIZE);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    const row = Math.floor(y / blockHeight);
    const offset = (row % 2) * (TEXTURE_SIZE / 4);
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const onGrout =
        y % blockHeight === 0 || Math.floor((x + offset) % (TEXTURE_SIZE / 2)) === 0;
      const shade = 0.75 + noise(x, y) * 0.3;
      const factor = onGrout ? 0.45 : shade;
      out.pixels[y * TEXTURE_SIZE + x] = rgb(
        Math.min(255, Math.round(base[0] * factor)),
        Math.min(255, Math.round(base[1] * factor)),
        Math.min(255, Math.round(base[2] * factor))
      );
    }
  }
  return out;
}

/** Boden mit deutlichem Pfeil nach oben, damit gedrehte Kacheln sichtbar werden. */
function floorTexture(base: [number, number, number], accent: [number, number, number]): PixelSurface {
  const out = surface(TEXTURE_SIZE, TEXTURE_SIZE);
  const mid = TEXTURE_SIZE / 2;
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const shade = 0.8 + noise(x + 91, y + 17) * 0.25;
      let color: [number, number, number] = base;
      const inHead = y >= 12 && y <= 30 && Math.abs(x - mid) <= (y - 8) * 0.6;
      const inShaft = y > 30 && y <= 52 && Math.abs(x - mid) <= 5;
      if (inHead || inShaft) color = accent;
      const edge = x === 0 || y === 0 || x === TEXTURE_SIZE - 1 || y === TEXTURE_SIZE - 1;
      const factor = edge ? 0.5 : shade;
      out.pixels[y * TEXTURE_SIZE + x] = rgb(
        Math.min(255, Math.round(color[0] * factor)),
        Math.min(255, Math.round(color[1] * factor)),
        Math.min(255, Math.round(color[2] * factor))
      );
    }
  }
  return out;
}

/** Decke mit hellem Feld in der Mitte als Lampenersatz. */
function ceilingTexture(): PixelSurface {
  const out = surface(TEXTURE_SIZE, TEXTURE_SIZE);
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const inPanel = x >= 22 && x < 42 && y >= 22 && y < 42;
      const shade = 0.7 + noise(x + 5, y + 31) * 0.2;
      out.pixels[y * TEXTURE_SIZE + x] = inPanel
        ? rgb(230, 224, 190)
        : rgb(
            Math.round(56 * shade),
            Math.round(58 * shade),
            Math.round(66 * shade)
          );
    }
  }
  return out;
}

/** 3 x 5 Bitmapfont, reicht fuer das Kuerzel auf den Sprite-Platzhaltern. */
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '101111111111101', O: '010101101101010', P: '110101110100100',
  Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111',
  '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111',
  '6': '111100111101111', '7': '111001001001001', '8': '111101111101111', '9': '111101111001111',
};

function drawGlyph(out: PixelSurface, glyph: string, originX: number, originY: number, scale: number, color: number): void {
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (glyph[row * 3 + col] !== '1') continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = originX + col * scale + dx;
          const y = originY + row * scale + dy;
          if (x < 0 || y < 0 || x >= out.width || y >= out.height) continue;
          out.pixels[y * out.width + x] = color;
        }
      }
    }
  }
}

/** Farbe aus dem Namen ableiten, damit jeder defId sein eigenes Rechteck bekommt. */
function colorFor(name: string): number {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) hash = Math.imul(hash ^ name.charCodeAt(i), 16777619);
  const r = 90 + ((hash >>> 0) % 140);
  const g = 90 + ((hash >>> 8) % 140);
  const b = 90 + ((hash >>> 16) % 140);
  return rgb(r, g, b);
}

/** Farbiges Rechteck mit zweistelligem Kuerzel, transparent umrandet. */
export function makeSpritePlaceholder(name: string): PixelSurface {
  const out = surface(TEXTURE_SIZE, TEXTURE_SIZE);
  const body = colorFor(name);
  for (let y = 10; y < TEXTURE_SIZE - 2; y++) {
    for (let x = 14; x < TEXTURE_SIZE - 14; x++) {
      const edge = y === 10 || y === TEXTURE_SIZE - 3 || x === 14 || x === TEXTURE_SIZE - 15;
      out.pixels[y * TEXTURE_SIZE + x] = edge ? rgb(20, 20, 24) : body;
    }
  }
  const label = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2).padEnd(2, ' ');
  const scale = 5;
  let cursor = 32 - (2 * 3 * scale + scale) / 2;
  for (const char of label) {
    const glyph = FONT[char];
    if (glyph !== undefined) drawGlyph(out, glyph, cursor, 24, scale, rgb(16, 14, 14));
    cursor += 3 * scale + scale;
  }
  return out;
}

/** Sehr einfache Waffenansicht: ein Block unten in der Mitte. */
export function makeWeaponPlaceholder(name: string): PixelSurface {
  const out = surface(160, 100);
  const body = colorFor(name);
  for (let y = 30; y < 100; y++) {
    for (let x = 60; x < 100; x++) {
      const edge = y === 30 || x === 60 || x === 99;
      out.pixels[y * 160 + x] = edge ? rgb(18, 18, 22) : body;
    }
  }
  return out;
}

/** Vollstaendiges AssetBundle aus Platzhaltern. */
export function createPlaceholderAssets(spriteNames: string[], weaponNames: string[]): AssetBundle {
  const textures: Record<number, PixelSurface> = {
    [TEX_WALL_RUST]: wallTexture([148, 96, 62], 16),
    [TEX_WALL_ROCK]: wallTexture([96, 104, 112], 22),
    [TEX_WALL_PANEL]: wallTexture([74, 92, 110], 12),
    [TEX_DOOR]: wallTexture([176, 150, 70], 32),
    [TEX_FLOOR_PLATE]: floorTexture([84, 84, 92], [188, 168, 96]),
    [TEX_FLOOR_ROCK]: floorTexture([70, 62, 58], [128, 104, 88]),
    [TEX_CEILING]: ceilingTexture(),
  };

  const sprites: Record<string, PixelSurface> = {};
  for (const name of spriteNames) sprites[name] = makeSpritePlaceholder(name);

  const weaponSprites: Record<string, PixelSurface> = {};
  for (const name of weaponNames) weaponSprites[name] = makeWeaponPlaceholder(name);

  return { textures, sprites, weaponSprites, ui: {}, sounds: {} };
}
