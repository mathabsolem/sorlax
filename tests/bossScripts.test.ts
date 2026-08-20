/**
 * sporemother, rime und sorlax sowie der Determinismus des Bosskampfs.
 * Aus bosses.test.ts herausgeloest.
 */
import { describe, expect, it } from 'vitest';
import { takeEnemyTurn } from '../src/core/ai';
import { MAX_SPORES, SPORE_DEF_ID, liveSpores } from '../src/core/bosses/sporemother';
import { RIME_WALL_TILE } from '../src/core/bosses/rime';
import { PHASE_THREE_RATIO, PHASE_TWO_RATIO, targetPhase } from '../src/core/bosses/sorlax';
import { applyCommand } from '../src/core/commands';
import { enemyActor, getDerivedStats } from '../src/core/derived';
import { deserialize, serialize } from '../src/core/state';
import { advanceRound } from '../src/core/turn';
import type { ContentDb, Entity, GameState, MapEntityDef } from '../src/core/types';
import { setup } from './fixtures/world';

/** Welt mit einem Boss, der sofort wach ist und einen zaehen Spieler hat. */
function bossWorld(defId: string, pos: { x: number; y: number }, extra: MapEntityDef[] = []) {
  const world = setup({
    seed: 77,
    spawn: { pos: { x: 1, y: 1 }, facing: 1 },
    entities: [{ kind: 'enemy', defId, pos }, ...extra],
  });
  world.state.player.attributes.vitality = 200;
  world.state.player.health = 620;

  const boss = world.state.maps['test']?.entities[0];
  if (boss === undefined) throw new Error('kein Boss');
  boss.active = true;
  return { ...world, boss };
}

function chebyshevOf(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function maxHealthOf(state: GameState, content: ContentDb, entity: Entity): number {
  const actor = enemyActor(entity, content);
  if (actor === null) throw new Error('kein Akteur');
  return getDerivedStats(actor, content, state.difficulty).maxHealth;
}

describe('sporemother', () => {
  // Test 13 aus PHASE_3_7
  it('nimmt halben Schaden, solange ein Sporentraeger lebt', () => {
    const build = (withSpore: boolean) => {
      const extra: MapEntityDef[] = withSpore
        ? [{ kind: 'enemy', defId: SPORE_DEF_ID, pos: { x: 5, y: 5 } }]
        : [];
      const world = bossWorld('sporemother', { x: 2, y: 1 }, extra);
      world.state.player.attributes.agility = 200;
      takeEnemyTurn(world.state, world.boss, world.content);
      return world;
    };

    const guarded = build(true);
    expect(guarded.boss.scriptState?.['guarded']).toBe(1);
    const guardedBefore = guarded.boss.health ?? 0;
    applyCommand(guarded.state, { type: 'attack', targetId: guarded.boss.id }, guarded.content);
    const halved = guardedBefore - (guarded.boss.health ?? 0);

    const open = build(false);
    expect(open.boss.scriptState?.['guarded']).toBe(0);
    const openBefore = open.boss.health ?? 0;
    applyCommand(open.state, { type: 'attack', targetId: open.boss.id }, open.content);
    const full = openBefore - (open.boss.health ?? 0);

    expect(halved).toBe(Math.max(1, Math.floor(full / 2)));
    expect(full).toBeGreaterThan(halved);
  });

  // Test 14 aus PHASE_3_7
  it('erzeugt nie mehr als sechs lebende Sporentraeger', () => {
    const { state, content, boss } = bossWorld('sporemother', { x: 3, y: 3 });

    for (let round = 0; round < 40; round++) {
      takeEnemyTurn(state, boss, content);
      expect(liveSpores(state).length).toBeLessThanOrEqual(MAX_SPORES);
    }
    expect(liveSpores(state).length).toBe(MAX_SPORES);
  });

  it('bewegt sich nie', () => {
    const { state, content, boss } = bossWorld('sporemother', { x: 5, y: 5 });
    const start = { ...boss.pos };

    for (let round = 0; round < 12; round++) takeEnemyTurn(state, boss, content);

    expect(boss.pos).toEqual(start);
  });
});

describe('rime', () => {
  // Test 15 aus PHASE_3_7
  it('setzt unter 50 Prozent Leben genau vier Waende und keine auf besetzte Kacheln', () => {
    const { state, content, boss } = bossWorld('rime', { x: 4, y: 5 }, [
      { kind: 'enemy', defId: 'tank', pos: { x: 3, y: 5 } },
    ]);
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');
    boss.health = Math.floor(maxHealthOf(state, content, boss) * 0.4);
    state.turnCount = 10;

    takeEnemyTurn(state, boss, content);

    expect(mapState.tempWalls).toHaveLength(4);
    for (const wall of mapState.tempWalls) {
      expect(wall.tileValue).toBe(RIME_WALL_TILE);
      expect(wall.pos).not.toEqual(state.player.pos);
      expect(wall.pos).not.toEqual(boss.pos);
      expect(wall.pos).not.toEqual({ x: 3, y: 5 });
      expect(wall.expiresAtTurn).toBe(16);
    }
  });

  it('stellt bei vollem Leben keine Waende', () => {
    const { state, content, boss } = bossWorld('rime', { x: 4, y: 5 });
    state.turnCount = 10;

    takeEnemyTurn(state, boss, content);

    expect(state.maps['test']?.tempWalls).toEqual([]);
  });

  it('setzt sich bei Naehe auf ein freies Feld in Distanz 6 ab', () => {
    // Auf der 8 x 8 Karte gibt es keine Kachel in Distanz 6, deshalb der
    // offene Raum.
    const world = setup({
      seed: 77,
      size: 16,
      spawn: { pos: { x: 8, y: 8 }, facing: 1 },
      entities: [{ kind: 'enemy', defId: 'rime', pos: { x: 9, y: 8 } }],
    });
    world.state.player.attributes.vitality = 200;
    world.state.player.health = 620;
    const boss = world.state.maps['test']?.entities[0];
    if (boss === undefined) throw new Error('kein Boss');
    boss.active = true;
    world.state.turnCount = 20;

    const events = takeEnemyTurn(world.state, boss, world.content);

    expect(events.some((event) => event.type === 'moved')).toBe(true);
    expect(chebyshevOf(boss.pos, world.state.player.pos)).toBe(6);
    expect(boss.scriptState?.['lastBlink']).toBe(20);

    // Danach greift die Abklingzeit: kein zweiter Versatz in derselben Runde.
    const again = takeEnemyTurn(world.state, boss, world.content);
    expect(again.some((event) => event.type === 'message')).toBe(false);
  });

  it('geht auf Abstand, wenn der Spieler zu nah ist', () => {
    const { state, content, boss } = bossWorld('rime', { x: 3, y: 1 });
    const before = boss.pos.x;

    takeEnemyTurn(state, boss, content);

    expect(boss.pos.x).toBeGreaterThan(before);
  });
});

describe('sorlax', () => {
  // Test 16 aus PHASE_3_7
  it('wechselt bei 66 und 33 Prozent die Phase, hoechstens einmal je Runde', () => {
    const { state, content, boss } = bossWorld('sorlax', { x: 5, y: 1 });
    const maxHealth = maxHealthOf(state, content, boss);

    expect(targetPhase(1)).toBe(0);
    // Genau auf der Grenze zaehlt die naechste Phase, PHASE_3_7 Block 7.
    expect(targetPhase(PHASE_TWO_RATIO)).toBe(1);
    expect(targetPhase(PHASE_THREE_RATIO)).toBe(2);
    expect(targetPhase(0.2)).toBe(2);

    takeEnemyTurn(state, boss, content);
    expect(boss.scriptState?.['phase']).toBe(0);

    boss.health = Math.floor(maxHealth * 0.5);
    takeEnemyTurn(state, boss, content);
    expect(boss.scriptState?.['phase']).toBe(1);

    // Ein Sturz auf 10 Prozent springt trotzdem nur eine Stufe je Runde.
    boss.health = Math.floor(maxHealth * 0.1);
    takeEnemyTurn(state, boss, content);
    expect(boss.scriptState?.['phase']).toBe(2);
  });

  it('springt von voller Gesundheit auf einen Rest nur eine Stufe je Runde', () => {
    const { state, content, boss } = bossWorld('sorlax', { x: 5, y: 1 });
    boss.health = 1;

    takeEnemyTurn(state, boss, content);
    expect(boss.scriptState?.['phase']).toBe(1);
    takeEnemyTurn(state, boss, content);
    expect(boss.scriptState?.['phase']).toBe(2);
  });

  it('warnt in Phase 3 vor dem Strahl', () => {
    const { state, content, boss } = bossWorld('sorlax', { x: 5, y: 1 });
    boss.scriptState = { phase: 2 };

    const warning = takeEnemyTurn(state, boss, content);
    expect(warning.some((event) => event.type === 'message')).toBe(true);
    expect(warning.some((event) => event.type === 'attack')).toBe(false);

    const beam = takeEnemyTurn(state, boss, content);
    expect(beam.some((event) => event.type === 'attack')).toBe(true);
  });
});

describe('Determinismus des Bosskampfs', () => {
  // Test 17 aus PHASE_3_7, der wichtigste: er deckt Zustand in Modulvariablen auf.
  it('ist nach Serialisieren und Deserialisieren mitten im Kampf identisch', () => {
    const build = () => {
      const world = bossWorld('sorlax', { x: 5, y: 5 }, [
        { kind: 'enemy', defId: 'halvern', pos: { x: 2, y: 5 } },
        { kind: 'enemy', defId: 'sporemother', pos: { x: 6, y: 3 } },
        { kind: 'enemy', defId: 'rime', pos: { x: 6, y: 6 } },
      ]);
      const entities = world.state.maps['test']?.entities ?? [];
      for (const entity of entities) entity.active = true;

      // Angeschlagen starten, damit auch die spaeteren Zweige laufen:
      // Sorlax ruft Verstaerkung, rime stellt Waende, halvern stuermt kuerzer.
      const wound = (defId: string, ratio: number): void => {
        const entity = entities.find((candidate) => candidate.defId === defId);
        if (entity === undefined) throw new Error(`fehlt: ${defId}`);
        entity.health = Math.floor(maxHealthOf(world.state, world.content, entity) * ratio);
      };
      wound('sorlax', 0.5);
      wound('rime', 0.4);
      wound('halvern', 0.3);

      // Der Spieler muss die vollen 40 Runden ueberstehen, sonst laufen die
      // letzten Runden ins Leere und der Test prueft weniger als er soll.
      world.state.player.attributes.vitality = 1000;
      world.state.player.health = 3020;
      return world;
    };

    const run = (state: GameState, content: ContentDb, rounds: number): void => {
      for (let round = 0; round < rounds; round++) {
        if (state.player.health <= 0) break;
        advanceRound(state, content);
      }
    };

    // Durchgang A: 40 Runden am Stueck.
    const a = build();
    run(a.state, a.content, 40);

    // Durchgang B: 20 Runden, speichern, laden, 20 weitere.
    const b = build();
    run(b.state, b.content, 20);
    const midpoint = serialize(b.state);
    const resumed = deserialize(midpoint);
    run(resumed, b.content, 20);

    expect(serialize(resumed)).toBe(serialize(a.state));

    // Der Kampf muss wirklich stattgefunden haben, sonst ist der Test wertlos.
    expect(a.state.turnCount).toBe(40);
    expect(a.state.player.health).toBeGreaterThan(0);
    expect(midpoint).not.toBe(serialize(a.state));
    // Alle vier Skripte haben Zaehler gefuehrt, Verstaerkung ist erschienen.
    const entities = a.state.maps['test']?.entities ?? [];
    expect(entities.length).toBeGreaterThan(4);
    expect(entities.filter((entity) => entity.scriptState !== undefined).length).toBe(4);
  });
});
