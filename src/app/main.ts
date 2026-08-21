/**
 * Bootstrap. Einziger Ort mit Seiteneffekten.
 *
 * Reihenfolge nach jedem Kommando (PHASE_4 Block 8):
 * erst renderer.consumeEvents, dann hud.update, dann log.push.
 * Das HUD wird ereignisgesteuert aktualisiert, nie in der Renderschleife.
 */
import '../ui/ui.css';
import { applyCommand } from '../core/commands';
import { createNewGame, deserialize, serialize } from '../core/state';
import type { Command, GameState } from '../core/types';
import { attachKeyboard } from '../input/keyboard';
import { InputGate } from '../input/gate';
import { attachTouch } from '../input/touch';
import { createIndexedBackend } from '../net/indexedBackend';
import { AUTOSAVE_SLOT, SaveTooLargeError, createLocalStore } from '../net/localStore';
import { createPlaceholderAssets, USE_PLACEHOLDERS } from '../render/placeholders';
import { loadAssets } from '../render/assetLoader';
import { SoftwareRenderer } from '../render/renderer';
import { Automap } from '../ui/automap';
import { Hud } from '../ui/hud';
import { MessageLog } from '../ui/log';
import { Menu } from '../ui/menu';
import { Overlay } from '../ui/overlay';
import { skillBar } from '../ui/hudModel';
import { DEV_MAP_ID, DEV_SEED, collectAssetNames, createDevContent } from './devFixture';

/** Ein einzelnes Bild darf hoechstens 100 ms Spielzeit tragen. */
const MAX_FRAME_MS = 100;

/** Autosave alle 50 Runden, SPEC Abschnitt 11. */
const AUTOSAVE_EVERY_TURNS = 50;

/** Kantenlaenge der Vollbildkarte in CSS-Pixeln. */
const FULL_MAP_SIZE = 560;

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
  let state: GameState = createNewGame(DEV_SEED, content, DEV_MAP_ID);

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

  const hud = new Hud(host);
  const log = new MessageLog(host);
  const automap = new Automap(host);
  const overlay = new Overlay(host);
  const store = createLocalStore(createIndexedBackend());

  let targetId: number | null = null;
  let lastAutosaveTurn = 0;

  const refresh = (): void => {
    renderer.setState(state, content);
    hud.update(state, content);
    automap.update(state, content);
    const target =
      targetId === null
        ? null
        : (state.maps[state.currentMapId]?.entities.find((e) => e.id === targetId) ?? null);
    if (target === null) targetId = null;
    hud.setTarget(state, content, target);
  };

  const autosave = (): void => {
    if (state.turnCount - lastAutosaveTurn < AUTOSAVE_EVERY_TURNS) return;
    lastAutosaveTurn = state.turnCount;
    void store.write(state.difficulty, AUTOSAVE_SLOT, state).catch((error: unknown) => {
      // Ein voller oder zu grosser Stand darf das Spiel nie anhalten.
      const text = error instanceof SaveTooLargeError ? 'savegame too large' : 'autosave failed';
      log.push([...state.log, { turn: state.turnCount, kind: 'system', text }]);
    });
  };

  const run = (cmd: Command): void => {
    if (overlay.isOpen()) return;
    const events = applyCommand(state, cmd, content);
    renderer.consumeEvents(events);

    // Auch ein Angriff ueber die Tastatur waehlt sein Ziel an (PHASE_4 Block 3).
    for (const event of events) {
      if (event.type !== 'attack' || event.attacker !== 'player') continue;
      if (event.target !== 'player') targetId = event.target;
    }
    refresh();
    log.push(state.log);

    const changedMap = events.some((event) => event.type === 'mapChange');
    if (changedMap) lastAutosaveTurn = state.turnCount - AUTOSAVE_EVERY_TURNS;
    autosave();
  };

  const gate = new InputGate(() => renderer.isAnimating() || overlay.isOpen(), run);

  const menu = new Menu(overlay, store, {
    onResume: () => {
      if (overlay.isOpen()) menu.open(state);
      overlay.close();
    },
    onSave: (slot) => {
      void store.write(state.difficulty, slot, state).then(() => overlay.close());
    },
    onLoad: (slot) => {
      void store.read(state.difficulty, slot).then((entry) => {
        if (entry === null) return;
        state = deserialize(serialize(entry.state));
        lastAutosaveTurn = state.turnCount;
        targetId = null;
        overlay.close();
        refresh();
      });
    },
    onQuit: () => {
      overlay.show('Beendet');
    },
    onSettingsChanged: () => undefined,
  });

  const toggleMap = (): void => {
    if (overlay.isOpen()) {
      overlay.close();
      automap.setSize(132);
      refresh();
      return;
    }
    const full = new Automap(overlay.element(), FULL_MAP_SIZE);
    full.element().className = 'sx-overlay__canvas';
    full.update(state, content);
    overlay.show('Karte', full.element());
  };

  attachKeyboard(host.ownerDocument, {
    onCommand: (cmd) => gate.submit(cmd),
    onMap: toggleMap,
    onMenu: () => (overlay.isOpen() ? overlay.close() : menu.open(state)),
    onLog: () => {
      if (overlay.isOpen()) overlay.close();
      else overlay.show('Protokoll', MessageLog.fullView(host.ownerDocument, state.log));
    },
    resolveWeapon: (slot) => state.player.weapons[slot - 1] ?? null,
    resolveSkill: (slot) => skillBar(state, content)[slot - 1]?.skillId ?? null,
    ...(import.meta.env.DEV
      ? {
          onToggleDebug: (view: 'light' | 'rotation') => {
            renderer.setDebugView(renderer.debugView() === view ? 'off' : view);
          },
        }
      : {}),
  });
  attachTouch(host, {
    onCommand: (cmd) => gate.submit(cmd),
    onPick: (x, y) => {
      if (overlay.isOpen()) return;
      const picked = renderer.pickEntityAt(x, y);
      if (picked === null) return;
      targetId = picked;
      refresh();
      gate.submit({ type: 'attack', targetId: picked });
    },
  });

  refresh();
  log.push(state.log);

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
