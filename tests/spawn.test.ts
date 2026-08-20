/**
 * Ausgeruestete Gegner und ihre Hinterlassenschaft, PHASE_3_6 Block 6.
 */
import { describe, expect, it } from 'vitest';
import {
  EQUIPPED_BASE_CHANCE,
  EQUIPPED_CHANCE_PER_STEP,
  MAX_EQUIPPED_PER_MAP,
  dropLoot,
  equippedChanceFor,
  rollMapLoot,
} from '../src/core/spawn';
import { reapDead } from '../src/core/turn';
import { EQUIP_SLOTS } from '../src/core/types';
import type { Entity, MapEntityDef, MapRuntimeState } from '../src/core/types';
import { setup } from './fixtures/world';

/** `count` Gegner auf einer Kachel. Positionen spielen fuer den Wurf keine Rolle. */
function crowd(count: number, defId = 'grunt'): MapEntityDef[] {
  return Array.from({ length: count }, () => ({
    kind: 'enemy' as const,
    defId,
    pos: { x: 6, y: 6 },
  }));
}

function enemies(mapState: MapRuntimeState): Entity[] {
  return mapState.entities.filter((entity) => entity.kind === 'enemy');
}

function mapStateOf(state: { maps: Record<string, MapRuntimeState> }): MapRuntimeState {
  const mapState = state.maps['test'];
  if (mapState === undefined) throw new Error('kein Kartenzustand');
  return mapState;
}

describe('equippedChanceFor', () => {
  it('steigt je Schwierigkeitsgrad um vier Prozentpunkte', () => {
    expect(equippedChanceFor('normal')).toBeCloseTo(EQUIPPED_BASE_CHANCE, 10);
    expect(equippedChanceFor('hard')).toBeCloseTo(
      EQUIPPED_BASE_CHANCE + EQUIPPED_CHANCE_PER_STEP,
      10
    );
    expect(equippedChanceFor('nightmare')).toBeCloseTo(
      EQUIPPED_BASE_CHANCE + 2 * EQUIPPED_CHANCE_PER_STEP,
      10
    );
  });
});

describe('rollMapLoot', () => {
  // Test 13 aus PHASE_3_6
  it('laeuft nur einmal, ein zweiter Aufruf aendert nichts', () => {
    const { state, content, map } = setup({ entities: crowd(30), loot: true });
    expect(mapStateOf(state).rolled).toBe(true);

    const before = JSON.stringify(state);
    rollMapLoot(state, map, content);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('vergibt jedem Gegner einen Rang', () => {
    const { state } = setup({ entities: crowd(40), loot: true });
    for (const entity of enemies(mapStateOf(state))) {
      expect(['common', 'equipped', 'boss']).toContain(entity.rank);
    }
  });

  // Test 14 aus PHASE_3_6
  it('ruestet bei 200 Gegnern rund neun Prozent aus', () => {
    const { state } = setup({ entities: crowd(200), loot: true });
    const equipped = enemies(mapStateOf(state)).filter((e) => e.rank === 'equipped');

    // RPG.md Abschnitt 9 nennt neun Prozent, also einen Erwartungswert von 18
    // bei 200 Gegnern. Die Spanne 5 bis 40 deckt die Streuung sicher ab.
    // PHASE_3_6 nennt an dieser Stelle 40 bis 80, was zu den eigenen neun
    // Prozent nicht passt; RPG.md Abschnitt 9 ist laut SPEC 5 verbindlich.
    expect(equipped.length).toBeGreaterThanOrEqual(5);
    expect(equipped.length).toBeLessThanOrEqual(40);
    for (const entity of equipped) {
      const pieces = Object.keys(entity.equipment ?? {});
      expect(pieces.length).toBeGreaterThanOrEqual(1);
      expect(pieces.length).toBeLessThanOrEqual(2);
    }
  });

  it('ruestet auf nightmare mehr Gegner aus als auf normal', () => {
    const count = (difficulty: 'normal' | 'nightmare'): number => {
      const { state } = setup({ entities: crowd(400), loot: true, difficulty, seed: 7 });
      return enemies(mapStateOf(state)).filter((e) => e.rank === 'equipped').length;
    };
    expect(count('nightmare')).toBeGreaterThan(count('normal'));
  });

  it('gibt forceRank den Vorrang vor dem Wurf', () => {
    const { state } = setup({
      loot: true,
      entities: [
        { kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 }, forceRank: 'equipped' },
        { kind: 'enemy', defId: 'grunt', pos: { x: 4, y: 1 }, forceRank: 'boss' },
      ],
    });
    const [equipped, boss] = enemies(mapStateOf(state));

    expect(equipped?.rank).toBe('equipped');
    expect(Object.keys(equipped?.equipment ?? {}).length).toBeGreaterThanOrEqual(1);

    expect(boss?.rank).toBe('boss');
    const bossPieces = Object.values(boss?.equipment ?? {});
    expect(bossPieces.length).toBeGreaterThanOrEqual(2);
    expect(bossPieces.length).toBeLessThanOrEqual(4);
    expect(bossPieces.some((item) => item.rarity === 'unique')).toBe(true);
  });

  it('deckelt die ausgeruesteten Gegner je Sohle', () => {
    const forced: MapEntityDef[] = Array.from({ length: MAX_EQUIPPED_PER_MAP + 20 }, () => ({
      kind: 'enemy' as const,
      defId: 'grunt',
      pos: { x: 6, y: 6 },
      forceRank: 'equipped' as const,
    }));
    const { state } = setup({ entities: forced, loot: true });
    const list = enemies(mapStateOf(state));

    expect(list.filter((e) => e.rank === 'equipped')).toHaveLength(MAX_EQUIPPED_PER_MAP);
    expect(list.filter((e) => e.rank === 'common')).toHaveLength(20);
    // Nach dem Deckel bekommt niemand mehr Teile.
    for (const entity of list.filter((e) => e.rank === 'common')) {
      expect(entity.equipment).toBeUndefined();
    }
  });

  it('gibt nur Teile mit passender Stufe und ohne Spieleraffixe', () => {
    const { state, content } = setup({ entities: crowd(120), loot: true, depth: 4 });
    for (const entity of enemies(mapStateOf(state))) {
      for (const item of Object.values(entity.equipment ?? {})) {
        expect(item.itemLevel).toBe(entity.monsterLevel);
        for (const rolled of item.affixes) {
          const def = content.affixes[rolled.affixId];
          // Einzigartige tragen feste Listen, die duerfen alles.
          if (item.rarity === 'unique' || def === undefined) continue;
          expect(def.appliesTo).not.toBe('player');
        }
      }
    }
  });

  it('ruestet ohne Drop-Tabellen niemanden aus, vergibt aber Raenge', () => {
    const { state } = setup({ entities: crowd(50) });
    const list = enemies(mapStateOf(state));
    expect(list.every((entity) => entity.rank !== undefined)).toBe(true);
    expect(list.every((entity) => entity.equipment === undefined)).toBe(true);
  });
});

describe('dropLoot', () => {
  // Test 15 aus PHASE_3_6
  it('hinterlaesst genau die Teile, die der Gegner trug', () => {
    const { state, content } = setup({
      loot: true,
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 }, forceRank: 'equipped' }],
    });
    const mapState = mapStateOf(state);
    const entity = enemies(mapState)[0];
    if (entity === undefined) throw new Error('kein Gegner');

    const worn = EQUIP_SLOTS.map((slot) => entity.equipment?.[slot]).filter(
      (item) => item !== undefined
    );
    expect(worn.length).toBeGreaterThanOrEqual(1);

    entity.health = 0;
    const events = reapDead(state, mapState, content);

    expect(mapState.groundItems.map((entry) => entry.item.uid)).toEqual(
      worn.map((item) => item.uid)
    );
    for (const entry of mapState.groundItems) {
      expect(entry.pos).toEqual({ x: 3, y: 1 });
    }
    expect(events.filter((event) => event.type === 'itemDropped')).toHaveLength(worn.length);
    expect(mapState.entities).toHaveLength(0);
  });

  it('laesst gewoehnliche Gegner nichts fallen', () => {
    const { state, content } = setup({
      loot: true,
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 }, forceRank: 'common' }],
    });
    const mapState = mapStateOf(state);
    const entity = enemies(mapState)[0];
    if (entity === undefined) throw new Error('kein Gegner');

    entity.health = 0;
    expect(reapDead(state, mapState, content)).toEqual([]);
    expect(mapState.groundItems).toEqual([]);
  });

  it('legt die Stapelware aus drops auf die Kachel', () => {
    const { state, content } = setup({
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 3, y: 1 } }],
    });
    const mapState = mapStateOf(state);
    const entity = enemies(mapState)[0];
    if (entity === undefined) throw new Error('kein Gegner');

    const withDrops = {
      ...content,
      enemies: {
        ...content.enemies,
        grunt: { ...content.enemies['grunt'], drops: [{ defId: 'bullets', amount: 2, chance: 1 }] },
      },
    } as typeof content;

    dropLoot(state, mapState, entity, withDrops);

    const dropped = mapState.entities.filter((candidate) => candidate.kind === 'item');
    expect(dropped).toHaveLength(2);
    expect(dropped.every((candidate) => candidate.defId === 'bullets')).toBe(true);
    expect(new Set(dropped.map((candidate) => candidate.id)).size).toBe(2);
  });

  it('ignoriert Nicht-Gegner', () => {
    const { state, content } = setup({
      entities: [{ kind: 'door', defId: 'door', pos: { x: 3, y: 1 } }],
    });
    const mapState = mapStateOf(state);
    const door = mapState.entities[0];
    if (door === undefined) throw new Error('keine Tuer');

    expect(dropLoot(state, mapState, door, content)).toEqual([]);
  });
});
