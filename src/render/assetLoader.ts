/**
 * Echter Asset-Loader. Dekodiert PNG per createImageBitmap und einen temporaeren
 * Canvas nach Uint32Array, weil der Renderer auf rohen Pixeln arbeitet.
 *
 * Dateikonvention nach INTERFACES v1.1 Abschnitt 7.
 */
import type { AssetBundle, PixelSurface } from '../core/types';

export type AssetManifest = {
  textureIds: number[];
  spriteNames: string[];
  weaponNames: string[];
  uiNames: string[];
};

/** Laedt ein PNG und gibt seine Pixel im Format 0xAABBGGRR zurueck. */
export async function loadSurface(url: string): Promise<PixelSurface> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`asset not found: ${url}`);
  const bitmap = await createImageBitmap(await response.blob());

  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx === null) throw new Error('2d context not available');
  ctx.drawImage(bitmap, 0, 0);
  const image = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  bitmap.close();

  return {
    width: bitmap.width,
    height: bitmap.height,
    pixels: new Uint32Array(image.data.buffer.slice(0)),
  };
}

/**
 * Laedt die Texturen, die es als Datei gibt, und ueberspringt die uebrigen.
 *
 * Solange die Grafik entsteht, liegen nur einzelne Bilder in public/assets;
 * fuer den Rest bleiben die Platzhalter stehen. Eine fehlende Datei ist
 * deshalb kein Fehler, sondern der Normalfall.
 */
export async function loadOptionalTextures(
  base: string,
  ids: readonly number[],
  /** Eingebettete Bilder als data-URI, fuer einen Aufbau aus einer Datei. */
  embedded?: Record<number, string>
): Promise<Record<number, PixelSurface>> {
  const textures: Record<number, PixelSurface> = {};
  for (const id of ids) {
    // Sind Bilder eingebettet, gibt es keinen Ordner daneben: dann wird nur
    // geladen, was wirklich dabei ist, statt ins Leere zu greifen.
    const url = embedded === undefined ? `${base}/textures/${id}.png` : embedded[id];
    if (url === undefined) continue;
    try {
      textures[id] = await loadSurface(url);
    } catch {
      // Kein Bild vorhanden: der Platzhalter bleibt.
    }
  }
  return textures;
}

/** Laedt das komplette Bundle aus public/assets. */
export async function loadAssets(base: string, manifest: AssetManifest): Promise<AssetBundle> {
  const textures: Record<number, PixelSurface> = {};
  for (const id of manifest.textureIds) {
    textures[id] = await loadSurface(`${base}/textures/${id}.png`);
  }

  const sprites: Record<string, PixelSurface> = {};
  for (const name of manifest.spriteNames) {
    sprites[name] = await loadSurface(`${base}/sprites/${name}.png`);
  }

  const weaponSprites: Record<string, PixelSurface> = {};
  for (const name of manifest.weaponNames) {
    weaponSprites[name] = await loadSurface(`${base}/weapons/${name}.png`);
  }

  const ui: Record<string, ImageBitmap> = {};
  for (const name of manifest.uiNames) {
    const response = await fetch(`${base}/ui/${name}.png`);
    if (!response.ok) throw new Error(`asset not found: ${name}`);
    ui[name] = await createImageBitmap(await response.blob());
  }

  return { textures, sprites, weaponSprites, ui, icons: {}, sounds: {} };
}
