/**
 * Billboards fuer Gegner, Items und Dekoration. Spaltenweise gegen den zBuffer
 * geprueft, Alpha 0 wird uebersprungen, kein Blending.
 */
import type { EntityId, PixelSurface } from '../core/types';
import type { Camera } from './camera';
import { brightnessToLevel, computeBrightness, shadePixel } from './shading';
import type { RenderMap } from './renderMap';

/** Standardbreite eines Sprites in Kacheln, falls die Definition keine nennt. */
export const DEFAULT_SPRITE_WIDTH = 0.8;

/** Naeher als das wird ein Sprite verworfen, sonst wird es unendlich gross. */
export const MIN_SPRITE_DISTANCE = 0.2;

export type Billboard = {
  id: EntityId | null; // null bei Leichen, die nicht mehr im Zustand stehen
  x: number;
  y: number;
  widthTiles: number;
  surface: PixelSurface;
};

export type SpriteRect = { id: EntityId; x0: number; y0: number; x1: number; y1: number };

/**
 * Zeichnet alle Billboards von weit nach nah und liefert die Bildschirmrechtecke
 * der gezeichneten Gegner fuer `pickEntityAt`.
 */
export function drawSprites(
  target: Uint32Array,
  screenWidth: number,
  screenHeight: number,
  camera: Camera,
  map: RenderMap,
  billboards: Billboard[],
  lut: Uint8Array,
  zBuffer: Float32Array
): SpriteRect[] {
  const invDet = 1 / (camera.planeX * camera.dirY - camera.dirX * camera.planeY);
  const halfWidth = screenWidth / 2;
  const halfHeight = screenHeight / 2;
  const rects: SpriteRect[] = [];

  const ordered = billboards
    .map((billboard) => {
      const relX = billboard.x - camera.x;
      const relY = billboard.y - camera.y;
      return {
        billboard,
        transformX: invDet * (camera.dirY * relX - camera.dirX * relY),
        depth: invDet * (-camera.planeY * relX + camera.planeX * relY),
      };
    })
    .filter((entry) => entry.depth >= MIN_SPRITE_DISTANCE)
    .sort((a, b) => b.depth - a.depth);

  for (const entry of ordered) {
    const { billboard, depth } = entry;
    const surface = billboard.surface;
    const scale = screenHeight / depth;
    const spriteHeight = Math.abs(scale);
    const spriteWidth = Math.abs(scale * billboard.widthTiles);
    const screenX = halfWidth * (1 + entry.transformX / depth);

    const floorY = halfHeight + scale / 2;
    const topY = floorY - spriteHeight;
    const leftX = screenX - spriteWidth / 2;

    const startX = Math.max(0, Math.floor(leftX));
    const endX = Math.min(screenWidth, Math.ceil(leftX + spriteWidth));
    const startY = Math.max(0, Math.floor(topY));
    const endY = Math.min(screenHeight, Math.ceil(floorY));
    if (startX >= endX || startY >= endY) continue;

    const cellX = Math.floor(billboard.x);
    const cellY = Math.floor(billboard.y);
    const inside = cellX >= 0 && cellY >= 0 && cellX < map.width && cellY < map.height;
    const light = inside ? (map.light[cellY * map.width + cellX] ?? 0) : 0;
    const level = brightnessToLevel(computeBrightness(light, depth, map.ambientLight));

    let drawn = false;
    for (let x = startX; x < endX; x++) {
      if (depth >= (zBuffer[x] ?? Number.POSITIVE_INFINITY)) continue;
      const texX = Math.floor(((x - leftX) * surface.width) / spriteWidth);
      if (texX < 0 || texX >= surface.width) continue;

      for (let y = startY; y < endY; y++) {
        const texY = Math.floor(((y - topY) * surface.height) / spriteHeight);
        if (texY < 0 || texY >= surface.height) continue;
        const pixel = surface.pixels[texY * surface.width + texX] ?? 0;
        if (pixel >>> 24 === 0) continue;
        target[y * screenWidth + x] = shadePixel(lut, pixel, level);
        drawn = true;
      }
    }

    if (drawn && billboard.id !== null) {
      rects.push({ id: billboard.id, x0: startX, y0: startY, x1: endX, y1: endY });
    }
  }

  return rects;
}
