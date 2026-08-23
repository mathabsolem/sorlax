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
export const WEAPON_WIDTH = 160;
export const WEAPON_HEIGHT = 100;

/**
 * Textur-Ids der Entwicklungsfixture. Sie liegen ueber 200 und damit ausserhalb
 * des Katalogs aus CONTENT_TABLES Abschnitt 6, der 10 bis 81 belegt. Beide
 * teilen sich eine Tabelle, eine Ueberschneidung waere eine falsche Wand.
 */
export const TEX_WALL_RUST = 200;
export const TEX_WALL_ROCK = 201;
export const TEX_WALL_PANEL = 202;
export const TEX_DOOR = 203;
export const TEX_FLOOR_PLATE = 210;
export const TEX_FLOOR_ROCK = 211;
export const TEX_CEILING = 220;

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
  // Ganzzahlig halten: ein gebrochener Index in ein Uint32Array schreibt nichts.
  const baseX = Math.round(originX);
  const baseY = Math.round(originY);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (glyph[row * 3 + col] !== '1') continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const x = baseX + col * scale + dx;
          const y = baseY + row * scale + dy;
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

/** Farbe des Kuerzels auf den Platzhaltern. */
export const LABEL_COLOR = ((0xff << 24) | (14 << 16) | (14 << 8) | 16) >>> 0;

/**
 * Zweistelliges Kuerzel aus dem Namen. Framenamen wie `grubling_idle_0` tragen
 * den defId als Praefix, daraus werden die ersten beiden Zeichen genommen.
 */
export function spriteLabel(name: string): string {
  const clean = name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return clean.slice(0, 2).padEnd(2, 'X');
}

/** Farbiges Rechteck mit zweistelligem Kuerzel, transparent umrandet. */
export function makeSpritePlaceholder(name: string): PixelSurface {
  const out = surface(TEXTURE_SIZE, TEXTURE_SIZE);
  const body = colorFor(name);
  // Quadratische Flaeche, damit am Bild ablesbar bleibt, ob ein 64 x 64 Sprite
  // auch quadratisch projiziert wird.
  const inset = 8;
  const last = TEXTURE_SIZE - inset - 1;
  for (let y = inset; y <= last; y++) {
    for (let x = inset; x <= last; x++) {
      const edge = y === inset || y === last || x === inset || x === last;
      out.pixels[y * TEXTURE_SIZE + x] = edge ? rgb(20, 20, 24) : body;
    }
  }
  const label = spriteLabel(name);
  const scale = 5;
  const glyphWidth = 3 * scale;
  const totalWidth = label.length * glyphWidth + (label.length - 1) * scale;
  let cursor = Math.round((TEXTURE_SIZE - totalWidth) / 2);
  for (const char of label) {
    const glyph = FONT[char];
    if (glyph !== undefined) drawGlyph(out, glyph, cursor, 24, scale, LABEL_COLOR);
    cursor += glyphWidth + scale;
  }
  return out;
}

/**
 * Waffenansicht im Format 160 x 100 aus INTERFACES Abschnitt 7.
 * Liegende Silhouette: breiter Koerper mit Lauf nach rechts, damit die
 * Flaeche im Bild als Querformat erkennbar bleibt.
 */
export function makeWeaponPlaceholder(name: string): PixelSurface {
  const out = surface(WEAPON_WIDTH, WEAPON_HEIGHT);
  const body = colorFor(name);
  const outline = rgb(18, 18, 22);

  const box = (x0: number, y0: number, x1: number, y1: number, fill: number): void => {
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const edge = y === y0 || y === y1 - 1 || x === x0 || x === x1 - 1;
        out.pixels[y * WEAPON_WIDTH + x] = edge ? outline : fill;
      }
    }
  };

  box(24, 52, 120, 100, body); // Koerper
  box(112, 62, 156, 80, body); // Lauf
  box(48, 78, 74, 100, outline); // Griff

  const label = spriteLabel(name);
  let cursor = 30;
  for (const char of label) {
    const glyph = FONT[char];
    if (glyph !== undefined) drawGlyph(out, glyph, cursor, 60, 4, LABEL_COLOR);
    cursor += 16;
  }
  return out;
}

/**
 * Grundfarbe je Zone, CONTENT_TABLES Abschnitt 6: Industrie, Pilzbefall,
 * Frost, Struktur. Platzhalterfarben, keine Spielwerte.
 */
const ZONE_TINT: Record<number, [number, number, number]> = {
  1: [104, 96, 88],
  2: [88, 108, 74],
  3: [98, 118, 142],
  4: [104, 84, 126],
};

function tinted(base: [number, number, number], factor: number): [number, number, number] {
  return [
    Math.min(255, Math.round(base[0] * factor)),
    Math.min(255, Math.round(base[1] * factor)),
    Math.min(255, Math.round(base[2] * factor)),
  ];
}

function zoneTint(zone: number): [number, number, number] {
  return ZONE_TINT[zone] ?? ZONE_TINT[1] ?? [104, 96, 88];
}

/**
 * Platzhalter fuer den Texturkatalog aus CONTENT_TABLES Abschnitt 6.
 * Waende 10 bis 25, Boeden 40 bis 51, Spuren 60 bis 66, Decken 70 bis 81.
 * Jede Zone bekommt ihren Farbstich, damit die Sohlen unterscheidbar bleiben.
 */
function catalogTextures(): Record<number, PixelSurface> {
  const textures: Record<number, PixelSurface> = {};

  for (let id = 10; id <= 25; id++) {
    const zone = Math.floor((id - 10) / 4) + 1;
    const variant = (id - 10) % 4;
    textures[id] = wallTexture(tinted(zoneTint(zone), 0.8 + variant * 0.15), 12 + variant * 6);
  }

  for (let id = 40; id <= 51; id++) {
    const zone = Math.floor((id - 40) / 3) + 1;
    const variant = (id - 40) % 3;
    textures[id] = floorTexture(
      tinted(zoneTint(zone), 0.6 + variant * 0.12),
      tinted(zoneTint(zone), 1.2 + variant * 0.1)
    );
  }

  // Bodenspuren. Blut ab Zone 2, Oel und Staub in Zone 1.
  const blood: [number, number, number] = [92, 26, 24];
  const dust: [number, number, number] = [126, 118, 104];
  for (const id of [60, 61, 62, 63]) textures[id] = floorTexture(blood, tinted(blood, 1.6));
  textures[64] = floorTexture([32, 30, 28], [64, 60, 54]);
  for (const id of [65, 66]) textures[id] = floorTexture(dust, tinted(dust, 1.3));

  // Decken. Die Lampe der Zone ist heller als der Rest.
  const lamps = new Set([71, 74, 77, 80]);
  for (let id = 70; id <= 81; id++) {
    textures[id] = lamps.has(id) ? ceilingTexture() : floorTexture(
      tinted(zoneTint(Math.floor((id - 70) / 3) + 1), 0.45),
      tinted(zoneTint(Math.floor((id - 70) / 3) + 1), 0.7)
    );
  }

  return textures;
}

/** Vollstaendiges AssetBundle aus Platzhaltern. */
export function createPlaceholderAssets(spriteNames: string[], weaponNames: string[]): AssetBundle {
  const textures: Record<number, PixelSurface> = {
    ...catalogTextures(),
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

  return { textures, sprites, weaponSprites, ui: {}, icons: {}, sounds: {} };
}
