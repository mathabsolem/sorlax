/**
 * Touchsteuerung als DOM-Elemente ueber dem Canvas, nicht in das Bild gezeichnet.
 * Erzeugt nur Command-Objekte, kein Zugriff auf core.
 *
 * Flaechen mindestens 56 x 56 CSS-Pixel, Positionierung mit den Safe-Area-Insets.
 * Die Stile stehen seit Phase 4 in src/ui/ui.css, nicht mehr hier.
 */
import type { Command } from '../core/types';

export type TouchHandlers = {
  onCommand: (cmd: Command) => void;
  /** Tippen in das Bild, etwa zum Setzen eines Ziels. */
  onPick?: (clientX: number, clientY: number) => void;
};

type ButtonSpec = { label: string; left?: string; right?: string; bottom: string; cmd: Command };

const DPAD_LEFT = 'calc(16px + env(safe-area-inset-left))';
const TURN_LEFT = 'calc(148px + env(safe-area-inset-left))';
const ACTION_RIGHT = 'calc(16px + env(safe-area-inset-right))';
const BOTTOM_0 = 'calc(16px + env(safe-area-inset-bottom))';
const BOTTOM_1 = 'calc(76px + env(safe-area-inset-bottom))';
const BOTTOM_2 = 'calc(136px + env(safe-area-inset-bottom))';

const BUTTONS: ButtonSpec[] = [
  { label: '▲', left: 'calc(76px + env(safe-area-inset-left))', bottom: BOTTOM_2, cmd: { type: 'move', dir: 'forward' } },
  { label: '◀', left: DPAD_LEFT, bottom: BOTTOM_1, cmd: { type: 'move', dir: 'left' } },
  { label: '▶', left: 'calc(136px + env(safe-area-inset-left))', bottom: BOTTOM_1, cmd: { type: 'move', dir: 'right' } },
  { label: '▼', left: 'calc(76px + env(safe-area-inset-left))', bottom: BOTTOM_0, cmd: { type: 'move', dir: 'back' } },
  { label: '↺', left: DPAD_LEFT, bottom: BOTTOM_2, cmd: { type: 'turn', dir: 'ccw' } },
  { label: '↻', left: TURN_LEFT, bottom: BOTTOM_2, cmd: { type: 'turn', dir: 'cw' } },
  { label: 'A', right: ACTION_RIGHT, bottom: BOTTOM_1, cmd: { type: 'attack' } },
  { label: 'U', right: ACTION_RIGHT, bottom: BOTTOM_0, cmd: { type: 'interact' } },
];

/**
 * Baut das Bedienfeld in `host` und liefert die Abbaufunktion.
 * Halten wiederholt nicht, jedes Kommando braucht eine neue Beruehrung.
 */
export function attachTouch(host: HTMLElement, handlers: TouchHandlers): () => void {
  const doc = host.ownerDocument;

  const pad = doc.createElement('div');
  pad.className = 'sx-pad';

  for (const spec of BUTTONS) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'sx-btn';
    button.textContent = spec.label;
    button.style.bottom = spec.bottom;
    if (spec.left !== undefined) button.style.left = spec.left;
    if (spec.right !== undefined) button.style.right = spec.right;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handlers.onCommand(spec.cmd);
    });
    pad.appendChild(button);
  }

  host.appendChild(pad);

  const pick = handlers.onPick;
  const pickListener =
    pick === undefined
      ? null
      : (raw: Event): void => {
          const event = raw as PointerEvent;
          if (event.target !== host && (event.target as Element).closest('.sx-btn') !== null) return;
          pick(event.clientX, event.clientY);
        };
  if (pickListener !== null) host.addEventListener('pointerdown', pickListener);

  return () => {
    if (pickListener !== null) host.removeEventListener('pointerdown', pickListener);
    pad.remove();
  };
}
