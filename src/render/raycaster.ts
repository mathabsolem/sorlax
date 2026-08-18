/**
 * DDA-Raycaster nach docs/tasks/PHASE_3.md. Eine Ray pro Bildspalte.
 * Zeichnet die Waende in den Pixelpuffer und fuellt dabei den zBuffer.
 */
import { rotationOf, textureIdOf } from '../core/tiles';
import type { PixelSurface } from '../core/types';
import { rayDirection } from './camera';
import type { Camera } from './camera';
import { NORTH_SOUTH_FACTOR, brightnessToLevel, computeBrightness, shadePixel } from './shading';
import { sampleTexture } from './texture';
import type { RenderMap } from './renderMap';

/** Seite 0: Wand in der Ebene x = const, also eine Nordsuedwand. */
export const SIDE_NORTH_SOUTH = 0;
/** Seite 1: Wand in der Ebene y = const, also eine Ostwestwand. */
export const SIDE_EAST_WEST = 1;

export type RayHit = {
  hit: boolean;
  perpDist: number;
  side: 0 | 1;
  wallValue: number;
  wallX: number; // Trefferpunkt auf der Wandbreite, 0 bis 1
  lightIndex: number; // letzte begehbare Kachel vor dem Treffer
};

const MISS: RayHit = {
  hit: false,
  perpDist: Number.POSITIVE_INFINITY,
  side: 0,
  wallValue: 0,
  wallX: 0,
  lightIndex: 0,
};

/**
 * Schiesst eine Ray durch das Kachelraster. Die zurueckgegebene Distanz ist die
 * perpendikulare Distanz zur Bildebene, damit entfaellt der Fischaugeneffekt.
 */
export function castRay(
  map: RenderMap,
  posX: number,
  posY: number,
  dirX: number,
  dirY: number,
  maxSteps = 128
): RayHit {
  let mapX = Math.floor(posX);
  let mapY = Math.floor(posY);

  const deltaDistX = dirX === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dirX);
  const deltaDistY = dirY === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dirY);

  const stepX = dirX < 0 ? -1 : 1;
  const stepY = dirY < 0 ? -1 : 1;
  let sideDistX = dirX < 0 ? (posX - mapX) * deltaDistX : (mapX + 1 - posX) * deltaDistX;
  let sideDistY = dirY < 0 ? (posY - mapY) * deltaDistY : (mapY + 1 - posY) * deltaDistY;

  let lightIndex = mapY * map.width + mapX;

  for (let step = 0; step < maxSteps; step++) {
    let side: 0 | 1;
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = SIDE_NORTH_SOUTH;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = SIDE_EAST_WEST;
    }

    if (mapX < 0 || mapY < 0 || mapX >= map.width || mapY >= map.height) return MISS;

    const index = mapY * map.width + mapX;
    const wallValue = map.walls[index] ?? 0;
    if (wallValue !== 0) {
      const perpDist =
        side === SIDE_NORTH_SOUTH ? sideDistX - deltaDistX : sideDistY - deltaDistY;
      const raw = side === SIDE_NORTH_SOUTH ? posY + perpDist * dirY : posX + perpDist * dirX;
      return { hit: true, perpDist, side, wallValue, wallX: raw - Math.floor(raw), lightIndex };
    }
    lightIndex = index;
  }

  return MISS;
}

/**
 * Zeichnet alle Wandspalten und schreibt die perpendikulare Distanz je Spalte
 * in den zBuffer, damit Sprites spaeter dagegen geprueft werden koennen.
 */
export function drawWalls(
  target: Uint32Array,
  screenWidth: number,
  screenHeight: number,
  camera: Camera,
  map: RenderMap,
  textures: Record<number, PixelSurface>,
  lut: Uint8Array,
  zBuffer: Float32Array
): void {
  const halfHeight = screenHeight / 2;

  for (let column = 0; column < screenWidth; column++) {
    const ray = rayDirection(camera, column, screenWidth);
    const hit = castRay(map, camera.x, camera.y, ray.x, ray.y);
    zBuffer[column] = hit.perpDist;
    if (!hit.hit) continue;

    const texture = textures[textureIdOf(hit.wallValue)];
    if (texture === undefined) continue;
    const rotation = rotationOf(hit.wallValue);
    const texSize = texture.width;

    const lineHeight = screenHeight / hit.perpDist;
    const drawStart = Math.max(0, Math.floor(halfHeight - lineHeight / 2));
    const drawEnd = Math.min(screenHeight, Math.ceil(halfHeight + lineHeight / 2));

    let texX = Math.floor(hit.wallX * texSize);
    if (hit.side === SIDE_NORTH_SOUTH && ray.x > 0) texX = texSize - texX - 1;
    if (hit.side === SIDE_EAST_WEST && ray.y < 0) texX = texSize - texX - 1;

    let brightness = computeBrightness(
      map.light[hit.lightIndex] ?? 0,
      hit.perpDist,
      map.ambientLight
    );
    if (hit.side === SIDE_NORTH_SOUTH) brightness *= NORTH_SOUTH_FACTOR;
    const level = brightnessToLevel(brightness);

    const texStep = texSize / lineHeight;
    let texPos = (drawStart - halfHeight + lineHeight / 2) * texStep;

    for (let y = drawStart; y < drawEnd; y++) {
      const texY = Math.min(texSize - 1, Math.max(0, Math.floor(texPos)));
      texPos += texStep;
      target[y * screenWidth + column] = shadePixel(
        lut,
        sampleTexture(texture, texX, texY, rotation),
        level
      );
    }
  }
}
