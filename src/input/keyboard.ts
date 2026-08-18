/**
 * Tastatursteuerung nach SPEC v1.1 Abschnitt 11.
 * Erzeugt nur Command-Objekte und reicht sie an einen Callback, kein Zugriff auf core.
 *
 * Karte und Menue sind laut SPEC kostenlose Ansichten und haben in INTERFACES
 * keine Command-Variante, deshalb laufen sie ueber eigene Callbacks.
 */
import type { Command } from '../core/types';

export type KeyboardHandlers = {
  onCommand: (cmd: Command) => void;
  onMap?: () => void;
  onMenu?: () => void;
  /** Liefert die Waffen-Id fuer die Zifferntasten 1 bis 9, sonst null. */
  resolveWeapon?: (slot: number) => string | null;
};

function commandFor(key: string, handlers: KeyboardHandlers): Command | null {
  switch (key) {
    case 'w':
    case 'ArrowUp':
      return { type: 'move', dir: 'forward' };
    case 's':
    case 'ArrowDown':
      return { type: 'move', dir: 'back' };
    case 'a':
    case 'ArrowLeft':
      return { type: 'move', dir: 'left' };
    case 'd':
    case 'ArrowRight':
      return { type: 'move', dir: 'right' };
    case 'q':
      return { type: 'turn', dir: 'ccw' };
    case 'e':
      return { type: 'turn', dir: 'cw' };
    case ' ':
      return { type: 'attack' };
    case 'f':
      return { type: 'interact' };
    default:
      break;
  }

  if (key >= '1' && key <= '9') {
    const weaponId = handlers.resolveWeapon?.(Number.parseInt(key, 10));
    if (weaponId !== null && weaponId !== undefined) {
      return { type: 'switchWeapon', weaponId };
    }
  }
  return null;
}

/** Haengt die Tastatur an ein Ziel und liefert die Abmeldefunktion zurueck. */
export function attachKeyboard(target: EventTarget, handlers: KeyboardHandlers): () => void {
  const listener = (raw: Event): void => {
    const event = raw as KeyboardEvent;
    if (event.repeat) return;

    if (event.key === 'Tab') {
      event.preventDefault();
      handlers.onMap?.();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      handlers.onMenu?.();
      return;
    }

    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const cmd = commandFor(key, handlers);
    if (cmd === null) return;
    event.preventDefault();
    handlers.onCommand(cmd);
  };

  target.addEventListener('keydown', listener);
  return () => target.removeEventListener('keydown', listener);
}
