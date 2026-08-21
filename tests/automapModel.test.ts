/**
 * Geometrie der Automap, PHASE_4 Block 5.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { updateExplored } from '../src/core/explore';
import { tileKey } from '../src/core/grid';
import { automapForState, automapTiles } from '../src/ui/automapModel';
import { setup } from './fixtures/world';

describe('automapTiles', () => {
  // Test 6 aus PHASE_4
  it('liefert fuer eine bekannte Kachel genau die Kanten zu soliden Nachbarn', () => {
    const { state, map } = setup({ spawn: { pos: { x: 1, y: 1 }, facing: 1 } });
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    // Nur die Startkachel ist bekannt. (1,1) grenzt an die Randwaende im
    // Norden und Westen, im Osten und Sueden liegt Boden.
    mapState.explored.length = 0;
    mapState.explored.push(tileKey({ x: 1, y: 1 }));

    const tiles = automapTiles(map, mapState, { pos: { x: 1, y: 1 }, facing: 1 });

    expect(tiles.floors).toEqual([{ x: 1, y: 1 }]);
    expect(tiles.walls.map((edge) => edge.side).sort()).toEqual(['north', 'west']);
    expect(tiles.walls.every((edge) => edge.x === 1 && edge.y === 1)).toBe(true);
    expect(tiles.player).toEqual({ pos: { x: 1, y: 1 }, facing: 1 });
  });

  it('zaehlt bei zwei bekannten Kacheln die Kanten beider', () => {
    const { state, map } = setup();
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    mapState.explored.length = 0;
    // (1,1) hat zwei Kanten, (1,2) hat als Nachbarn Westwand und den
    // Pfeiler auf (2,2), also ebenfalls zwei.
    mapState.explored.push(tileKey({ x: 1, y: 1 }), tileKey({ x: 1, y: 2 }));

    const tiles = automapTiles(map, mapState, { pos: { x: 1, y: 2 }, facing: 2 });

    expect(tiles.floors).toHaveLength(2);
    expect(tiles.walls).toHaveLength(4);
  });

  it('zeichnet nur Erkundetes', () => {
    const { state, content, map } = setup({ size: 16, spawn: { pos: { x: 8, y: 8 }, facing: 1 } });
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');
    mapState.explored.length = 0;
    updateExplored(state, content);

    const tiles = automapTiles(map, mapState, { pos: state.player.pos, facing: 1 });
    const known = new Set(mapState.explored);

    expect(tiles.floors.length).toBeGreaterThan(0);
    for (const floor of tiles.floors) expect(known.has(tileKey(floor))).toBe(true);
    for (const edge of tiles.walls) expect(known.has(tileKey({ x: edge.x, y: edge.y }))).toBe(true);
  });

  it('meldet Tueren mit Schluesselfarbe und Zustand', () => {
    const { state, content, map } = setup({
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
      entities: [{ kind: 'door', defId: 'door', pos: { x: 2, y: 1 }, locked: 'redkey' }],
    });
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');
    updateExplored(state, content);

    const closed = automapTiles(map, mapState, { pos: state.player.pos, facing: 1 });
    expect(closed.doors).toEqual([{ pos: { x: 2, y: 1 }, locked: 'redkey', open: false }]);

    state.player.keys.push('redkey');
    applyCommand(state, { type: 'interact' }, content);

    const opened = automapTiles(map, mapState, { pos: state.player.pos, facing: 1 });
    expect(opened.doors[0]?.open).toBe(true);
  });

  it('markiert nur erkundete Ausgaenge', () => {
    const { state, content, map } = setup({
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
      exits: [
        { pos: { x: 3, y: 1 }, targetMapId: 'second' },
        { pos: { x: 6, y: 6 }, targetMapId: 'third' },
      ],
    });
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');
    mapState.explored.length = 0;
    updateExplored(state, content);

    const tiles = automapTiles(map, mapState, { pos: state.player.pos, facing: 1 });

    expect(tiles.exits).toEqual([{ x: 3, y: 1 }]);
  });
});

describe('automapForState', () => {
  it('liest die aktuelle Sohle und liefert bei kaputtem Zustand null', () => {
    const { state, content } = setup();
    expect(automapForState(state, content.maps)?.player.pos).toEqual({ x: 1, y: 1 });

    state.currentMapId = 'gibtsnicht';
    expect(automapForState(state, content.maps)).toBeNull();
  });
});
