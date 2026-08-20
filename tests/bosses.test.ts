/**
 * Bossgeruest und die vier Bossskripte, PHASE_3_7 Bloecke 6 und 7.
 */
import { describe, expect, it } from 'vitest';
import { takeEnemyTurn } from '../src/core/ai';
import { BOSS_REGISTRY } from '../src/core/bosses/registry';
import { halvernHandler } from '../src/core/bosses/halvern';
import { rimeHandler } from '../src/core/bosses/rime';
import { sorlaxHandler } from '../src/core/bosses/sorlax';
import { sporemotherHandler } from '../src/core/bosses/sporemother';
import { enemyActor, getDerivedStats } from '../src/core/derived';
import { freeTilesAround, spawnEnemy } from '../src/core/spawn';
import type { ContentDb, Entity, GameState, MapEntityDef } from '../src/core/types';
import { setup } from './fixtures/world';

/** Welt mit einem Boss, der sofort wach ist und einen zaehen Spieler hat. */
function bossWorld(defId: string, pos: { x: number; y: number }, extra: MapEntityDef[] = []) {
  const world = setup({
    seed: 77,
    spawn: { pos: { x: 1, y: 1 }, facing: 1 },
    entities: [{ kind: 'enemy', defId, pos }, ...extra],
  });
  // Genug Leben, damit der Bosskampf nicht vorzeitig endet.
  world.state.player.attributes.vitality = 200;
  world.state.player.health = 620;

  const boss = world.state.maps['test']?.entities[0];
  if (boss === undefined) throw new Error('kein Boss');
  boss.active = true;
  return { ...world, boss };
}

function maxHealthOf(state: GameState, content: ContentDb, entity: Entity): number {
  const actor = enemyActor(entity, content);
  if (actor === null) throw new Error('kein Akteur');
  return getDerivedStats(actor, content, state.difficulty).maxHealth;
}

describe('Bossgeruest', () => {
  it('kennt genau die vier Skripte und verdrahtet sie richtig', () => {
    expect(Object.keys(BOSS_REGISTRY).sort()).toEqual([
      'halvern',
      'rime',
      'sorlax',
      'sporemother',
    ]);
    expect(BOSS_REGISTRY['halvern']).toBe(halvernHandler);
    expect(BOSS_REGISTRY['rime']).toBe(rimeHandler);
    expect(BOSS_REGISTRY['sorlax']).toBe(sorlaxHandler);
    expect(BOSS_REGISTRY['sporemother']).toBe(sporemotherHandler);
  });

  // Test 18 aus PHASE_3_7
  it('meldet einen fehlenden Skripteintrag, statt abzustuerzen', () => {
    const { state, content, boss } = bossWorld('ghost_script', { x: 4, y: 1 });

    const events = takeEnemyTurn(state, boss, content);

    expect(events).toEqual([{ type: 'message', text: 'no boss script: gibtsnicht' }]);
    expect(state.player.health).toBe(620);
  });

  it('meldet auch einen Gegner ohne scriptId', () => {
    const { state, content, boss } = bossWorld('no_script', { x: 4, y: 1 });

    expect(takeEnemyTurn(state, boss, content)).toEqual([
      { type: 'message', text: 'scripted enemy without scriptId: no_script' },
    ]);
  });
});

describe('spawnEnemy und freeTilesAround', () => {
  it('setzt einen Gegner und lehnt besetzte oder solide Kacheln ab', () => {
    const { state, content } = setup();

    const spawned = spawnEnemy(state, 'grunt', { x: 4, y: 1 }, content);
    expect(spawned?.defId).toBe('grunt');
    expect(spawned?.active).toBe(true);
    expect(state.maps['test']?.entities).toHaveLength(1);

    expect(spawnEnemy(state, 'grunt', { x: 4, y: 1 }, content)).toBeNull();
    expect(spawnEnemy(state, 'grunt', { x: 0, y: 0 }, content)).toBeNull();
    expect(spawnEnemy(state, 'grunt', { x: 1, y: 1 }, content)).toBeNull();
    expect(spawnEnemy(state, 'gibtsnicht', { x: 5, y: 1 }, content)).toBeNull();
  });

  it('sortiert freie Kacheln nach Distanz, dann x, dann y', () => {
    const { state, content } = setup();
    const tiles = freeTilesAround(state, { x: 3, y: 3 }, 1, content);

    // Alle vier liegen in Distanz 1, also entscheidet x, dann y.
    expect(tiles).toEqual([
      { x: 2, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 2 },
      { x: 4, y: 3 },
    ]);
    // Die Pfeiler auf (3,2), (2,2), (2,4) und (4,4) fehlen erwartungsgemaess.
    expect(tiles).not.toContainEqual({ x: 3, y: 2 });
  });
});

describe('halvern', () => {
  // Test 12 aus PHASE_3_7
  it('wechselt nach drei Runden Ansturm in die Flammenwand und nach zwei zurueck', () => {
    const { state, content, boss } = bossWorld('boss_halvern', { x: 5, y: 1 });

    for (let round = 0; round < 3; round++) takeEnemyTurn(state, boss, content);
    expect(boss.scriptState?.['phase']).toBe(1);

    const wall = takeEnemyTurn(state, boss, content);
    expect(wall.some((event) => event.type === 'message')).toBe(true);
    takeEnemyTurn(state, boss, content);
    expect(boss.scriptState?.['phase']).toBe(0);
  });

  it('stuermt zwei Schritte je Aktion', () => {
    const { state, content, boss } = bossWorld('boss_halvern', { x: 6, y: 1 });
    const before = boss.pos.x;

    takeEnemyTurn(state, boss, content);

    expect(before - boss.pos.x).toBe(2);
  });

  it('verkuerzt den Ansturm unter 40 Prozent Leben', () => {
    const { state, content, boss } = bossWorld('boss_halvern', { x: 5, y: 1 });
    boss.health = Math.floor(maxHealthOf(state, content, boss) * 0.3);

    for (let round = 0; round < 2; round++) takeEnemyTurn(state, boss, content);
    expect(boss.scriptState?.['phase']).toBe(1);
  });
});
