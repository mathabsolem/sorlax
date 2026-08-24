/**
 * Die Regeln aus PHASE_6_5: Schluessel je Tuer, Raumdaten, Id-Bereiche und
 * die Schleifspur der ersten Zone.
 */
import { describe, expect, it } from 'vitest';
import { contentForValidation } from '../scripts/genMaps';
import { mapIdFor } from '../scripts/mapPopulate';
import { DUST_TRACE, KNOWN_TEXTURES, OIL_STAIN } from '../scripts/mapTables';
import { validateMap } from '../scripts/validateMap';
import { loadMaps } from '../src/app/gameContent';
import * as placeholders from '../src/render/placeholders';
import { textureIdOf } from '../src/core/tiles';
import type { MapDef } from '../src/core/types';

const MAPS = loadMaps();
const DEPTHS = Array.from({ length: 16 }, (_value, index) => index + 1);

function mapOf(depth: number): MapDef {
  const map = MAPS[mapIdFor(depth)];
  if (map === undefined) throw new Error(`Sohle ${depth} fehlt`);
  return map;
}

describe('Schluessel und Tueren', () => {
  // Test 3 aus PHASE_6_5
  it('legt je verriegelter Tuer genau einen Schluessel aus', () => {
    const problems: string[] = [];
    for (const depth of DEPTHS) {
      const map = mapOf(depth);
      const locked = map.entities.filter(
        (entity) => entity.kind === 'door' && entity.locked !== undefined
      );
      const keys = map.entities.filter(
        (entity) => entity.kind === 'item' && entity.defId.startsWith('key_')
      );
      if (locked.length === keys.length) continue;
      problems.push(`Sohle ${depth}: ${locked.length} Tueren, ${keys.length} Schluessel`);
    }
    expect(problems).toEqual([]);
    // Ab Sohle 5 sind es zwei, davor eine.
    expect(
      mapOf(5).entities.filter((entity) => entity.kind === 'door' && entity.locked !== undefined)
    ).toHaveLength(2);
  });

  // Test 4 aus PHASE_6_5
  it('lehnt den zweiten Schluessel hinter der ersten Tuer ab, Regel 4', () => {
    const { content, known } = contentForValidation();
    const map = structuredClone(mapOf(5));
    const keys = map.entities.filter(
      (entity) => entity.kind === 'item' && entity.defId.startsWith('key_')
    );
    expect(keys).toHaveLength(2);

    // Beide Schluessel an denselben Platz hinter der letzten Tuer: dann reicht
    // der erste Schluessel nur fuer eine Tuer, und der zweite ist nicht mehr
    // zu erreichen.
    const exit = map.exits[0];
    if (exit === undefined || keys[0] === undefined || keys[1] === undefined) {
      throw new Error('Sohle 5 ohne Ausgang oder Schluessel');
    }
    keys[0].pos = { ...exit.pos };
    keys[1].pos = { x: exit.pos.x, y: exit.pos.y };

    const rules = validateMap(map, content, known).map((finding) => finding.rule);
    expect(rules).toContain(4);
  });
});

describe('Raumdaten', () => {
  // Test 5 aus PHASE_6_5
  it('fuellt rooms auf allen sechzehn Karten ohne Ueberschneidung', () => {
    const problems: string[] = [];
    for (const depth of DEPTHS) {
      const map = mapOf(depth);
      expect(map.rooms.length).toBeGreaterThan(0);

      map.rooms.forEach((room, index) => {
        if (room.id !== index) problems.push(`Sohle ${depth}: Raum ${index} traegt id ${room.id}`);
        for (const other of map.rooms.slice(index + 1)) {
          const overlap =
            room.x < other.x + other.w &&
            other.x < room.x + room.w &&
            room.y < other.y + other.h &&
            other.y < room.y + room.h;
          if (overlap) problems.push(`Sohle ${depth}: Raum ${room.id} und ${other.id} ueberlappen`);
        }
      });

      const starts = map.rooms.filter((room) => room.kind === 'start');
      const bossMap = map.rooms.some((room) => room.kind === 'arena');
      if (!bossMap && starts.length !== 1) {
        problems.push(`Sohle ${depth}: ${starts.length} Startraeume`);
      }
    }
    expect(problems).toEqual([]);
  });

  // Test 6 aus PHASE_6_5
  it('findet einen Gegner im Startraum, Regel 12', () => {
    const { content, known } = contentForValidation();
    const map = structuredClone(mapOf(1));
    const home = map.rooms.find((room) => room.kind === 'start');
    const enemy = map.entities.find((entity) => entity.kind === 'enemy');
    if (home === undefined || enemy === undefined) throw new Error('kein Startraum oder Gegner');

    enemy.pos = { x: home.x, y: home.y };

    const rules = validateMap(map, content, known).map((finding) => finding.rule);
    expect(rules).toContain(12);
  });
});

describe('Id-Bereiche', () => {
  // Test 7 aus PHASE_6_5
  it('haelt jede Platzhalter-Id bei 200 oder darueber', () => {
    const constants = Object.entries(placeholders).filter(([name]) => name.startsWith('TEX_'));
    expect(constants.length).toBeGreaterThan(0);
    for (const [name, value] of constants) {
      expect(typeof value).toBe('number');
      expect(`${name}=${String(value)}`).toBe(`${name}=${String(Math.max(200, Number(value)))}`);
    }
  });

  // Test 8 aus PHASE_6_5
  it('nutzt in content/maps nur Textur-Ids aus dem Katalog', () => {
    const strays = new Set<number>();
    for (const depth of DEPTHS) {
      const map = mapOf(depth);
      for (const grid of [map.walls, map.floors, map.ceilings]) {
        for (const value of grid) {
          const id = textureIdOf(value);
          if (value === 0 || KNOWN_TEXTURES.has(id)) continue;
          strays.add(id);
        }
      }
    }
    expect([...strays]).toEqual([]);
  });
});

describe('Schleifspur in Zone 1', () => {
  // Test 9 aus PHASE_6_5
  it('beginnt mit 67 und endet mit 68', () => {
    expect(DUST_TRACE.start).toBe(67);
    expect(DUST_TRACE.end).toBe(68);

    const problems: string[] = [];
    for (const depth of [1, 2, 3, 4]) {
      const ids = mapOf(depth).floors.map(textureIdOf);
      if (!ids.includes(DUST_TRACE.start)) problems.push(`Sohle ${depth}: kein Anfangsstueck 67`);
      if (!ids.includes(DUST_TRACE.end)) problems.push(`Sohle ${depth}: kein Endstueck 68`);
      // Die Blutspur gehoert erst ab Zone 2 dazu.
      for (const blood of [60, 61, 62, 63]) {
        if (ids.includes(blood)) problems.push(`Sohle ${depth}: Blutspur ${blood} in Zone 1`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('setzt den Oelfleck einzeln, nie als Kette', () => {
    for (const depth of [1, 2, 3, 4]) {
      const map = mapOf(depth);
      const stains = map.floors
        .map((value, index) => ({ id: textureIdOf(value), index }))
        .filter((entry) => entry.id === OIL_STAIN);
      expect(stains.length).toBeGreaterThan(0);

      for (const stain of stains) {
        const neighbours = [
          stain.index - 1,
          stain.index + 1,
          stain.index - map.width,
          stain.index + map.width,
        ];
        const chained = neighbours.some(
          (index) => textureIdOf(map.floors[index] ?? 0) === OIL_STAIN
        );
        expect(chained).toBe(false);
      }
    }
  });
});

describe('Dunkle Raeume', () => {
  const DARK_LIMIT = 0.25;

  // Test 11 aus PHASE_7
  it('laesst hoechstens ein Viertel der Raeume einer Karte dunkel', () => {
    const problems: string[] = [];
    for (const depth of DEPTHS) {
      const map = mapOf(depth);
      const dark = map.rooms.filter((room) => room.dark === true).length;
      const limit = Math.floor(map.rooms.length * DARK_LIMIT);
      if (dark <= limit) continue;
      problems.push(`Sohle ${depth}: ${dark} von ${map.rooms.length} dunkel, erlaubt ${limit}`);
    }
    expect(problems).toEqual([]);
    // Ab Zone 3 gibt es sie wirklich, davor nie.
    expect(mapOf(13).rooms.some((room) => room.dark === true)).toBe(true);
    expect(mapOf(1).rooms.some((room) => room.dark === true)).toBe(false);
  });

  // Test 12 aus PHASE_7
  it('laesst Start, Ausgang und Arena nie dunkel', () => {
    const problems: string[] = [];
    for (const depth of DEPTHS) {
      for (const room of mapOf(depth).rooms) {
        if (room.dark !== true) continue;
        if (room.kind === 'normal' || room.kind === 'secret') continue;
        problems.push(`Sohle ${depth}: Raum ${room.id} ist dunkel und ${room.kind}`);
      }
    }
    expect(problems).toEqual([]);
  });

  // Test 13 aus PHASE_7
  it('gibt jedem hellen Raum mindestens eine Lampe', () => {
    const problems: string[] = [];
    for (const depth of DEPTHS) {
      const map = mapOf(depth);
      for (const room of map.rooms) {
        if (room.kind === 'corridor' || room.dark === true) continue;
        const lit = map.lamps.some(
          (lamp) =>
            lamp.pos.x >= room.x &&
            lamp.pos.x < room.x + room.w &&
            lamp.pos.y >= room.y &&
            lamp.pos.y < room.y + room.h
        );
        if (lit) continue;
        problems.push(`Sohle ${depth}: Raum ${room.id} ohne Lampe und ohne dark`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('laesst einen dunklen Raum wirklich ohne Licht', () => {
    const map = mapOf(13);
    const dark = map.rooms.find((room) => room.dark === true);
    expect(dark).toBeDefined();
    if (dark === undefined) return;

    const inside = map.lamps.filter(
      (lamp) =>
        lamp.pos.x >= dark.x &&
        lamp.pos.x < dark.x + dark.w &&
        lamp.pos.y >= dark.y &&
        lamp.pos.y < dark.y + dark.h
    );
    expect(inside).toEqual([]);
  });
});
