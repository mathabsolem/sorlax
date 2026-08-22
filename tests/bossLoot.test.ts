/**
 * Garantierte Bossbeute aus CONTENT_TABLES Abschnitt 2, PHASE_5 Block 3 und 5.
 *
 * Die Zuordnung Boss zu einzigartigem Gegenstand liegt in src/core/bossLoot.ts,
 * weil `EnemyDef` dafuer kein Feld hat. Das ist als Vertragsluecke gemeldet.
 */
import { describe, expect, it } from 'vitest';
import { rollItem } from '../src/core/affixes';
import { BOSS_UNIQUES, bossUniqueId, isBossOnlyUnique } from '../src/core/bossLoot';
import { takeItemUid } from '../src/core/items';
import { Rng } from '../src/core/rng';
import { reapDead } from '../src/core/turn';
import type { DropTableDef, GameState, MapRuntimeState, Rarity } from '../src/core/types';
import { setup } from './fixtures/world';

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

describe('bossUniqueId', () => {
  it('kennt zu jedem der vier Bosse sein Stueck und sonst keines', () => {
    expect(bossUniqueId('boss_halvern')).toBe('uq_halvern_visier');
    expect(bossUniqueId('boss_sporemother')).toBe('uq_sporenlunge');
    expect(bossUniqueId('boss_rime')).toBe('uq_frostkern');
    expect(bossUniqueId('boss_sorlax')).toBe('uq_sorlax_auge');
    expect(bossUniqueId('rat_fire')).toBeUndefined();
    expect(Object.keys(BOSS_UNIQUES)).toHaveLength(4);
  });
});

describe('isBossOnlyUnique', () => {
  it('trennt die vier Bossstuecke vom normalen Wurf', () => {
    expect(isBossOnlyUnique('uq_frostkern')).toBe(true);
    expect(isBossOnlyUnique('uq_stollenschritt')).toBe(false);
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
