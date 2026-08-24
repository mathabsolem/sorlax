/**
 * Abnahme der ersten Sohle, PHASE_6 Abnahmekriterium.
 *
 * Der Spieler laeuft vom Start zum Schluessel, oeffnet die verriegelte Tuer
 * und erreicht den Ausgang nach Sohle 2. Gelaufen wird mit denselben
 * Kommandos, die auch die Oberflaeche schickt.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { playerDerived } from '../src/core/turn';
import { createNewGame } from '../src/core/state';
import { FIRST_MAP_ID, createGameContent } from '../src/app/gameContent';
import type { ContentDb, Facing, GameState, TileCoord } from '../src/core/types';

const content: ContentDb = createGameContent();

/** Blickrichtung, um von `from` auf die angrenzende Kachel `to` zu schauen. */
function facingTo(from: TileCoord, to: TileCoord): Facing {
  if (to.y < from.y) return 0;
  if (to.x > from.x) return 1;
  if (to.y > from.y) return 2;
  return 3;
}

/** Haelt den Spieler am Leben: geprueft wird der Weg, nicht der Kampf. */
function heal(state: GameState): void {
  state.player.health = playerDerived(state, content).maxHealth;
}

function face(state: GameState, to: TileCoord): void {
  const facing = facingTo(state.player.pos, to);
  while (state.player.facing !== facing) {
    applyCommand(state, { type: 'turn', dir: 'cw' }, content);
  }
}

/** Dreht auf die Zielrichtung und geht einen Schritt vor. */
function stepTo(state: GameState, to: TileCoord): void {
  face(state, to);
  applyCommand(state, { type: 'move', dir: 'forward' }, content);
  heal(state);
}

/**
 * Weg zur Kachel `goal`, ohne Ruecksicht auf Gegner. `findPath` weicht ihnen
 * aus und liefert dann gar keinen Weg; hier sollen sie niedergeschlagen werden.
 * Geschlossene Tueren gelten als Wand, das Ziel selbst darf eine sein.
 */
function routeTo(state: GameState, goal: TileCoord): TileCoord[] | null {
  const map = content.maps[state.currentMapId];
  const mapState = state.maps[state.currentMapId];
  if (map === undefined || mapState === undefined) return null;

  const shut = new Set(
    mapState.entities
      .filter((entity) => entity.kind === 'door' && entity.state !== 'open')
      .map((entity) => entity.pos.y * map.width + entity.pos.x)
  );
  const goalIndex = goal.y * map.width + goal.x;
  const start = state.player.pos.y * map.width + state.player.pos.x;
  const parent = new Map<number, number>([[start, -1]]);
  const queue = [start];

  for (let head = 0; head < queue.length; head++) {
    const index = queue[head];
    if (index === undefined) continue;
    if (index === goalIndex) break;
    const x = index % map.width;
    const y = (index - x) / map.width;
    for (const next of [
      x > 0 ? index - 1 : -1,
      x < map.width - 1 ? index + 1 : -1,
      y > 0 ? index - map.width : -1,
      y < map.height - 1 ? index + map.width : -1,
    ]) {
      if (next < 0 || parent.has(next)) continue;
      if (map.walls[next] !== 0) continue;
      if (shut.has(next) && next !== goalIndex) continue;
      parent.set(next, index);
      queue.push(next);
    }
  }

  if (!parent.has(goalIndex)) return null;
  const path: TileCoord[] = [];
  for (let cursor = goalIndex; cursor !== start; cursor = parent.get(cursor) ?? start) {
    path.unshift({ x: cursor % map.width, y: Math.floor(cursor / map.width) });
    if (parent.get(cursor) === undefined) return null;
  }
  return path;
}

/**
 * Laeuft zur Kachel `goal`. Gegner im Weg werden niedergeschlagen; geprueft
 * wird der Weg, nicht der Kampf, deshalb bleibt der Spieler dabei am Leben.
 */
function walkTo(state: GameState, goal: TileCoord, limit = 600): boolean {
  const startedOn = state.currentMapId;
  for (let step = 0; step < limit; step++) {
    // Der Ausgang wechselt die Sohle, sobald der Spieler ihn betritt.
    if (state.currentMapId !== startedOn) return true;
    if (state.player.pos.x === goal.x && state.player.pos.y === goal.y) return true;
    const mapState = state.maps[state.currentMapId];
    const next = routeTo(state, goal)?.[0];
    if (next === undefined || mapState === undefined) return false;

    const blocker = mapState.entities.find(
      (entity) => entity.kind === 'enemy' && entity.pos.x === next.x && entity.pos.y === next.y
    );
    face(state, next);
    if (blocker !== undefined) {
      applyCommand(state, { type: 'attack', targetId: blocker.id }, content);
      heal(state);
      continue;
    }

    const before = { ...state.player.pos };
    stepTo(state, next);
    if (state.player.pos.x === before.x && state.player.pos.y === before.y) return false;
  }
  return false;
}

describe('Sohle 1', () => {
  it('laesst sich vom Start ueber Schluessel und Tuer bis zum Ausgang durchqueren', () => {
    const state = createNewGame(4711, content, FIRST_MAP_ID);
    state.player.level = 12;
    heal(state);

    const map = content.maps[FIRST_MAP_ID];
    if (map === undefined) throw new Error('Sohle 1 fehlt');
    const key = map.entities.find((entity) => entity.defId.startsWith('key_'));
    const door = map.entities.find((entity) => entity.kind === 'door' && entity.locked !== undefined);
    const exit = map.exits[0];
    if (key === undefined || door === undefined || exit === undefined) {
      throw new Error('Sohle 1 ohne Schluessel, Tuer oder Ausgang');
    }

    expect(walkTo(state, key.pos)).toBe(true);
    expect(state.player.keys).toContain(key.defId);

    // Vor der Tuer stehen, sie aufschliessen und hindurchgehen.
    const mapState = state.maps[FIRST_MAP_ID];
    if (mapState === undefined) throw new Error('kein Kartenzustand');
    // Von welcher Seite die Tuer erreichbar ist, entscheidet der Weg, nicht
    // die Himmelsrichtung: die Gegenseite liegt hinter der Tuer.
    const front = [
      { x: door.pos.x, y: door.pos.y - 1 },
      { x: door.pos.x + 1, y: door.pos.y },
      { x: door.pos.x, y: door.pos.y + 1 },
      { x: door.pos.x - 1, y: door.pos.y },
    ].filter((tile) => map.walls[tile.y * map.width + tile.x] === 0);
    expect(front.length).toBeGreaterThan(0);

    const reached = front.some((tile) => walkTo(state, tile));
    expect(reached).toBe(true);
    face(state, door.pos);
    applyCommand(state, { type: 'interact' }, content);
    expect(mapState.entities.find((entity) => entity.kind === 'door')?.state).not.toBe('locked');
    // Der Schluessel ist verbraucht, CONTENT_TABLES v1.2 Abschnitt 7.
    expect(state.player.keys).not.toContain(key.defId);

    expect(walkTo(state, exit.pos)).toBe(true);
    expect(state.currentMapId).toBe('sohle_02');
  });
});

/**
 * Spielt eine Sohle bis zum Ausgang: erreichbare Schluessel einsammeln,
 * erreichbare Tueren aufschliessen, wiederholen. Bricht ab, sobald nichts mehr
 * geht — genau dann waere die Karte eine Sackgasse.
 */
function playFloor(state: GameState, mapId: string): boolean {
  const map = content.maps[mapId];
  if (map === undefined) return false;

  for (let round = 0; round < 12; round++) {
    const mapState = state.maps[state.currentMapId];
    if (mapState === undefined) return false;

    const exit = map.exits[0];
    if (exit !== undefined && routeTo(state, exit.pos) !== null) {
      return walkTo(state, exit.pos) && state.currentMapId !== mapId;
    }

    // Erreichbarer Schluessel, der noch liegt.
    const key = mapState.entities.find(
      (entity) =>
        entity.kind === 'item' &&
        entity.defId.startsWith('key_') &&
        routeTo(state, entity.pos) !== null
    );
    if (key !== undefined) {
      if (!walkTo(state, key.pos)) return false;
      continue;
    }

    // Erreichbare verriegelte Tuer, fuer die ein Schluessel im Bestand liegt.
    const door = map.entities.find((entity) => {
      if (entity.kind !== 'door' || entity.locked === undefined) return false;
      if (!state.player.keys.includes(entity.locked)) return false;
      const runtime = mapState.entities.find(
        (candidate) =>
          candidate.kind === 'door' &&
          candidate.pos.x === entity.pos.x &&
          candidate.pos.y === entity.pos.y
      );
      return runtime?.state !== 'open';
    });
    if (door === undefined) return false;

    const front = [
      { x: door.pos.x, y: door.pos.y - 1 },
      { x: door.pos.x + 1, y: door.pos.y },
      { x: door.pos.x, y: door.pos.y + 1 },
      { x: door.pos.x - 1, y: door.pos.y },
    ].filter((tile) => map.walls[tile.y * map.width + tile.x] === 0);
    const reached = front.some((tile) => routeTo(state, tile) !== null && walkTo(state, tile));
    if (!reached) return false;

    face(state, door.pos);
    applyCommand(state, { type: 'interact' }, content);
  }
  return false;
}

describe('Sohle 5', () => {
  it('laesst beide Tueren in einer Reihenfolge oeffnen, die nicht feststeckt', () => {
    const map = content.maps['sohle_05'];
    if (map === undefined) throw new Error('Sohle 5 fehlt');

    const doors = map.entities.filter(
      (entity) => entity.kind === 'door' && entity.locked !== undefined
    );
    const keys = map.entities.filter(
      (entity) => entity.kind === 'item' && entity.defId.startsWith('key_')
    );
    expect(doors).toHaveLength(2);
    expect(keys).toHaveLength(2);

    const state = createNewGame(4711, content, 'sohle_05');
    state.player.level = 20;
    heal(state);

    expect(playFloor(state, 'sohle_05')).toBe(true);
    expect(state.currentMapId).toBe('sohle_06');
    // Beide Schluessel sind verbraucht.
    expect(state.player.keys).toEqual([]);
  });
});
