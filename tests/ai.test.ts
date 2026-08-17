import { describe, expect, it } from 'vitest';
import { checkActivation, takeEnemyTurn } from '../src/core/ai';
import { setup } from './fixtures/world';
import type { ContentDb, Entity, GameState, MapEntityDef } from '../src/core/types';

function scene(entities: MapEntityDef[]): {
  state: GameState;
  content: ContentDb;
  enemy: Entity;
} {
  const { state, content } = setup({ entities });
  const enemy = state.maps['test']?.entities[0];
  if (!enemy) throw new Error('missing enemy');
  return { state, content, enemy };
}

describe('checkActivation', () => {
  it('weckt einen Gegner mit Sichtlinie in aggroRange', () => {
    const { state, content, enemy } = scene([{ kind: 'enemy', defId: 'grunt', pos: { x: 5, y: 1 } }]);
    expect(checkActivation(state, enemy, content)).toBe(true);
    expect(enemy.active).toBe(true);
  });

  it('laesst einen Gegner ausserhalb der aggroRange schlafen', () => {
    const { state, content, enemy } = scene([
      { kind: 'enemy', defId: 'sleeper', pos: { x: 5, y: 1 } },
    ]);
    expect(checkActivation(state, enemy, content)).toBe(false);
    expect(enemy.active).toBe(false);
  });

  it('weckt niemanden ohne Sichtlinie', () => {
    const { state, content } = setup({
      entities: [
        { kind: 'door', defId: 'door', pos: { x: 3, y: 1 } },
        { kind: 'enemy', defId: 'grunt', pos: { x: 5, y: 1 } },
      ],
    });
    const enemy = state.maps['test']?.entities[1];
    if (!enemy) throw new Error('missing enemy');
    expect(checkActivation(state, enemy, content)).toBe(false);
  });

  it('haelt einmal aktive Gegner aktiv', () => {
    const { state, content } = setup({
      entities: [
        { kind: 'door', defId: 'door', pos: { x: 3, y: 1 } },
        { kind: 'enemy', defId: 'grunt', pos: { x: 5, y: 1 } },
      ],
    });
    const enemy = state.maps['test']?.entities[1];
    if (!enemy) throw new Error('missing enemy');
    enemy.active = true;
    expect(checkActivation(state, enemy, content)).toBe(true);
  });
});

describe('takeEnemyTurn', () => {
  it('ignoriert Entitaeten, die keine Gegner sind', () => {
    const { state, content } = setup({
      entities: [{ kind: 'door', defId: 'door', pos: { x: 3, y: 1 } }],
    });
    const door = state.maps['test']?.entities[0];
    if (!door) throw new Error('missing door');
    expect(takeEnemyTurn(state, door, content)).toEqual([]);
  });

  it('melee laeuft per Pfadsuche einen Schritt auf den Spieler zu', () => {
    const { state, content, enemy } = scene([{ kind: 'enemy', defId: 'grunt', pos: { x: 4, y: 1 } }]);
    const events = takeEnemyTurn(state, enemy, content);
    expect(events[0]).toMatchObject({ type: 'moved', who: enemy.id, to: { x: 3, y: 1 } });
    expect(enemy.pos).toEqual({ x: 3, y: 1 });
    expect(enemy.facing).toBe(3);
  });

  it('melee greift bei Distanz 1 an, statt zu laufen', () => {
    const { state, content, enemy } = scene([{ kind: 'enemy', defId: 'grunt', pos: { x: 2, y: 1 } }]);
    const events = takeEnemyTurn(state, enemy, content);
    expect(events[0]?.type).toBe('attack');
    expect(enemy.pos).toEqual({ x: 2, y: 1 });
  });

  it('charger nimmt die groessere Achse ohne Pfadsuche', () => {
    const { state, content, enemy } = scene([{ kind: 'enemy', defId: 'runner', pos: { x: 4, y: 1 } }]);
    enemy.active = true;
    takeEnemyTurn(state, enemy, content);
    expect(enemy.pos).toEqual({ x: 3, y: 1 });
  });

  it('charger weicht bei blockierter Achse auf die andere aus', () => {
    const { state, content, enemy } = scene([{ kind: 'enemy', defId: 'runner', pos: { x: 4, y: 2 } }]);
    enemy.active = true;
    takeEnemyTurn(state, enemy, content);
    // dx ist groesser, aber (3,2) ist Wand, deshalb der Schritt auf der y-Achse.
    expect(enemy.pos).toEqual({ x: 4, y: 1 });
  });

  it('ranged schiesst auf der bevorzugten Distanz', () => {
    const { state, content, enemy } = scene([{ kind: 'enemy', defId: 'sniper', pos: { x: 4, y: 1 } }]);
    const events = takeEnemyTurn(state, enemy, content);
    expect(events[0]?.type).toBe('attack');
    expect(enemy.pos).toEqual({ x: 4, y: 1 });
  });

  it('ranged geht auf zu kurzer Distanz einen Schritt zurueck', () => {
    const { state, content, enemy } = scene([{ kind: 'enemy', defId: 'sniper', pos: { x: 2, y: 1 } }]);
    takeEnemyTurn(state, enemy, content);
    expect(enemy.pos).toEqual({ x: 3, y: 1 });
  });

  it('ranged geht auf zu grosser Distanz einen Schritt vor', () => {
    const { state, content, enemy } = scene([{ kind: 'enemy', defId: 'sniper', pos: { x: 6, y: 1 } }]);
    takeEnemyTurn(state, enemy, content);
    expect(enemy.pos).toEqual({ x: 5, y: 1 });
  });

  it('turret schiesst bei Sichtlinie und bewegt sich nie', () => {
    const { state, content, enemy } = scene([
      { kind: 'enemy', defId: 'emplacement', pos: { x: 4, y: 1 } },
    ]);
    const events = takeEnemyTurn(state, enemy, content);
    expect(events[0]?.type).toBe('attack');
    expect(enemy.pos).toEqual({ x: 4, y: 1 });
  });

  it('turret tut ohne Sichtlinie nichts', () => {
    const { state, content } = setup({
      entities: [
        { kind: 'door', defId: 'door', pos: { x: 3, y: 1 } },
        { kind: 'enemy', defId: 'emplacement', pos: { x: 5, y: 1 } },
      ],
    });
    const enemy = state.maps['test']?.entities[1];
    if (!enemy) throw new Error('missing enemy');
    enemy.active = true;
    expect(takeEnemyTurn(state, enemy, content)).toEqual([]);
    expect(enemy.pos).toEqual({ x: 5, y: 1 });
  });

  it('laeuft nicht auf die Kachel des Spielers', () => {
    const { state, content, enemy } = scene([{ kind: 'enemy', defId: 'runner', pos: { x: 2, y: 1 } }]);
    takeEnemyTurn(state, enemy, content);
    expect(enemy.pos).not.toEqual(state.player.pos);
  });
});
