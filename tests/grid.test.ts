import { describe, expect, it } from 'vitest';
import {
  chebyshev,
  facingDelta,
  hasLineOfSight,
  isSolid,
  isWalkable,
  manhattan,
  parseTileKey,
  rotate,
  stepFrom,
  tileAt,
  tileKey,
} from '../src/core/grid';
import { setup } from './fixtures/world';

describe('tileAt', () => {
  it('liest Kacheln row major', () => {
    const { map } = setup();
    expect(tileAt(map, 1, 1)).toBe(0);
    // Der Wert ist die Wandtextur, geprueft wird nur "nicht frei".
    expect(tileAt(map, 2, 2)).not.toBe(0);
  });

  it('behandelt Koordinaten ausserhalb der Karte als solide', () => {
    const { map } = setup();
    expect(tileAt(map, -1, 3)).toBe(1);
    expect(tileAt(map, 3, -1)).toBe(1);
    expect(tileAt(map, 8, 3)).toBe(1);
    expect(tileAt(map, 3, 8)).toBe(1);
  });
});

describe('isSolid', () => {
  it('meldet Waende', () => {
    const { map, state } = setup();
    const mapState = state.maps['test'];
    expect(mapState).toBeDefined();
    if (!mapState) return;
    expect(isSolid(map, 0, 0, mapState)).toBe(true);
    expect(isSolid(map, 1, 1, mapState)).toBe(false);
  });

  it('meldet geschlossene und verriegelte Tueren, offene nicht', () => {
    const { map, state } = setup({
      entities: [
        { kind: 'door', defId: 'door', pos: { x: 2, y: 1 } },
        { kind: 'door', defId: 'door', pos: { x: 3, y: 1 }, locked: 'redkey' },
      ],
    });
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    expect(isSolid(map, 2, 1, mapState)).toBe(true);
    expect(isSolid(map, 3, 1, mapState)).toBe(true);

    const door = mapState.entities.find((entity) => entity.pos.x === 2);
    if (!door) throw new Error('missing door');
    door.state = 'open';
    expect(isSolid(map, 2, 1, mapState)).toBe(false);
  });
});

describe('isWalkable', () => {
  it('schliesst Kacheln mit lebenden Gegnern aus', () => {
    const { map, state } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }],
    });
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    expect(isWalkable(map, 3, 1, mapState)).toBe(false);
    expect(isWalkable(map, 4, 1, mapState)).toBe(true);
    expect(isWalkable(map, 0, 0, mapState)).toBe(false);
  });
});

describe('Distanzen', () => {
  it('chebyshev nimmt die groessere Achsendifferenz', () => {
    expect(chebyshev({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(3);
    expect(chebyshev({ x: 2, y: 5 }, { x: 2, y: 5 })).toBe(0);
  });

  it('manhattan summiert die Achsendifferenzen', () => {
    expect(manhattan({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe(4);
  });
});

describe('Richtungen', () => {
  it('facingDelta folgt SPEC 3.1', () => {
    expect(facingDelta(0)).toEqual({ x: 0, y: -1 });
    expect(facingDelta(1)).toEqual({ x: 1, y: 0 });
    expect(facingDelta(2)).toEqual({ x: 0, y: 1 });
    expect(facingDelta(3)).toEqual({ x: -1, y: 0 });
  });

  it('rotate bleibt im Bereich 0 bis 3', () => {
    expect(rotate(0, 1)).toBe(1);
    expect(rotate(3, 1)).toBe(0);
    expect(rotate(0, -1)).toBe(3);
    expect(rotate(2, -5)).toBe(1);
  });

  it('stepFrom deckt alle vier Bewegungsrichtungen ab', () => {
    const pos = { x: 4, y: 4 };
    expect(stepFrom(pos, 1, 'forward')).toEqual({ x: 5, y: 4 });
    expect(stepFrom(pos, 1, 'back')).toEqual({ x: 3, y: 4 });
    expect(stepFrom(pos, 1, 'left')).toEqual({ x: 4, y: 3 });
    expect(stepFrom(pos, 1, 'right')).toEqual({ x: 4, y: 5 });
  });
});

describe('hasLineOfSight', () => {
  it('sieht entlang eines freien Ganges', () => {
    const { map, state } = setup();
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    expect(hasLineOfSight(map, { x: 1, y: 1 }, { x: 6, y: 1 }, mapState)).toBe(true);
  });

  it('wird von Waenden blockiert', () => {
    const { map, state } = setup();
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    expect(hasLineOfSight(map, { x: 1, y: 1 }, { x: 1, y: 6 }, mapState)).toBe(true);
    expect(hasLineOfSight(map, { x: 3, y: 1 }, { x: 3, y: 3 }, mapState)).toBe(false);
  });

  it('blockiert an geschlossenen Tueren, aber nicht an den Endkacheln', () => {
    const { map, state } = setup({
      entities: [{ kind: 'door', defId: 'door', pos: { x: 3, y: 1 } }],
    });
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    expect(hasLineOfSight(map, { x: 1, y: 1 }, { x: 5, y: 1 }, mapState)).toBe(false);
    expect(hasLineOfSight(map, { x: 1, y: 1 }, { x: 3, y: 1 }, mapState)).toBe(true);
  });

  it('sieht sich selbst', () => {
    const { map, state } = setup();
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    expect(hasLineOfSight(map, { x: 2, y: 2 }, { x: 2, y: 2 }, mapState)).toBe(true);
  });
});

describe('tileKey', () => {
  it('ist umkehrbar', () => {
    expect(tileKey({ x: 3, y: 7 })).toBe('3,7');
    expect(parseTileKey('3,7')).toEqual({ x: 3, y: 7 });
    expect(parseTileKey(tileKey({ x: -2, y: 11 }))).toEqual({ x: -2, y: 11 });
  });

  it('wirft bei kaputtem Schluessel', () => {
    expect(() => parseTileKey('3')).toThrow();
    expect(() => parseTileKey('a,b')).toThrow();
  });
});
