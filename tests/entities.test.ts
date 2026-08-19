import { describe, expect, it } from 'vitest';
import {
  createEnemyEntity,
  doorAt,
  enemyAt,
  entitiesAt,
  findEntity,
  isAlive,
  isDoorBlocking,
  itemAt,
  removeEntity,
  vitalsOf,
} from '../src/core/entities';
import { setup } from './fixtures/world';
import type { MapRuntimeState } from '../src/core/types';

function world(): MapRuntimeState {
  const { state } = setup({
    entities: [
      { kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } },
      { kind: 'door', defId: 'door', pos: { x: 4, y: 1 } },
      { kind: 'item', defId: 'medkit', pos: { x: 5, y: 1 } },
    ],
  });
  const mapState = state.maps['test'];
  if (!mapState) throw new Error('missing map state');
  return mapState;
}

describe('entities', () => {
  it('findEntity liefert die Entitaet zur Id', () => {
    const mapState = world();
    expect(findEntity(mapState, 1)?.defId).toBe('grunt');
    expect(findEntity(mapState, 99)).toBeUndefined();
  });

  it('entitiesAt liefert alle Entitaeten einer Kachel', () => {
    const mapState = world();
    expect(entitiesAt(mapState, 3, 1)).toHaveLength(1);
    expect(entitiesAt(mapState, 2, 1)).toHaveLength(0);
  });

  it('doorAt, enemyAt und itemAt filtern nach Art', () => {
    const mapState = world();
    expect(doorAt(mapState, 4, 1)?.kind).toBe('door');
    expect(doorAt(mapState, 3, 1)).toBeUndefined();
    expect(enemyAt(mapState, 3, 1)?.kind).toBe('enemy');
    expect(itemAt(mapState, 5, 1)?.defId).toBe('medkit');
  });

  it('enemyAt ignoriert tote Gegner', () => {
    const mapState = world();
    const grunt = findEntity(mapState, 1);
    if (!grunt) throw new Error('missing grunt');
    grunt.health = 0;
    expect(enemyAt(mapState, 3, 1)).toBeUndefined();
  });

  it('isAlive gilt fuer Entitaeten ohne Lebenswert immer', () => {
    const mapState = world();
    const door = doorAt(mapState, 4, 1);
    if (!door) throw new Error('missing door');
    expect(isAlive(door)).toBe(true);
  });

  it('isDoorBlocking gilt fuer alles ausser open', () => {
    const mapState = world();
    const door = doorAt(mapState, 4, 1);
    if (!door) throw new Error('missing door');
    expect(isDoorBlocking(door)).toBe(true);
    door.state = 'open';
    expect(isDoorBlocking(door)).toBe(false);
  });

  it('removeEntity entfernt genau einmal', () => {
    const mapState = world();
    expect(removeEntity(mapState, 1)).toBe(true);
    expect(removeEntity(mapState, 1)).toBe(false);
    expect(findEntity(mapState, 1)).toBeUndefined();
  });

  it('createEnemyEntity schreibt Leben und Gegnerlevel fest', () => {
    const entity = createEnemyEntity(7, 'grunt', { x: 2, y: 2 }, 1, 10, 4);
    expect(entity.id).toBe(7);
    expect(entity.kind).toBe('enemy');
    expect(entity.active).toBe(false);
    expect(entity.health).toBe(10);
    expect(entity.monsterLevel).toBe(4);
    expect(entity.rank).toBe('common');
    expect(entity.effects).toEqual([]);
  });

  it('vitalsOf schreibt in die Entitaet zurueck', () => {
    const entity = createEnemyEntity(8, 'grunt', { x: 1, y: 1 }, 0, 12, 1);
    const vitals = vitalsOf(entity);
    expect(vitals.health).toBe(12);
    vitals.health = 5;
    expect(entity.health).toBe(5);
  });
});
