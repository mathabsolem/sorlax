/**
 * Tastatursteuerung nach SPEC v1.2 Abschnitt 12.
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
  /** Vollstaendiges Meldungsprotokoll. */
  onLog?: () => void;
  /** Inventar und Fertigkeitenbaum kommen in Phase 4.5. */
  onInventory?: () => void;
  onSkills?: () => void;
  /** Liefert die Waffen-Id fuer die Zifferntasten 1 bis 9, sonst null. */
  resolveWeapon?: (slot: number) => string | null;
  /** Liefert die Fertigkeit fuer F1 bis F6, sonst null. */
  resolveSkill?: (slot: number) => string | null;
  /** F7 schaltet die Helligkeitsansicht, F8 die Kacheldrehung. */
  onToggleDebug?: (view: 'light' | 'rotation') => void;
};

/** F1 bis F6 belegen die Fertigkeitsleiste, SPEC Abschnitt 12. */
function skillSlotFor(key: string): number | null {
  if (!/^F[1-6]$/.test(key)) return null;
  return Number.parseInt(key.slice(1), 10);
}

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

  const slot = skillSlotFor(key);
  if (slot !== null) {
    const skillId = handlers.resolveSkill?.(slot);
    if (skillId !== null && skillId !== undefined) return { type: 'useSkill', skillId };
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
    if (event.key === 'i' || event.key === 'I') {
      event.preventDefault();
      handlers.onInventory?.();
      return;
    }
    if (event.key === 'k' || event.key === 'K') {
      event.preventDefault();
      handlers.onSkills?.();
      return;
    }
    if (event.key === 'l' || event.key === 'L') {
      event.preventDefault();
      handlers.onLog?.();
      return;
    }
    if (event.key === 'F7' || event.key === 'F8') {
      event.preventDefault();
      handlers.onToggleDebug?.(event.key === 'F7' ? 'light' : 'rotation');
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
