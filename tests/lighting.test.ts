import { describe, expect, it } from 'vitest';
import { generateLightMap } from '../src/core/lighting';
import type { LampDef } from '../src/core/types';

/** 9 x 1 offener Gang, damit die Distanz genau der Schrittzahl entspricht. */
function corridor(length: number): number[] {
  return new Array<number>(length).fill(0);
}

describe('generateLightMap', () => {
  // Test 7 aus PHASE_3
  it('setzt am Ursprung den vollen Wert und faellt bis zum Radius auf 0', () => {
    const lamps: LampDef[] = [{ pos: { x: 0, y: 0 }, radius: 4, intensity: 200 }];
    const light = generateLightMap(9, 1, corridor(9), lamps);

    expect(light[0]).toBe(200);
    expect(light[1]).toBe(150);
    expect(light[2]).toBe(100);
    expect(light[3]).toBe(50);
    expect(light[4]).toBe(0);
    expect(light[5]).toBe(0);
  });

  it('kommt nicht hinter eine Wand', () => {
    const walls = corridor(9);
    walls[2] = 1;
    const light = generateLightMap(9, 1, walls, [
      { pos: { x: 0, y: 0 }, radius: 4, intensity: 200 },
    ]);

    expect(light[1]).toBe(150);
    expect(light[2]).toBe(0); // die Wand selbst bleibt dunkel
    expect(light[3]).toBe(0);
    expect(light[4]).toBe(0);
  });

  // Test 8 aus PHASE_3
  it('kombiniert zwei ueberlappende Lampen per Maximum, nicht per Summe', () => {
    const lamps: LampDef[] = [
      { pos: { x: 0, y: 0 }, radius: 4, intensity: 200 },
      { pos: { x: 4, y: 0 }, radius: 4, intensity: 200 },
    ];
    const light = generateLightMap(9, 1, corridor(9), lamps);

    expect(light[0]).toBe(200);
    expect(light[4]).toBe(200);
    // Kachel 2 liegt bei beiden auf Distanz 2, das Maximum ist 100, nicht 200.
    expect(light[2]).toBe(100);
    expect(light[3]).toBe(150); // Distanz 3 links (50), Distanz 1 rechts (150)
  });

  it('liefert ohne Lampen eine dunkle Karte', () => {
    expect(generateLightMap(3, 2, corridor(6), [])).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('ignoriert Lampen ausserhalb der Karte, unter Waenden und ohne Radius', () => {
    const walls = corridor(4);
    walls[1] = 1;
    const light = generateLightMap(4, 1, walls, [
      { pos: { x: 9, y: 0 }, radius: 3, intensity: 255 },
      { pos: { x: 1, y: 0 }, radius: 3, intensity: 255 },
      { pos: { x: 0, y: 0 }, radius: 0, intensity: 255 },
    ]);
    expect(light).toEqual([0, 0, 0, 0]);
  });

  it('breitet sich um Ecken aus, nicht durch sie hindurch', () => {
    // 3 x 3, Mitte frei, Ecke oben rechts durch eine Wand getrennt.
    const walls = [0, 1, 0, 0, 0, 0, 0, 0, 0];
    const light = generateLightMap(3, 3, walls, [
      { pos: { x: 0, y: 0 }, radius: 5, intensity: 100 },
    ]);
    expect(light[0]).toBe(100);
    expect(light[1]).toBe(0); // Wand
    expect(light[2]).toBe(20); // nur ueber unten herum erreichbar, Distanz 4
  });
});
