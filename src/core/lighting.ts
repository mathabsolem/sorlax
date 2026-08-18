/**
 * Statische Lichtkarte nach SPEC v1.1 Abschnitt 7.
 *
 * Flutfuellung von jeder Lampe aus, linearer Abfall ueber den Radius, blockiert
 * durch solide Kacheln. Mehrere Lampen werden per Maximum kombiniert, nicht summiert.
 * Das Ergebnis wird beim Kartenbau erzeugt und zur Laufzeit nicht mehr veraendert.
 */
import type { LampDef } from './types';

/** Eine einzelne Lampe in die bereits vorhandene Lichtkarte einrechnen. */
function floodLamp(
  light: number[],
  walls: number[],
  width: number,
  height: number,
  lamp: LampDef
): void {
  if (lamp.radius <= 0 || lamp.intensity <= 0) return;
  const start = lamp.pos.y * width + lamp.pos.x;
  if (lamp.pos.x < 0 || lamp.pos.y < 0 || lamp.pos.x >= width || lamp.pos.y >= height) return;
  // Lampen unter einer Wand haben keine Wirkung, sie sind nicht erreichbar.
  if ((walls[start] ?? 1) !== 0) return;

  const distance = new Int32Array(width * height).fill(-1);
  distance[start] = 0;
  const queue: number[] = [start];

  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (index === undefined) continue;
    const dist = distance[index] ?? 0;

    const value = Math.round(lamp.intensity * (1 - dist / lamp.radius));
    if (value > (light[index] ?? 0)) light[index] = value;

    if (dist + 1 >= lamp.radius) continue;

    const x = index % width;
    const y = (index - x) / width;
    const neighbours = [
      x > 0 ? index - 1 : -1,
      x < width - 1 ? index + 1 : -1,
      y > 0 ? index - width : -1,
      y < height - 1 ? index + width : -1,
    ];
    for (const next of neighbours) {
      if (next < 0) continue;
      if ((distance[next] ?? -1) >= 0) continue;
      if ((walls[next] ?? 1) !== 0) continue;
      distance[next] = dist + 1;
      queue.push(next);
    }
  }
}

/**
 * Erzeugt die Lichtkarte aus den Deckenlampen. Rueckgabe ist ein neues Array der
 * Laenge width * height mit Werten von 0 bis 255.
 */
export function generateLightMap(
  width: number,
  height: number,
  walls: number[],
  lamps: LampDef[]
): number[] {
  const light = new Array<number>(width * height).fill(0);
  for (const lamp of lamps) floodLamp(light, walls, width, height, lamp);
  return light;
}
