/**
 * Schluessel werden beim Oeffnen verbraucht, CONTENT_TABLES v1.2 Abschnitt 7.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import type { GameState } from '../src/core/types';
import { setup } from './fixtures/world';

/**
 * Zwei verriegelte Tueren derselben Farbe, beide vom Start aus erreichbar.
 * Der Spieler schaut nach Osten auf die erste.
 */
function twoDoors() {
  const world = setup({
    spawn: { pos: { x: 1, y: 1 }, facing: 1 },
    entities: [
      { kind: 'door', defId: 'door', pos: { x: 2, y: 1 }, locked: 'key_red' },
      { kind: 'door', defId: 'door', pos: { x: 1, y: 2 }, locked: 'key_red' },
    ],
  });
  return world;
}

function doorState(state: GameState, x: number, y: number): string | undefined {
  return state.maps['test']?.entities.find(
    (entity) => entity.kind === 'door' && entity.pos.x === x && entity.pos.y === y
  )?.state;
}

describe('verriegelte Tueren', () => {
  // Test 1 aus PHASE_6_5
  it('verbrauchen die Schluesselfarbe beim Oeffnen', () => {
    const { state, content } = twoDoors();
    state.player.keys.push('key_red');

    const events = applyCommand(state, { type: 'interact' }, content);

    expect(events).toContainEqual({
      type: 'doorChanged',
      pos: { x: 2, y: 1 },
      state: 'open',
    });
    expect(state.player.keys).toEqual([]);
  });

  // Test 2 aus PHASE_6_5
  it('lassen sich mit demselben Schluessel kein zweites Mal oeffnen', () => {
    const { state, content } = twoDoors();
    state.player.keys.push('key_red');

    applyCommand(state, { type: 'interact' }, content);
    expect(doorState(state, 2, 1)).toBe('open');

    // Jetzt nach Sueden auf die zweite Tuer drehen.
    applyCommand(state, { type: 'turn', dir: 'cw' }, content);
    const events = applyCommand(state, { type: 'interact' }, content);

    expect(events).toContainEqual({
      type: 'doorChanged',
      pos: { x: 1, y: 2 },
      state: 'blocked',
    });
    expect(doorState(state, 1, 2)).toBe('locked');
  });

  it('bleiben ohne Schluessel zu und verbrauchen nichts', () => {
    const { state, content } = twoDoors();
    state.player.keys.push('key_green');

    applyCommand(state, { type: 'interact' }, content);

    expect(doorState(state, 2, 1)).toBe('locked');
    expect(state.player.keys).toEqual(['key_green']);
  });
});
