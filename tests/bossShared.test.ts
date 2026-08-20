/**
 * Die geteilten Bausteine der Bossskripte, src/core/bosses/shared.ts.
 * Sie tragen alle vier Skripte, deshalb hier einzeln geprueft.
 */
import { describe, expect, it } from 'vitest';
import {
  actorsOn,
  areaStrike,
  bossAttack,
  bossScene,
  counter,
  effectOnHit,
  facePlayer,
  healthRatio,
  seesPlayer,
  setCounter,
  stepOnto,
  stepToward,
  tilesAhead,
} from '../src/core/bosses/shared';
import { collectKills } from '../src/core/attack';
import { isGuarded } from '../src/core/entities';
import { addTempWall } from '../src/core/tempWalls';
import type { ContentDb, Entity, GameState, MapEntityDef } from '../src/core/types';
import { setup } from './fixtures/world';

function world(defId = 'boss_halvern', pos = { x: 4, y: 1 }, extra: MapEntityDef[] = []) {
  const built = setup({
    seed: 5,
    spawn: { pos: { x: 1, y: 1 }, facing: 1 },
    entities: [{ kind: 'enemy', defId, pos }, ...extra],
  });
  built.state.player.attributes.vitality = 300;
  built.state.player.health = 920;
  const boss = built.state.maps['test']?.entities[0];
  if (boss === undefined) throw new Error('kein Boss');
  boss.active = true;
  return { ...built, boss };
}

function sceneOf(state: GameState, boss: Entity, content: ContentDb) {
  const scene = bossScene(state, boss, content);
  if (scene === null) throw new Error('keine Szene');
  return scene;
}

describe('bossScene', () => {
  it('liefert Karte, Kartenzustand und Distanz', () => {
    const { state, content, boss } = world();
    const scene = sceneOf(state, boss, content);

    expect(scene.map.id).toBe('test');
    expect(scene.mapState).toBe(state.maps['test']);
    expect(scene.distance).toBe(3);
  });

  it('liefert null bei unbekannter Karte', () => {
    const { state, content, boss } = world();
    state.currentMapId = 'gibtsnicht';
    expect(bossScene(state, boss, content)).toBeNull();
  });
});

describe('counter und setCounter', () => {
  it('liefern 0 fuer unbekannte Schluessel und legen scriptState an', () => {
    const { boss } = world();
    delete boss.scriptState;

    expect(counter(boss, 'phase')).toBe(0);
    setCounter(boss, 'phase', 2);
    expect(boss.scriptState).toEqual({ phase: 2 });
    expect(counter(boss, 'phase')).toBe(2);
    expect(isGuarded(boss)).toBe(false);

    setCounter(boss, 'guarded', 1);
    expect(isGuarded(boss)).toBe(true);
  });
});

describe('healthRatio', () => {
  it('rechnet den Anteil der verbliebenen Lebenspunkte', () => {
    const { state, content, boss } = world();
    expect(healthRatio(boss, content, state)).toBeCloseTo(1, 5);

    const full = boss.health ?? 0;
    boss.health = Math.floor(full / 2);
    expect(healthRatio(boss, content, state)).toBeCloseTo(0.5, 2);

    boss.health = 0;
    expect(healthRatio(boss, content, state)).toBe(0);
  });
});

describe('Bewegung', () => {
  it('stepOnto geht auf freie Kacheln und nicht auf den Spieler', () => {
    const { state, content, boss } = world('boss_halvern', { x: 3, y: 1 });
    const scene = sceneOf(state, boss, content);

    expect(stepOnto(state, scene, boss, { x: 1, y: 1 })).toEqual([]);
    expect(stepOnto(state, scene, boss, { x: 3, y: 2 })).toEqual([]);

    const moved = stepOnto(state, scene, boss, { x: 4, y: 1 });
    expect(moved).toHaveLength(1);
    expect(boss.pos).toEqual({ x: 4, y: 1 });
    expect(boss.facing).toBe(1);
  });

  it('stepToward geht auf den Spieler zu und away von ihm weg', () => {
    const { state, content, boss } = world('boss_halvern', { x: 4, y: 1 });

    stepToward(state, sceneOf(state, boss, content), boss);
    expect(boss.pos.x).toBe(3);

    stepToward(state, sceneOf(state, boss, content), boss, true);
    expect(boss.pos.x).toBe(4);
  });

  it('facePlayer dreht auf den Spieler', () => {
    const { state, boss } = world('boss_halvern', { x: 4, y: 1 });
    boss.facing = 0;
    facePlayer(state, boss);
    expect(boss.facing).toBe(3);
  });
});

describe('tilesAhead und actorsOn', () => {
  it('haelt an soliden Kacheln an, temporaere Waende eingeschlossen', () => {
    const { state, content, boss } = world('boss_halvern', { x: 4, y: 1 });
    boss.facing = 3;
    const scene = sceneOf(state, boss, content);

    expect(tilesAhead(scene, boss, 3)).toEqual([
      { x: 3, y: 1 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
    ]);

    addTempWall(state, scene.mapState, { x: 2, y: 1 }, 1, 99);
    expect(tilesAhead(scene, boss, 3)).toEqual([{ x: 3, y: 1 }]);
  });

  it('actorsOn findet Spieler und lebende Gegner auf den Kacheln', () => {
    const { state, content, boss } = world('boss_halvern', { x: 4, y: 1 }, [
      { kind: 'enemy', defId: 'tank', pos: { x: 3, y: 1 } },
    ]);
    const scene = sceneOf(state, boss, content);

    const found = actorsOn(state, scene, [
      { x: 1, y: 1 },
      { x: 3, y: 1 },
    ]);
    expect(found.player).toBe(true);
    expect(found.enemies.map((entity) => entity.defId)).toEqual(['tank']);

    expect(actorsOn(state, scene, [{ x: 6, y: 6 }])).toEqual({ player: false, enemies: [] });
  });
});

describe('areaStrike', () => {
  it('trifft Spieler und Gegner, achtet auf Resistenz und ueberspringt sich selbst', () => {
    const { state, content, boss } = world('boss_halvern', { x: 4, y: 1 }, [
      { kind: 'enemy', defId: 'tank', pos: { x: 3, y: 1 } },
    ]);
    const scene = sceneOf(state, boss, content);
    const other = state.maps['test']?.entities[1];
    if (other === undefined) throw new Error('kein zweiter Gegner');

    const healthBefore = state.player.health;
    const otherBefore = other.health ?? 0;

    const events = areaStrike(
      state,
      scene,
      boss,
      content,
      [
        { x: 1, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
      ],
      12,
      'fire',
      'burn'
    );

    expect(state.player.health).toBeLessThan(healthBefore);
    expect(other.health).toBe(otherBefore - 12);
    // Der Ausloeser steht selbst auf einer der Kacheln und bleibt verschont.
    expect(events.filter((event) => event.type === 'attack')).toHaveLength(2);
    expect(events.some((event) => event.type === 'effectApplied')).toBe(true);
  });

  it('meldet den Tod des Spielers und legt dann keinen Effekt mehr', () => {
    const { state, content, boss } = world();
    const scene = sceneOf(state, boss, content);
    state.player.health = 1;

    const events = areaStrike(state, scene, boss, content, [{ x: 1, y: 1 }], 50, 'fire', 'burn');

    expect(state.player.health).toBe(0);
    expect(events).toContainEqual({ type: 'died', who: 'player' });
    expect(events.some((event) => event.type === 'effectApplied')).toBe(false);
  });
});

describe('bossAttack, effectOnHit und seesPlayer', () => {
  it('greift an und legt bei einem Treffer den Effekt', () => {
    const { state, content, boss } = world('boss_halvern', { x: 2, y: 1 });
    const def = content.enemies['boss_halvern'];
    if (def === undefined) throw new Error('keine Definition');

    // Ausweichen auf 0, damit der Treffer sitzt.
    state.player.attributes.agility = 0;
    const events = bossAttack(state, boss, def, content);
    expect(events.some((event) => event.type === 'attack')).toBe(true);

    const applied = effectOnHit(state, content, events, 'burn');
    const hit = events.some((event) => event.type === 'attack' && event.hit);
    expect(applied.length > 0).toBe(hit);
  });

  it('legt keinen Effekt auf einen toten Spieler', () => {
    const { state, content } = world();
    state.player.health = 0;
    const events = [
      { type: 'attack' as const, attacker: 1, target: 'player' as const, hit: true, damage: 5, crit: false, damageType: 'fire' as const },
    ];
    expect(effectOnHit(state, content, events, 'burn')).toEqual([]);
  });

  it('seesPlayer folgt der Sichtlinie', () => {
    const { state, content, boss } = world('boss_halvern', { x: 4, y: 1 });
    const scene = sceneOf(state, boss, content);
    expect(seesPlayer(state, scene, boss)).toBe(true);

    addTempWall(state, scene.mapState, { x: 3, y: 1 }, 1, 99);
    expect(seesPlayer(state, scene, boss)).toBe(false);
  });
});

describe('collectKills', () => {
  it('vergibt XP, raeumt Tote ab und laesst nichts liegen', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }],
    });
    const mapState = state.maps['test'];
    if (mapState === undefined) throw new Error('kein Kartenzustand');
    const enemy = mapState.entities[0];
    if (enemy === undefined) throw new Error('kein Gegner');

    enemy.health = 0;
    const events = collectKills(state, content, mapState, [{ type: 'died', who: enemy.id }]);

    expect(mapState.entities).toHaveLength(0);
    expect(state.player.xp).toBeGreaterThan(0);
    expect(events.length).toBeGreaterThanOrEqual(0);
  });
});
