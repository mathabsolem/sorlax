/**
 * Reine Berechnungen des HUD, PHASE_4 Block 2 und 3.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import { getDerivedStats, enemyActor } from '../src/core/derived';
import {
  SKILL_SLOTS,
  effectChips,
  formatHealth,
  hudModel,
  skillBar,
  skillSlotState,
  targetModel,
  weaponLine,
  xpProgress,
} from '../src/ui/hudModel';
import { knownResistanceKey, knowsResistance, learnResistance } from '../src/core/knowledge';
import { deserialize, serialize } from '../src/core/state';
import { equipWeapon, giveWeapon, setup } from './fixtures/world';

describe('formatHealth', () => {
  // Test 1 aus PHASE_4
  it('liefert Text und Anteil auf drei Stellen', () => {
    expect(formatHealth(37, 120)).toEqual({ text: '37 / 120', ratio: 0.308 });
  });

  it('deckelt ausserhalb der Grenzen und faengt maxHealth 0 ab', () => {
    expect(formatHealth(150, 100).ratio).toBe(1);
    expect(formatHealth(-5, 100).ratio).toBe(0);
    expect(formatHealth(5, 0).ratio).toBe(0);
  });
});

describe('xpProgress', () => {
  // Test 2 aus PHASE_4
  it('liefert bei 40 Prozent zwischen zwei Schwellen genau 0.4', () => {
    // Schwellen sind Gesamtwerte: Stufe 5 liegt zwischen dem vierten und
    // dem fuenften Eintrag.
    const progression = { xpThresholds: [100, 200, 300, 400, 500, 600] };
    const previous = 400;
    const next = 500;
    const xp = previous + (next - previous) * 0.4;

    expect(xpProgress(5, xp, progression)).toBe(0.4);
  });

  it('startet auf Stufe 1 bei null und endet auf der Hoechststufe bei eins', () => {
    const progression = { xpThresholds: [100, 200] };
    expect(xpProgress(1, 0, progression)).toBe(0);
    expect(xpProgress(1, 40, progression)).toBe(0.4);
    // Ohne weitere Schwelle gilt der Balken als voll.
    expect(xpProgress(9, 0, progression)).toBe(1);
  });
});

describe('skillSlotState', () => {
  // Test 3 aus PHASE_4
  it('meldet bei Abklingzeit 3 gesperrt mit Rest 3 und bei 0 bereit', () => {
    const { content } = setup();
    const breach = content.skills['breach'];
    if (breach === undefined) throw new Error('kein breach');

    expect(skillSlotState(breach, 3)).toEqual({
      skillId: 'breach',
      name: breach.name,
      state: 'cooling',
      remaining: 3,
    });
    expect(skillSlotState(breach, 0)).toEqual({
      skillId: 'breach',
      name: breach.name,
      state: 'ready',
      remaining: 0,
    });
  });
});

describe('skillBar', () => {
  it('zeigt nur gelernte, aktive und nicht gesperrte Fertigkeiten', () => {
    const { state, content } = setup();
    state.player.skills = {
      breach: 2,
      sweep: 1,
      precise_strike: 3, // passiv
      last_stand: 4, // gesperrt
      heavy_hand: 0, // gelernt, aber ohne Punkte
    };
    state.player.cooldowns = { breach: 2 };

    const bar = skillBar(state, content);

    expect(bar.map((slot) => slot.skillId)).toEqual(['breach', 'sweep']);
    expect(bar[0]?.state).toBe('cooling');
    expect(bar[0]?.remaining).toBe(2);
    expect(bar[1]?.state).toBe('ready');
    expect(bar.length).toBeLessThanOrEqual(SKILL_SLOTS);
  });
});

describe('effectChips', () => {
  it('haelt die feste Reihenfolge aus SPEC 4.5 ein', () => {
    const chips = effectChips([
      { id: 'jolt', remainingTurns: 2, magnitude: 8, sourceType: 'shock' },
      { id: 'burn', remainingTurns: 3, magnitude: 4, sourceType: 'fire' },
      { id: 'drain', remainingTurns: 1, magnitude: 15, sourceType: 'void' },
      { id: 'toxin', remainingTurns: 0, magnitude: 2, sourceType: 'poison' },
    ]);

    // burn, toxin, drain, chill, jolt; abgelaufene fallen weg.
    expect(chips.map((chip) => chip.id)).toEqual(['burn', 'drain', 'jolt']);
    expect(chips[0]).toEqual({ id: 'burn', remaining: 3, sourceType: 'fire' });
  });
});

describe('weaponLine', () => {
  it('zeigt bei Nahkampf einen Strich und sonst den Munitionsstand', () => {
    const { state, content } = setup();
    expect(weaponLine(state, content)).toEqual({ name: 'Brechstange', ammo: '—' });

    giveWeapon(state, content, 'pistol');
    equipWeapon(state, content, 'pistol');
    state.player.ammo['bullets'] = 12;
    expect(weaponLine(state, content)).toEqual({ name: 'Pistol', ammo: '12' });
  });
});

describe('hudModel', () => {
  it('fasst alle Anzeigewerte in einem Durchgang zusammen', () => {
    const { state, content, map } = setup();
    const model = hudModel(state, content);

    expect(model.health).toEqual({ text: '50 / 50', ratio: 1 });
    expect(model.armor).toBe(0);
    expect(model.level).toBe(1);
    expect(model.xpRatio).toBe(0);
    expect(model.skills).toEqual([]);
    expect(model.turnCount).toBe(0);
    expect(model.mapName).toBe(map.name);
    expect(model.weapon.name).toBe('Brechstange');
  });
});

describe('targetModel', () => {
  function targetWorld() {
    const world = setup({
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
      entities: [{ kind: 'enemy', defId: 'grunt', pos: { x: 2, y: 1 }, forceRank: 'equipped' }],
    });
    const entity = world.state.maps['test']?.entities[0];
    if (entity === undefined) throw new Error('kein Gegner');
    const actor = enemyActor(entity, world.content);
    if (actor === null) throw new Error('kein Akteur');
    const stats = getDerivedStats(actor, world.content, world.state.difficulty);
    return { ...world, entity, stats };
  }

  it('liefert Name, Leben, Rang und Element', () => {
    const { state, content, entity, stats } = targetWorld();
    const model = targetModel(state, content, entity, stats);

    expect(model?.name).toBe('grunt');
    expect(model?.rank).toBe('equipped');
    expect(model?.element).toBe('physical');
    expect(model?.health.ratio).toBe(1);
  });

  it('zeigt Resistenzen erst nach einem eigenen Treffer', () => {
    const { state, content, entity, stats } = targetWorld();
    expect(targetModel(state, content, entity, stats)?.knownResistances).toEqual([]);

    state.flags[knownResistanceKey('grunt', 'physical')] = true;

    expect(targetModel(state, content, entity, stats)?.knownResistances).toEqual([
      { type: 'physical', value: 0 },
    ]);
  });

  it('liefert null fuer eine unbekannte Definition', () => {
    const { state, content, entity, stats } = targetWorld();
    entity.defId = 'gibtsnicht';
    expect(targetModel(state, content, entity, stats)).toBeNull();
  });

  it('bleibt vom Kampf unberuehrt: die Oberflaeche mutiert nichts', () => {
    const { state, content, entity, stats } = targetWorld();
    const before = JSON.stringify(state);

    targetModel(state, content, entity, stats);
    hudModel(state, content);

    expect(JSON.stringify(state)).toBe(before);
    // Zum Vergleich: erst ein Kommando aendert den Zustand.
    applyCommand(state, { type: 'turn', dir: 'cw' }, content);
    expect(JSON.stringify(state)).not.toBe(before);
  });
});

describe('learnResistance', () => {
  it('merkt sich einen eigenen Treffer und meldet nur das erste Mal true', () => {
    const { state } = setup();

    expect(knowsResistance(state, 'grunt', 'fire')).toBe(false);
    expect(learnResistance(state, 'grunt', 'fire')).toBe(true);
    expect(learnResistance(state, 'grunt', 'fire')).toBe(false);
    expect(knowsResistance(state, 'grunt', 'fire')).toBe(true);
    // Andere Schadensarten und andere Gegner bleiben unbekannt.
    expect(knowsResistance(state, 'grunt', 'ice')).toBe(false);
    expect(knowsResistance(state, 'runner', 'fire')).toBe(false);
  });

  it('wird durch einen Treffer im Kampf gesetzt', () => {
    const { state, content } = setup({
      seed: 4,
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
      entities: [{ kind: 'enemy', defId: 'tank', pos: { x: 2, y: 1 } }],
    });
    state.player.attributes.agility = 200;

    expect(knowsResistance(state, 'tank', 'physical')).toBe(false);
    applyCommand(state, { type: 'attack' }, content);
    expect(knowsResistance(state, 'tank', 'physical')).toBe(true);
  });

  it('ueberlebt Speichern und Laden, weil es in flags liegt', () => {
    const { state } = setup();
    learnResistance(state, 'grunt', 'poison');
    const restored = deserialize(serialize(state));
    expect(knowsResistance(restored, 'grunt', 'poison')).toBe(true);
  });
});
