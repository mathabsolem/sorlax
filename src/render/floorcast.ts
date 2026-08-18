/**
 * Boden und Decke in einer gemeinsamen Schleife. Die Decke ist das Spiegelbild
 * des Bodens, deshalb reicht eine Zeilenrechnung fuer beide.
 *
 * Zeilenkohaerenz: eine Division pro Bildzeile, danach zwei Additionen pro Pixel.
 */
import { rotationOf, textureIdOf } from '../core/tiles';
import type { PixelSurface } from '../core/types';
import type { Camera } from './camera';
import { brightnessToLevel, computeBrightness, shadePixel } from './shading';
import { sampleTexture } from './texture';
import type { RenderMap } from './renderMap';

/**
 * Weltdistanz der Bildzeile `y`. Die Kamera sitzt auf halber Wandhoehe,
 * deshalb posZ = 0.5 * screenHeight.
 */
export function rowDistance(y: number, screenHeight: number): number {
  const p = y - screenHeight / 2;
  return (0.5 * screenHeight) / p;
}

function blit(
  target: Uint32Array,
  offset: number,
  value: number,
  textures: Record<number, PixelSurface>,
  fracX: number,
  fracY: number,
  lut: Uint8Array,
  level: number
): void {
  const texture = textures[textureIdOf(value)];
  if (texture === undefined) return;
  const size = texture.width;
  const u = Math.min(size - 1, Math.floor(fracX * size));
  const v = Math.min(size - 1, Math.floor(fracY * size));
  target[offset] = shadePixel(lut, sampleTexture(texture, u, v, rotationOf(value)), level);
}

export function drawFloorAndCeiling(
  target: Uint32Array,
  screenWidth: number,
  screenHeight: number,
  camera: Camera,
  map: RenderMap,
  textures: Record<number, PixelSurface>,
  lut: Uint8Array
): void {
  const leftX = camera.dirX - camera.planeX;
  const leftY = camera.dirY - camera.planeY;
  const rightX = camera.dirX + camera.planeX;
  const rightY = camera.dirY + camera.planeY;

  for (let y = Math.floor(screenHeight / 2) + 1; y < screenHeight; y++) {
    const distance = rowDistance(y, screenHeight);
    if (!Number.isFinite(distance) || distance <= 0) continue;

    const stepX = (distance * (rightX - leftX)) / screenWidth;
    const stepY = (distance * (rightY - leftY)) / screenWidth;
    let worldX = camera.x + distance * leftX;
    let worldY = camera.y + distance * leftY;

    const floorRow = y * screenWidth;
    const ceilingRow = (screenHeight - y - 1) * screenWidth;

    for (let x = 0; x < screenWidth; x++) {
      const cellX = Math.floor(worldX);
      const cellY = Math.floor(worldY);
      const fracX = worldX - cellX;
      const fracY = worldY - cellY;
      worldX += stepX;
      worldY += stepY;
      if (cellX < 0 || cellY < 0 || cellX >= map.width || cellY >= map.height) continue;

      const index = cellY * map.width + cellX;
      const level = brightnessToLevel(
        computeBrightness(map.light[index] ?? 0, distance, map.ambientLight)
      );

      blit(target, floorRow + x, map.floors[index] ?? 0, textures, fracX, fracY, lut, level);
      blit(target, ceilingRow + x, map.ceilings[index] ?? 0, textures, fracX, fracY, lut, level);
    }
  }
}
