import { describe, expect, it } from 'vitest';
import { encodeTile, textureIdOf } from '../src/core/tiles';
import { createRenderMap } from '../src/render/renderMap';
import { TEX_FLOOR_PLATE } from '../src/render/placeholders';
import { makeMap, setup } from './fixtures/world';
import { createMapRuntime } from '../src/core/state';
import { makeContent } from './fixtures/world';

const DOOR_VALUE = encodeTile(4, 0);

describe('createRenderMap', () => {
  it('uebernimmt Waende, Boden, Decke und Licht der Karte', () => {
    const { map, state } = setup();
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    const view = createRenderMap(map, mapState, DOOR_VALUE);

    expect(view.width).toBe(8);
    expect(view.height).toBe(8);
    expect(view.walls.length).toBe(64);
    expect(view.ambientLight).toBe(map.ambientLight);
    expect(textureIdOf(view.floors[0] ?? 0)).toBe(TEX_FLOOR_PLATE);
    expect(view.light[0]).toBe(255);
  });

  it('traegt geschlossene und verriegelte Tueren als Wand ein', () => {
    const { map, state } = setup({
      entities: [
        { kind: 'door', defId: 'gate', pos: { x: 2, y: 1 } },
        { kind: 'door', defId: 'gate', pos: { x: 3, y: 1 }, locked: 'redkey' },
      ],
    });
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');

    const view = createRenderMap(map, mapState, DOOR_VALUE);
    expect(view.walls[1 * 8 + 2]).toBe(DOOR_VALUE);
    expect(view.walls[1 * 8 + 3]).toBe(DOOR_VALUE);
  });

  it('laesst offene Tueren begehbar', () => {
    const { map, state } = setup({
      entities: [{ kind: 'door', defId: 'gate', pos: { x: 2, y: 1 } }],
    });
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    const door = mapState.entities[0];
    if (!door) throw new Error('missing door');
    door.state = 'open';

    expect(createRenderMap(map, mapState, DOOR_VALUE).walls[1 * 8 + 2]).toBe(0);
  });

  it('erzeugt fehlendes Licht aus den Lampen', () => {
    const map = makeMap({ lamps: [{ pos: { x: 1, y: 1 }, radius: 4, intensity: 200 }], light: [] });
    const mapState = createMapRuntime(map, makeContent([map]), 1, 'normal');

    const view = createRenderMap(map, mapState, DOOR_VALUE);
    expect(view.light[1 * 8 + 1]).toBe(200);
    expect(view.light[1 * 8 + 2]).toBe(150);
  });

  it('veraendert den Spielzustand nicht', () => {
    const { map, state } = setup({
      entities: [{ kind: 'door', defId: 'gate', pos: { x: 2, y: 1 } }],
    });
    const mapState = state.maps['test'];
    if (!mapState) throw new Error('missing map state');
    const before = JSON.stringify(map.walls);

    createRenderMap(map, mapState, DOOR_VALUE);
    expect(JSON.stringify(map.walls)).toBe(before);
  });
});
