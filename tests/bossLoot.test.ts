/**
 * Garantierte Bossbeute aus CONTENT_TABLES v1.1 Abschnitt 2.
 *
 * Die Zuordnung steht seit INTERFACES v1.6 als `EnemyDef.guaranteedUniqueId`
 * im Katalog, die Ausnahme vom Wurf als `UniqueDef.bossExclusive`.
 */
import { describe, expect, it } from 'vitest';
import { rollItem } from '../src/core/affixes';
import { dropLoot } from '../src/core/loot';
import { takeItemUid } from '../src/core/items';
import enemiesJson from '../content/enemies.json';
import { Rng } from '../src/core/rng';
import { reapDead } from '../src/core/turn';
import type {
  DropTableDef,
  EnemyDef,
  GameState,
  MapRuntimeState,
  Rarity,
} from '../src/core/types';
import { setup } from './fixtures/world';

const ENEMIES = enemiesJson as unknown as Record<string, EnemyDef>;

/** Die vier Zuordnungen aus CONTENT_TABLES Abschnitt 2, fest hinterlegt. */
const BOSS_UNIQUES: Record<string, string> = {
  boss_halvern: 'uq_halvern_visier',
  boss_sporemother: 'uq_sporenlunge',
  boss_rime: 'uq_frostkern',
  boss_sorlax: 'uq_sorlax_auge',
};

const UNIQUE_ONLY: DropTableDef = {
  id: 'unique_only',
  rarityWeights: { normal: 0, magic: 0, rare: 0, unique: 1 } as Record<Rarity, number>,
  slotWeights: { helmet: 1 },
};

function mapStateOf(state: GameState): MapRuntimeState {
  const mapState = state.maps['test'];
  if (mapState === undefined) throw new Error('kein Kartenzustand');
  return mapState;
}

describe('guaranteedUniqueId', () => {
  it('steht bei jedem der vier Bosse und bei sonst keinem Gegner', () => {
    for (const [bossId, uniqueId] of Object.entries(BOSS_UNIQUES)) {
      expect(ENEMIES[bossId]?.guaranteedUniqueId).toBe(uniqueId);
    }
    const others = Object.values(ENEMIES)
      .filter((def) => def.guaranteedUniqueId !== undefined)
      .map((def) => def.id)
      .filter((id) => BOSS_UNIQUES[id] === undefined);
    expect(others).toEqual([]);
  });
});

describe('bossExclusive', () => {
  it('trennt die vier Bossstuecke vom normalen Wurf', () => {
    const { content } = setup();
    expect(content.uniques['uq_frostkern']?.bossExclusive).toBe(true);
    expect(content.uniques['uq_stollenschritt']?.bossExclusive).toBe(false);
  });

  it('haelt die Bossstuecke aus rollItem heraus', () => {
    const { state, content } = setup();
    // helmet_visor traegt uq_halvern_visier. Es faellt nur beim Boss, also
    // weicht der Wurf auf `rare` aus, obwohl die Tabelle einzigartig verlangt.
    const item = rollItem(new Rng(5), 'helmet_visor', 30, UNIQUE_ONLY, content, false, takeItemUid(state));
    expect(item.rarity).toBe('rare');
  });
});

describe('Bosstod', () => {
  // Test 8 aus PHASE_5
  it('hinterlaesst das garantierte einzigartige Teil des Bosses', () => {
    const { state, content } = setup({
      loot: true,
      depth: 4,
      entities: [{ kind: 'enemy', defId: 'boss_halvern', pos: { x: 3, y: 1 }, forceRank: 'boss' }],
    });
    const mapState = mapStateOf(state);
    const boss = mapState.entities.find((entity) => entity.kind === 'enemy');
    if (boss === undefined) throw new Error('kein Boss');

    const unique = content.uniques['uq_halvern_visier'];
    expect(unique).toBeDefined();
    const worn = Object.values(boss.equipment ?? {});
    const guaranteed = worn.find((item) => item.baseId === unique?.baseId);
    expect(guaranteed?.rarity).toBe('unique');
    expect(guaranteed?.affixes).toEqual(unique?.affixes);

    boss.health = 0;
    reapDead(state, mapState, content);

    const onGround = mapState.groundItems.map((entry) => entry.item);
    expect(onGround.some((item) => item.uid === guaranteed?.uid)).toBe(true);
  });

  it('gibt jedem der vier Bosse sein eigenes Stueck', () => {
    for (const [bossId, uniqueId] of Object.entries(BOSS_UNIQUES)) {
      const { state, content } = setup({
        loot: true,
        depth: 16,
        entities: [{ kind: 'enemy', defId: bossId, pos: { x: 3, y: 1 }, forceRank: 'boss' }],
      });
      const boss = mapStateOf(state).entities.find((entity) => entity.kind === 'enemy');
      const baseId = content.uniques[uniqueId]?.baseId;
      const worn = Object.values(boss?.equipment ?? {});
      expect(worn.filter((item) => item.rarity === 'unique').map((item) => item.baseId)).toEqual([
        baseId,
      ]);
    }
  });
});

describe('Elementmunition', () => {
  /**
   * Karte mit einem toten Gegner der genannten Art. Die Wurfchance steht auf
   * 1.0, damit der Test den Tausch prueft und nicht den Zufall.
   */
  function fallen(defId: string) {
    const world = setup({ loot: true, entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }] });
    const real = ENEMIES[defId];
    if (real === undefined) throw new Error(`kein Katalogeintrag: ${defId}`);
    const sure: EnemyDef = {
      ...real,
      id: 'grunt',
      drops: (real.drops ?? []).map((drop) => ({ ...drop, chance: 1 })),
    };
    const content = { ...world.content, enemies: { ...world.content.enemies, grunt: sure } };
    const mapState = mapStateOf(world.state);
    const entity = mapState.entities.find((candidate) => candidate.kind === 'enemy');
    if (entity === undefined) throw new Error('kein Gegner');
    return { state: world.state, content, mapState, entity };
  }

  function droppedIds(mapState: MapRuntimeState): string[] {
    return mapState.entities
      .filter((entity) => entity.kind === 'item')
      .map((entity) => entity.defId);
  }

  it('ersetzt die Standardmunition, sobald der Spieler die Elementwaffe traegt', () => {
    const { state, content, mapState, entity } = fallen('miner_fire');
    state.player.weapons.push('w_lance');

    dropLoot(state, mapState, entity, content);

    // w_lance schiesst Feuer und verlangt `fuel`, also faellt ammo_fuel.
    expect(droppedIds(mapState)).toEqual(['ammo_fuel']);
  });

  it('laesst die Standardmunition liegen, solange die Waffe fehlt', () => {
    const { state, content, mapState, entity } = fallen('miner_fire');

    dropLoot(state, mapState, entity, content);

    expect(droppedIds(mapState)).toEqual(['ammo_pistol']);
  });

  it('tauscht bei einer physischen Variante nichts', () => {
    const { state, content, mapState, entity } = fallen('miner_physical');
    state.player.weapons.push('w_lance');

    dropLoot(state, mapState, entity, content);

    expect(droppedIds(mapState)).toEqual(['ammo_pistol']);
  });

  it('laesst Heilmittel unangetastet', () => {
    const { state, content, mapState, entity } = fallen('rat_fire');
    state.player.weapons.push('w_lance');

    dropLoot(state, mapState, entity, content);

    expect(droppedIds(mapState)).toEqual(['heal_small']);
  });
});
