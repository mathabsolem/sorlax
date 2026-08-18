import { describe, expect, it } from 'vitest';
import {
  MAX_VIEW_DIST,
  MIN_BRIGHTNESS,
  PLAYER_LIGHT_RANGE,
  PLAYER_LIGHT_STRENGTH,
  SHADE_LEVELS,
  brightnessToLevel,
  buildShadeLut,
  computeBrightness,
  shadePixel,
} from '../src/render/shading';

const lut = buildShadeLut();

describe('buildShadeLut', () => {
  it('hat die Groesse LEVELS mal 256 und die Randstufen stimmen', () => {
    expect(lut.length).toBe(SHADE_LEVELS * 256);
    expect(lut[0 * 256 + 255]).toBe(0);
    expect(lut[(SHADE_LEVELS - 1) * 256 + 255]).toBe(255);
    expect(lut[(SHADE_LEVELS - 1) * 256 + 100]).toBe(100);
  });

  it('rundet nach der Formel value * level / (LEVELS - 1)', () => {
    expect(lut[16 * 256 + 200]).toBe(Math.round((200 * 16) / 31));
  });
});

describe('computeBrightness', () => {
  it('folgt der Formel aus SPEC Abschnitt 7', () => {
    // light 255, dist 8, ambient 1 -> 1 * 1 * 0.5 + 0 = 0.5
    expect(computeBrightness(255, 8, 1)).toBeCloseTo(0.5, 10);
  });

  it('hellt den Nahbereich auch in vollstaendig dunklen Kacheln auf', () => {
    // staticLight 0, dist 2 -> nur playerLight 0.35 * (1 - 2/4) = 0.175
    expect(computeBrightness(0, 2, 1)).toBeCloseTo(0.175, 10);
    // ausserhalb der Nahbereichsreichweite bleibt nur das Minimum
    expect(computeBrightness(0, 6, 1)).toBe(MIN_BRIGHTNESS);
  });

  it('klemmt die Summe aus Grundlicht und Nahbereich auf 1', () => {
    // 0.875 + 0.175 waere 1.05
    expect(computeBrightness(255, 2, 1)).toBe(1);
  });

  it('faellt nie unter das Minimum und nie ueber 1', () => {
    expect(computeBrightness(0, MAX_VIEW_DIST + 5, 1)).toBe(MIN_BRIGHTNESS);
    expect(computeBrightness(255, 0, 1)).toBe(1);
  });

  it('skaliert mit dem Umgebungslicht der Karte', () => {
    expect(computeBrightness(255, 8, 0.5)).toBeLessThan(computeBrightness(255, 8, 1));
  });

  it('nutzt die Konstanten der Nahbereichsaufhellung aus SPEC 7', () => {
    expect(PLAYER_LIGHT_RANGE).toBe(4);
    expect(PLAYER_LIGHT_STRENGTH).toBeCloseTo(0.35, 10);
    expect(computeBrightness(0, 0, 1)).toBeCloseTo(PLAYER_LIGHT_STRENGTH, 10);
    expect(computeBrightness(0, PLAYER_LIGHT_RANGE, 1)).toBe(MIN_BRIGHTNESS);
  });
});

describe('brightnessToLevel', () => {
  it('bildet 0 bis 1 auf 0 bis 31 ab', () => {
    expect(brightnessToLevel(0)).toBe(0);
    expect(brightnessToLevel(1)).toBe(SHADE_LEVELS - 1);
    expect(brightnessToLevel(0.5)).toBe(Math.round(0.5 * 31));
  });

  it('klemmt Werte ausserhalb des Bereichs', () => {
    expect(brightnessToLevel(-3)).toBe(0);
    expect(brightnessToLevel(9)).toBe(SHADE_LEVELS - 1);
  });
});

describe('shadePixel', () => {
  it('laesst die volle Stufe unveraendert und setzt Alpha auf 255', () => {
    const pixel = (0x00204060 | 0) >>> 0;
    expect(shadePixel(lut, pixel, SHADE_LEVELS - 1)).toBe(0xff204060);
  });

  it('macht Stufe 0 schwarz', () => {
    expect(shadePixel(lut, 0xffffffff, 0)).toBe(0xff000000);
  });

  it('dunkelt jeden Kanal einzeln ab', () => {
    const shaded = shadePixel(lut, 0xff0000ff, 16); // reines Rot
    expect(shaded & 0xff).toBe(Math.round((255 * 16) / 31));
    expect((shaded >> 8) & 0xff).toBe(0);
  });
});
