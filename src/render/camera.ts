/**
 * Kamera des Raycasters. Der Spielzustand kennt nur ganze Kacheln und vier
 * Richtungen, die Kamera haelt die interpolierten Float-Werte (SPEC 3.1).
 */
import type { Facing } from '../core/types';

/** Sichtfeld 66 Grad, daraus die Laenge des Bildebenenvektors. */
export const FOV_RADIANS = (66 * Math.PI) / 180;
export const PLANE_LENGTH = Math.tan(FOV_RADIANS / 2);

export type Camera = {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  planeX: number;
  planeY: number;
};

/** Blickrichtung als Winkel. 0 = Nord zeigt nach -y, deshalb der Versatz. */
export function facingToAngle(facing: Facing): number {
  return (facing - 1) * (Math.PI / 2);
}

/** Kamera aus Weltposition und Winkel. Die Bildebene steht senkrecht auf der Blickrichtung. */
export function makeCamera(x: number, y: number, angle: number): Camera {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  return {
    x,
    y,
    dirX,
    dirY,
    planeX: -dirY * PLANE_LENGTH,
    planeY: dirX * PLANE_LENGTH,
  };
}

/** Richtungsvektor der Ray fuer Bildspalte `column`. */
export function rayDirection(
  camera: Camera,
  column: number,
  screenWidth: number
): { x: number; y: number } {
  const cameraX = (2 * column) / screenWidth - 1;
  return {
    x: camera.dirX + camera.planeX * cameraX,
    y: camera.dirY + camera.planeY * cameraX,
  };
}
