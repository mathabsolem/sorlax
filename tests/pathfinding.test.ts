import { describe, expect, it } from 'vitest';
import { findPath } from '../src/core/pathfinding';
import { setup } from './fixtures/world';
import type { MapDef, MapRuntimeState } from '../src/core/types';

function world(entities: Parameters<typeof setup>[0] = {}): {
  map: MapDef;
  mapState: MapRuntimeState;
} {
  const { map, state } = setup(entities);
  const mapState = state.maps['test'];
  if (!mapState) throw new Error('missing map state');
  return { map, mapState };
}

describe('findPath', () => {
  it('liefert einen leeren Pfad wenn Start gleich Ziel ist', () => {
    const { map, mapState } = world();
    expect(findPath(map, { x: 1, y: 1 }, { x: 1, y: 1 }, mapState)).toEqual([]);
  });

  it('beginnt mit dem ersten Feld nach dem Start und endet auf dem Ziel', () => {
    const { map, mapState } = world();
    const path = findPath(map, { x: 1, y: 1 }, { x: 4, y: 1 }, mapState);
    expect(path).not.toBeNull();
    if (!path) return;
    expect(path[0]).toEqual({ x: 2, y: 1 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 1 });
    expect(path).toHaveLength(3);
  });

  it('geht nur ueber vier Nachbarn und laeuft um Pfeiler herum', () => {
    const { map, mapState } = world();
    const path = findPath(map, { x: 1, y: 1 }, { x: 1, y: 3 }, mapState);
    expect(path).not.toBeNull();
    if (!path) return;
    let previous = { x: 1, y: 1 };
    for (const step of path) {
      expect(Math.abs(step.x - previous.x) + Math.abs(step.y - previous.y)).toBe(1);
      previous = step;
    }
  });

  it('liefert null wenn das Ziel unerreichbar ist', () => {
    const { map, mapState } = world();
    expect(findPath(map, { x: 1, y: 1 }, { x: 0, y: 0 }, mapState)).toBeNull();
  });

  it('liefert null wenn maxNodes ueberschritten wird', () => {
    const { map, mapState } = world();
    expect(findPath(map, { x: 1, y: 1 }, { x: 6, y: 6 }, mapState, 1)).toBeNull();
  });

  it('weicht lebenden Gegnern aus', () => {
    const { map, mapState } = world({
      entities: [
        { kind: 'enemy', defId: 'grunt', pos: { x: 2, y: 1 } },
        { kind: 'enemy', defId: 'grunt', pos: { x: 1, y: 2 } },
      ],
    });
    expect(findPath(map, { x: 1, y: 1 }, { x: 4, y: 1 }, mapState)).toBeNull();
  });

  it('umgeht geschlossene Tueren und nutzt offene', () => {
    const { map, mapState } = world({
      entities: [{ kind: 'door', defId: 'door', pos: { x: 2, y: 1 } }],
    });
    const around = findPath(map, { x: 1, y: 1 }, { x: 3, y: 1 }, mapState);
    expect(around).not.toBeNull();
    if (!around) return;
    expect(around.some((step) => step.x === 2 && step.y === 1)).toBe(false);
    expect(around.length).toBeGreaterThan(2);

    const door = mapState.entities[0];
    if (!door) throw new Error('missing door');
    door.state = 'open';
    expect(findPath(map, { x: 1, y: 1 }, { x: 3, y: 1 }, mapState)).toEqual([
      { x: 2, y: 1 },
      { x: 3, y: 1 },
    ]);
  });
});
