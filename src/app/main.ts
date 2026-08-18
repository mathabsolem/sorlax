/**
 * Minimaler Bootstrap zur Sichtpruefung. Einziger Ort mit Seiteneffekten.
 * Kein HUD, keine Menues, kein Speichern, kein Netz.
 */
import { applyCommand } from '../core/commands';
import { createNewGame } from '../core/state';
import type { Command, GameState } from '../core/types';
import { attachKeyboard } from '../input/keyboard';
import { InputGate } from '../input/gate';
import { attachTouch } from '../input/touch';
import { createPlaceholderAssets, USE_PLACEHOLDERS } from '../render/placeholders';
import { loadAssets } from '../render/assetLoader';
import { SoftwareRenderer } from '../render/renderer';
import { DEV_MAP_ID, DEV_SEED, collectAssetNames, createDevContent } from './devFixture';

/** Ein einzelnes Bild darf hoechstens 100 ms Spielzeit tragen. */
const MAX_FRAME_MS = 100;

function mountCanvas(host: HTMLElement): HTMLCanvasElement {
  host.style.position = 'relative';
  host.style.height = '100%';
  const canvas = host.ownerDocument.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.background = '#000';
  canvas.style.touchAction = 'none';
  host.appendChild(canvas);
  return canvas;
}

export async function start(host: HTMLElement): Promise<void> {
  const content = createDevContent();
  const state: GameState = createNewGame(DEV_SEED, content, DEV_MAP_ID);

  const names = collectAssetNames(content);
  const assets = USE_PLACEHOLDERS
    ? createPlaceholderAssets(names.spriteNames, names.weaponNames)
    : await loadAssets('assets', {
        textureIds: [],
        spriteNames: names.spriteNames,
        weaponNames: names.weaponNames,
        uiNames: [],
      });

  const canvas = mountCanvas(host);
  const renderer = new SoftwareRenderer();
  await renderer.init(canvas, assets);
  renderer.setState(state, content);

  const run = (cmd: Command): void => {
    const events = applyCommand(state, cmd, content);
    renderer.setState(state, content);
    renderer.consumeEvents(events);
  };
  const gate = new InputGate(() => renderer.isAnimating(), run);

  attachKeyboard(host.ownerDocument, {
    onCommand: (cmd) => gate.submit(cmd),
    resolveWeapon: (slot) => state.player.weapons[slot - 1] ?? null,
  });
  attachTouch(host, {
    onCommand: (cmd) => gate.submit(cmd),
    onPick: (x, y) => {
      const targetId = renderer.pickEntityAt(x, y);
      if (targetId !== null) gate.submit({ type: 'attack', targetId });
    },
  });

  let previous = performance.now();
  const loop = (now: number): void => {
    const dtMs = Math.min(MAX_FRAME_MS, now - previous);
    previous = now;
    renderer.frame(dtMs);
    gate.flush();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

const host = document.getElementById('app');
if (host !== null) {
  void start(host);
}
