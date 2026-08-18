/**
 * Touchsteuerung als DOM-Elemente ueber dem Canvas, nicht in das Bild gezeichnet.
 * Erzeugt nur Command-Objekte, kein Zugriff auf core.
 *
 * Flaechen mindestens 56 x 56 CSS-Pixel, Positionierung mit den Safe-Area-Insets.
 */
import type { Command } from '../core/types';

export type TouchHandlers = {
  onCommand: (cmd: Command) => void;
  /** Tippen in das Bild, etwa zum Setzen eines Ziels. */
  onPick?: (clientX: number, clientY: number) => void;
};

const STYLE_ID = 'sorlax-touch-style';

const CSS = `
.sx-pad { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
.sx-btn {
  position: absolute;
  min-width: 56px;
  min-height: 56px;
  pointer-events: auto;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #6a6a72;
  border-radius: 8px;
  background: rgba(20, 20, 26, 0.55);
  color: #d8d8de;
  font: 600 18px/1 system-ui, sans-serif;
}
.sx-btn:active { background: rgba(90, 90, 110, 0.75); }
`;

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

function ensureStyle(doc: Document): void {
  if (doc.getElementById(STYLE_ID) !== null) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

/**
 * Baut das Bedienfeld in `host` und liefert die Abbaufunktion.
 * Halten wiederholt nicht, jedes Kommando braucht eine neue Beruehrung.
 */
export function attachTouch(host: HTMLElement, handlers: TouchHandlers): () => void {
  const doc = host.ownerDocument;
  ensureStyle(doc);

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
