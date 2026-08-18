import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { createNewGame } from '../src/core/state';
import { rotationOf } from '../src/core/tiles';
import {
  DEV_MAP_ID,
  DEV_SEED,
  collectAssetNames,
  createDevContent,
  createDevMap,
} from '../src/app/devFixture';

describe('Entwicklungskarte', () => {
  it('ist 16 x 16 und ringsum geschlossen', () => {
    const map = createDevMap();
    expect(map.width).toBe(16);
    expect(map.height).toBe(16);
    expect(map.walls.length).toBe(256);
    for (let x = 0; x < 16; x++) {
      expect(map.walls[x]).not.toBe(0);
      expect(map.walls[15 * 16 + x]).not.toBe(0);
    }
  });

  it('bringt Tuer, zwei Verhaltensmuster, ein Item und zwei Lampen mit', () => {
    const map = createDevMap();
    const content = createDevContent();
    const kinds = map.entities.map((entity) => entity.kind);

    expect(kinds).toContain('door');
    expect(kinds).toContain('item');
    expect(map.lamps.length).toBeGreaterThanOrEqual(2);

    const behaviours = map.entities
      .filter((entity) => entity.kind === 'enemy')
      .map((entity) => content.enemies[entity.defId]?.behavior);
    expect(behaviours).toHaveLength(2);
    expect(new Set(behaviours).size).toBe(2);
  });

  it('hat gedrehte Bodenkacheln', () => {
    const map = createDevMap();
    const rotations = new Set(map.floors.map((value) => rotationOf(value)));
    expect(rotations.size).toBeGreaterThan(1);
  });

  it('erzeugt Licht aus den Lampen, unter der Lampe am hellsten', () => {
    const map = createDevMap();
    expect(map.light.length).toBe(256);
    const underLamp = map.light[3 * 16 + 3] ?? 0;
    const cornerOfRoom = map.light[1 * 16 + 1] ?? 0;
    expect(underLamp).toBe(255);
    expect(cornerOfRoom).toBeLessThan(underLamp);
    expect(cornerOfRoom).toBeGreaterThan(0);
  });

  it('setzt den Spieler auf eine begehbare Kachel', () => {
    const map = createDevMap();
    const index = map.spawn.pos.y * map.width + map.spawn.pos.x;
    expect(map.walls[index]).toBe(0);
  });

  it('laesst sich als Spielstand starten und bedienen', () => {
    const content = createDevContent();
    const state = createNewGame(DEV_SEED, content, DEV_MAP_ID);

    expect(state.currentMapId).toBe(DEV_MAP_ID);
    // Der Spieler startet auf (2,4) mit Blick nach Osten, vorn liegt freier Boden.
    const events = applyCommand(state, { type: 'move', dir: 'forward' }, content);
    expect(events.some((event) => event.type === 'moved')).toBe(true);
    expect(state.player.pos).toEqual({ x: 3, y: 4 });
  });

  it('oeffnet die Tuer per interact', () => {
    const content = createDevContent();
    const state = createNewGame(DEV_SEED, content, DEV_MAP_ID);
    applyCommand(state, { type: 'move', dir: 'forward' }, content);
    applyCommand(state, { type: 'move', dir: 'forward' }, content);

    const events = applyCommand(state, { type: 'interact' }, content);
    expect(events[0]).toMatchObject({ type: 'doorChanged', state: 'open' });
  });

  it('sammelt alle Frame- und Waffennamen fuer die Platzhalter ein', () => {
    const names = collectAssetNames(createDevContent());
    expect(names.spriteNames).toContain('grubling_idle_0');
    expect(names.spriteNames).toContain('sentry_death_1');
    expect(names.spriteNames).toContain('medkit');
    expect(names.weaponNames).toEqual(expect.arrayContaining(['cutter', 'bolter']));
  });
});
