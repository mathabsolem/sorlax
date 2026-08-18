import { describe, expect, it, vi } from 'vitest';
import { InputGate } from '../src/input/gate';
import { attachKeyboard } from '../src/input/keyboard';
import type { Command } from '../src/core/types';

function keydown(target: EventTarget, key: string): void {
  const event = new Event('keydown', { cancelable: true });
  Object.assign(event, { key, repeat: false });
  target.dispatchEvent(event);
}

describe('InputGate', () => {
  it('reicht Kommandos durch, solange nichts animiert', () => {
    const run = vi.fn();
    const gate = new InputGate(() => false, run);
    gate.submit({ type: 'wait' });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('speichert genau ein Kommando waehrend der Sperre', () => {
    const run = vi.fn();
    let blocked = true;
    const gate = new InputGate(() => blocked, run);

    gate.submit({ type: 'move', dir: 'forward' });
    gate.submit({ type: 'move', dir: 'back' });
    gate.submit({ type: 'wait' });
    expect(run).not.toHaveBeenCalled();
    expect(gate.hasPending()).toBe(true);

    blocked = false;
    gate.flush();
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ type: 'move', dir: 'forward' });
    expect(gate.hasPending()).toBe(false);
  });

  it('haelt das gespeicherte Kommando zurueck, solange die Sperre steht', () => {
    const run = vi.fn();
    const gate = new InputGate(() => true, run);
    gate.submit({ type: 'wait' });
    gate.flush();
    expect(run).not.toHaveBeenCalled();
    expect(gate.hasPending()).toBe(true);
  });
});

describe('attachKeyboard', () => {
  it('uebersetzt Bewegung, Drehung und Aktionen nach SPEC 11', () => {
    const target = new EventTarget();
    const commands: Command[] = [];
    attachKeyboard(target, { onCommand: (cmd) => commands.push(cmd) });

    for (const key of ['w', 'ArrowDown', 'a', 'ArrowRight', 'q', 'e', ' ', 'f']) {
      keydown(target, key);
    }

    expect(commands).toEqual([
      { type: 'move', dir: 'forward' },
      { type: 'move', dir: 'back' },
      { type: 'move', dir: 'left' },
      { type: 'move', dir: 'right' },
      { type: 'turn', dir: 'ccw' },
      { type: 'turn', dir: 'cw' },
      { type: 'attack' },
      { type: 'interact' },
    ]);
  });

  it('loest Zifferntasten ueber den Waffen-Callback auf', () => {
    const target = new EventTarget();
    const commands: Command[] = [];
    attachKeyboard(target, {
      onCommand: (cmd) => commands.push(cmd),
      resolveWeapon: (slot) => (slot === 2 ? 'bolter' : null),
    });

    keydown(target, '2');
    keydown(target, '5');
    expect(commands).toEqual([{ type: 'switchWeapon', weaponId: 'bolter' }]);
  });

  it('meldet Karte und Menue ueber eigene Callbacks, nicht als Command', () => {
    const target = new EventTarget();
    const commands: Command[] = [];
    const onMap = vi.fn();
    const onMenu = vi.fn();
    attachKeyboard(target, { onCommand: (cmd) => commands.push(cmd), onMap, onMenu });

    keydown(target, 'Tab');
    keydown(target, 'Escape');
    expect(onMap).toHaveBeenCalledTimes(1);
    expect(onMenu).toHaveBeenCalledTimes(1);
    expect(commands).toEqual([]);
  });

  it('ignoriert unbekannte Tasten und meldet sich sauber ab', () => {
    const target = new EventTarget();
    const commands: Command[] = [];
    const detach = attachKeyboard(target, { onCommand: (cmd) => commands.push(cmd) });

    keydown(target, 'p');
    expect(commands).toEqual([]);

    detach();
    keydown(target, 'w');
    expect(commands).toEqual([]);
  });
});
