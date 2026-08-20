/**
 * Temporaere Waende, PHASE_3_7 Block 1 und INTERFACES v1.2.1.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { hasLineOfSight, isSolid, isWalkable } from '../src/core/grid';
import { addTempWall, expireTempWalls, tempWallAt } from '../src/core/tempWalls';
import { advanceRound } from '../src/core/turn';
import type { GameState, MapRuntimeState } from '../src/core/types';
import { setup } from './fixtures/world';

function mapStateOf(state: GameState): MapRuntimeState {
  const mapState = state.maps['test'];
  if (mapState === undefined) throw new Error('kein Kartenzustand');
  return mapState;
}

describe('addTempWall', () => {
  // Test 10 aus PHASE_3_7
  it('gibt auf einer besetzten Kachel false zurueck', () => {
    const { state } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }],
    });
    const mapState = mapStateOf(state);

    // Kachel des Spielers.
    expect(addTempWall(state, mapState, { x: 1, y: 1 }, 1, 5)).toBe(false);
    // Kachel eines lebenden Gegners.
    expect(addTempWall(state, mapState, { x: 3, y: 1 }, 1, 5)).toBe(false);
    expect(mapState.tempWalls).toEqual([]);

    // Freie Kachel geht.
    expect(addTempWall(state, mapState, { x: 4, y: 1 }, 1, 5)).toBe(true);
    expect(mapState.tempWalls).toHaveLength(1);
  });

  it('setzt auf derselben Kachel keine zweite Wand', () => {
    const { state } = setup();
    const mapState = mapStateOf(state);

    expect(addTempWall(state, mapState, { x: 4, y: 1 }, 1, 5)).toBe(true);
    expect(addTempWall(state, mapState, { x: 4, y: 1 }, 1, 9)).toBe(false);
    expect(mapState.tempWalls).toHaveLength(1);
  });

  it('setzt auf der Kachel eines toten Gegners wieder eine Wand', () => {
    const { state } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }],
    });
    const mapState = mapStateOf(state);
    const enemy = mapState.entities[0];
    if (enemy === undefined) throw new Error('kein Gegner');

    enemy.health = 0;
    expect(addTempWall(state, mapState, { x: 3, y: 1 }, 1, 5)).toBe(true);
  });

  it('kopiert die Position, statt sie zu teilen', () => {
    const { state } = setup();
    const mapState = mapStateOf(state);
    const pos = { x: 4, y: 1 };

    addTempWall(state, mapState, pos, 1, 5);
    pos.x = 6;
    expect(tempWallAt(mapState, 4, 1)?.pos).toEqual({ x: 4, y: 1 });
    expect(tempWallAt(mapState, 6, 1)).toBeUndefined();
  });
});

describe('Wirkung und Ablauf', () => {
  // Test 11 aus PHASE_3_7
  it('blockiert Bewegung und Sichtlinie und verschwindet nach Ablauf', () => {
    const { state, content, map } = setup({
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
      entities: [{ kind: 'enemy', defId: 'tank', pos: { x: 4, y: 1 } }],
    });
    const mapState = mapStateOf(state);

    expect(isSolid(map, 2, 1, mapState)).toBe(false);
    expect(hasLineOfSight(map, state.player.pos, { x: 4, y: 1 }, mapState)).toBe(true);

    addTempWall(state, mapState, { x: 2, y: 1 }, 1, state.turnCount + 3);

    expect(isSolid(map, 2, 1, mapState)).toBe(true);
    expect(isWalkable(map, 2, 1, mapState)).toBe(false);
    expect(hasLineOfSight(map, state.player.pos, { x: 4, y: 1 }, mapState)).toBe(false);

    // Der Schritt nach Osten prallt an der Wand ab.
    expect(applyCommand(state, { type: 'move', dir: 'forward' }, content)).toEqual([
      { type: 'invalid', reason: 'blocked by wall' },
    ]);
    expect(state.player.pos).toEqual({ x: 1, y: 1 });

    // Nach drei Runden ist sie weg.
    for (let round = 0; round < 3; round++) advanceRound(state, content);
    expect(mapState.tempWalls).toEqual([]);
    expect(isSolid(map, 2, 1, mapState)).toBe(false);
    expect(hasLineOfSight(map, state.player.pos, { x: 4, y: 1 }, mapState)).toBe(true);
  });

  it('expireTempWalls entfernt genau die abgelaufenen', () => {
    const { state } = setup();
    const mapState = mapStateOf(state);
    addTempWall(state, mapState, { x: 4, y: 1 }, 1, 5);
    addTempWall(state, mapState, { x: 5, y: 1 }, 1, 9);

    expect(expireTempWalls(mapState, 4)).toBe(0);
    expect(expireTempWalls(mapState, 5)).toBe(1);
    expect(mapState.tempWalls.map((wall) => wall.pos.x)).toEqual([5]);
    expect(expireTempWalls(mapState, 100)).toBe(1);
    expect(mapState.tempWalls).toEqual([]);
  });

  it('ueberlebt Speichern und Laden', () => {
    const { state } = setup();
    const mapState = mapStateOf(state);
    addTempWall(state, mapState, { x: 4, y: 1 }, 7, 12);

    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    expect(restored.maps['test']?.tempWalls).toEqual([
      { pos: { x: 4, y: 1 }, tileValue: 7, expiresAtTurn: 12 },
    ]);
  });
});
