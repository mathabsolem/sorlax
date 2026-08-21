/**
 * Aufdecken der Karte, PHASE_4 Block 5.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { EXPLORE_MARGIN, exploreRadius, updateExplored } from '../src/core/explore';
import { chebyshev, hasLineOfSight, tileKey } from '../src/core/grid';
import { playerDerived } from '../src/core/turn';
import { setup } from './fixtures/world';

describe('exploreRadius', () => {
  it('ist die Sichtweite plus zwei', () => {
    const { state, content } = setup();
    expect(EXPLORE_MARGIN).toBe(2);
    expect(exploreRadius(state, content)).toBe(playerDerived(state, content).lightRadius + 2);
  });
});

describe('updateExplored', () => {
  // Test 4 aus PHASE_4
  it('ergaenzt genau die Kacheln in Sichtlinie innerhalb der Reichweite', () => {
    const { state, content, map } = setup({ size: 16, spawn: { pos: { x: 8, y: 8 }, facing: 1 } });
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');
    mapState.explored.length = 0;

    updateExplored(state, content);

    const radius = exploreRadius(state, content);
    const got = new Set(mapState.explored);

    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const inRange = chebyshev(state.player.pos, { x, y }) <= radius;
        const visible = hasLineOfSight(map, state.player.pos, { x, y }, mapState);
        expect(got.has(tileKey({ x, y }))).toBe(inRange && visible);
      }
    }
  });

  it('deckt nichts hinter einer Wand auf', () => {
    const { state, content, map } = setup({
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
    });
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');
    mapState.explored.length = 0;

    updateExplored(state, content);
    const got = new Set(mapState.explored);

    // (3,3) liegt hinter dem Pfeiler auf (2,2) und ist in Reichweite.
    const behind = { x: 3, y: 3 };
    expect(chebyshev(state.player.pos, behind)).toBeLessThanOrEqual(
      exploreRadius(state, content)
    );
    expect(hasLineOfSight(map, state.player.pos, behind, mapState)).toBe(false);
    expect(got.has(tileKey(behind))).toBe(false);

    // Der Pfeiler selbst ist sichtbar, sonst haette der Raum keinen Umriss.
    expect(got.has(tileKey({ x: 2, y: 2 }))).toBe(true);
  });

  // Test 5 aus PHASE_4
  it('ist idempotent: ein zweiter Aufruf ohne Bewegung aendert nichts', () => {
    const { state, content } = setup({ size: 16, spawn: { pos: { x: 8, y: 8 }, facing: 1 } });
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');

    const first = updateExplored(state, content);
    const snapshot = [...mapState.explored];

    const second = updateExplored(state, content);

    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual([]);
    expect(mapState.explored).toEqual(snapshot);
  });

  it('liefert nichts bei unbekannter Karte', () => {
    const { state, content } = setup();
    state.currentMapId = 'gibtsnicht';
    expect(updateExplored(state, content)).toEqual([]);
  });
});

describe('Anbindung an applyCommand', () => {
  it('deckt nach jedem Schritt auf', () => {
    const { state, content } = setup({ size: 16, spawn: { pos: { x: 8, y: 8 }, facing: 1 } });
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');
    mapState.explored.length = 0;

    applyCommand(state, { type: 'move', dir: 'forward' }, content);

    expect(mapState.explored.length).toBeGreaterThan(1);
    expect(mapState.explored).toContain(tileKey(state.player.pos));
  });

  it('deckt beim Sohlenwechsel die neue Umgebung auf', () => {
    const second = { id: 'second', spawn: { pos: { x: 3, y: 3 }, facing: 0 as const } };
    const { state, content } = setup({
      spawn: { pos: { x: 1, y: 1 }, facing: 2 },
      exits: [{ pos: { x: 1, y: 2 }, targetMapId: 'second' }],
      extraMaps: [
        {
          ...setup({ id: second.id, spawn: second.spawn }).map,
          id: second.id,
          spawn: second.spawn,
        },
      ],
    });

    applyCommand(state, { type: 'move', dir: 'forward' }, content);

    expect(state.currentMapId).toBe('second');
    expect((state.maps['second']?.explored.length ?? 0)).toBeGreaterThan(1);
  });
});
