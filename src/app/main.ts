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
import type { Command, ContentDb, GameState, SaveMeta } from '../core/types';
import { attachKeyboard } from '../input/keyboard';
import { InputGate } from '../input/gate';
import { attachTouch } from '../input/touch';
import { createIndexedBackend, createQueueStore, createTokenStore } from '../net/indexedBackend';
import { createApiClient } from '../net/apiClient';
import { createSync } from '../net/sync';
import { AccountView } from '../ui/account';
import { AUTOSAVE_SLOT, SaveTooLargeError, createLocalStore } from '../net/localStore';
import { IDENTIFY_ITEM_ID, addToInventory, createInstance, takeItemUid } from '../core/items';
import { createPlaceholderAssets, USE_PLACEHOLDERS } from '../render/placeholders';
import { loadAssets, loadOptionalTextures } from '../render/assetLoader';
import { SoftwareRenderer } from '../render/renderer';
import { Automap } from '../ui/automap';
import { CharacterView } from '../ui/character';
import { Hud } from '../ui/hud';
import { InventoryView } from '../ui/inventory';
import { SkillsView } from '../ui/skills';
import { isUpgrade } from '../ui/itemModel';
import { skillbarSlots } from '../ui/progressModel';
import { VIEW_TITLES, tabs } from '../ui/views';
import type { ViewId } from '../ui/views';
import { MessageLog } from '../ui/log';
import { Menu } from '../ui/menu';
import { Overlay } from '../ui/overlay';
import { skillBar } from '../ui/hudModel';
import { DEV_SEED, collectAssetNames } from './devFixture';
import { FIRST_MAP_ID, collectTextureIds, createGameContent } from './gameContent';

/** Ein einzelnes Bild darf hoechstens 100 ms Spielzeit tragen. */
const MAX_FRAME_MS = 100;

/** Autosave alle 50 Runden, SPEC Abschnitt 11. */
const AUTOSAVE_EVERY_TURNS = 50;

/** Kantenlaenge der Vollbildkarte in CSS-Pixeln. */
const FULL_MAP_SIZE = 560;

/** Ausstattung fuer den Entwicklungsbetrieb. Im Build faellt sie weg. */
function grantDevKit(state: GameState, content: ContentDb): void {
  state.player.level = 12;
  state.player.unspentAttributePoints = 5;
  state.player.unspentSkillPoints = 3;
  state.player.consumables[IDENTIFY_ITEM_ID] = 2;

  const found = createInstance(
    takeItemUid(state),
    'suit_overall',
    12,
    'rare',
    [
      { affixId: 'suf_of_vigor', value: 24 },
      { affixId: 'suf_of_embers', value: 16 },
    ],
    content
  );
  if (found === null) return;
  found.identified = false;
  addToInventory(state, found);
}

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

/**
 * Startet das Spiel in `host`. `world` ist einspeisbar, damit ein Aufbau mit
 * nur einer Sohle dieselbe Schleife benutzen kann wie das ganze Spiel.
 */
export async function start(host: HTMLElement, world?: ContentDb): Promise<void> {
  const content = world ?? createGameContent();
  const firstMap = content.maps[FIRST_MAP_ID] === undefined
    ? (Object.keys(content.maps)[0] ?? FIRST_MAP_ID)
    : FIRST_MAP_ID;
  let state: GameState = createNewGame(DEV_SEED, content, firstMap);

  const names = collectAssetNames(content);
  const assets = USE_PLACEHOLDERS
    ? createPlaceholderAssets(names.spriteNames, names.weaponNames)
    : await loadAssets('assets', {
        textureIds: collectTextureIds(content.maps),
        spriteNames: names.spriteNames,
        weaponNames: names.weaponNames,
        uiNames: [],
      });

  // Wo schon ein echtes Bild liegt, ersetzt es den Platzhalter. Der Rest
  // bleibt, bis die Grafik nachkommt. In einem Einzeldatei-Aufbau stehen die
  // Bilder als data-URI in `SORLAX_TEXTURES`, sonst liegen sie unter assets/.
  if (USE_PLACEHOLDERS) {
    const embedded = (globalThis as { SORLAX_TEXTURES?: Record<number, string> }).SORLAX_TEXTURES;
    Object.assign(
      assets.textures,
      await loadOptionalTextures('assets', collectTextureIds(content.maps), embedded)
    );
  }

  // Nur im Entwicklungsbetrieb: offene Punkte, eine Scannerladung und ein
  // unidentifizierter Fund, damit sich Charakterbogen, Fertigkeitenbaum und
  // das Untersuchen ohne vorheriges Spielen ausprobieren lassen.
  if (import.meta.env.DEV) grantDevKit(state, content);

  const canvas = mountCanvas(host);
  const renderer = new SoftwareRenderer();
  await renderer.init(canvas, assets);
  renderer.setState(state, content);

  const hud = new Hud(host);
  const log = new MessageLog(host);
  const automap = new Automap(host);
  const overlay = new Overlay(host);
  const store = createLocalStore(
    createIndexedBackend(),
    () => new Date().toISOString(),
    (mapId) => content.maps[mapId]?.name ?? mapId
  );

  let targetId: number | null = null;
  let lastAutosaveTurn = 0;
  let openView: ViewId | null = null;

  // Netzteil, PHASE_7. Ohne VITE_API_BASE laeuft alles rein lokal weiter.
  const apiBase = String(import.meta.env['VITE_API_BASE'] ?? '');
  const api = apiBase === ''
    ? null
    : createApiClient({
        baseUrl: apiBase,
        tokens: createTokenStore(),
        mapNameOf: (mapId) => content.maps[mapId]?.name ?? mapId,
        onSignedOut: () => {
          account.email = null;
          pushMessage('Die Sitzung ist abgelaufen');
        },
      });
  const sync = api === null
    ? null
    : createSync({ api, store, queue: createQueueStore() });
  const account: { email: string | null; remote: SaveMeta[] } = { email: null, remote: [] };

  const showView = (view: ViewId): void => {
    openView = view;
    const doc = host.ownerDocument;
    const parts =
      view === 'inventory'
        ? inventory.render(doc, state, content)
        : view === 'character'
          ? character.render(doc, state, content)
          : skills.render(doc, state, content);
    overlay.show(VIEW_TITLES[view], ...parts, tabs(doc, view, showView));
  };

  const closeView = (): void => {
    openView = null;
    overlay.close();
    refresh();
  };

  const redraw = (): void => {
    if (openView !== null) showView(openView);
  };

  const refresh = (): void => {
    renderer.setState(state, content);
    hud.update(state, content);
    hud.setOpenPoints(state.player.unspentAttributePoints, state.player.unspentSkillPoints);
    automap.update(state, content);
    const target =
      targetId === null
        ? null
        : (state.maps[state.currentMapId]?.entities.find((e) => e.id === targetId) ?? null);
    if (target === null) targetId = null;
    hud.setTarget(state, content, target);
  };

  /** Eine Meldung ins Protokoll, ohne den Spielzustand anzufassen. */
  const pushMessage = (text: string): void => {
    log.push([...state.log, { turn: state.turnCount, kind: 'system', text }]);
  };

  const autosave = (): void => {
    if (state.turnCount - lastAutosaveTurn < AUTOSAVE_EVERY_TURNS) return;
    lastAutosaveTurn = state.turnCount;
    void store
      .write(state.difficulty, AUTOSAVE_SLOT, state)
      .then(() => {
        // Erst lokal, dann ins Netz. Ein Fehler dort bleibt in der
        // Warteschlange und haelt das Spiel nicht auf.
        void sync?.queueSave(state.difficulty, AUTOSAVE_SLOT);
      })
      .catch((error: unknown) => {
        // Ein voller oder zu grosser Stand darf das Spiel nie anhalten.
        pushMessage(
          error instanceof SaveTooLargeError ? 'Spielstand zu groß' : 'Autosave fehlgeschlagen'
        );
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

    // Ein aufgenommenes Teil, das besser ist als das Getragene, wird gemeldet.
    for (const event of events) {
      if (event.type !== 'itemPickedUp') continue;
      const picked = state.player.inventory.find((item) => item.uid === event.uid);
      if (picked === undefined || !isUpgrade(state, picked, content)) continue;
      const name = content.items[picked.baseId]?.name ?? picked.baseId;
      pushMessage(`${name} ist besser als das Getragene`);
    }

    const changedMap = events.some((event) => event.type === 'mapChange');
    if (changedMap) lastAutosaveTurn = state.turnCount - AUTOSAVE_EVERY_TURNS;
    autosave();
  };

  const fromView = (cmd: Command): void => {
    // Die Ansicht erzeugt nur Kommandos, angewendet werden sie hier.
    const events = applyCommand(state, cmd, content);
    renderer.consumeEvents(events);
    log.push(state.log);
    hud.update(state, content);
    hud.setOpenPoints(state.player.unspentAttributePoints, state.player.unspentSkillPoints);
    inventory.clearSelection();
    redraw();
  };

  const inventory = new InventoryView({ onCommand: fromView, onChanged: redraw });
  const character = new CharacterView({ onCommand: fromView, onChanged: redraw });
  const skills = new SkillsView({ onCommand: fromView, onChanged: redraw });

  const gate = new InputGate(() => renderer.isAnimating() || overlay.isOpen(), run);

  const menu = new Menu(overlay, store, {
    onResume: () => {
      if (overlay.isOpen()) menu.open(state);
      overlay.close();
    },
    onSave: (slot) => {
      void store.write(state.difficulty, slot, state).then(() => {
        void sync?.queueSave(state.difficulty, slot);
        overlay.close();
      });
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
    ...(api === null
      ? {}
      : {
          onAccount: () => void openAccount(),
          remoteSaves: () => account.remote,
        }),
  });

  const accountView =
    api === null
      ? null
      : new AccountView(overlay, api, {
          onDone: () => menu.open(state),
          onSignedIn: (email) => {
            account.email = email;
            void refreshRemote().then(() => menu.open(state));
          },
          onSignedOut: () => {
            account.email = null;
            account.remote = [];
            menu.open(state);
          },
        });

  /** Holt die Kopfdaten vom Server. Ohne Netz bleibt die Liste leer. */
  async function refreshRemote(): Promise<void> {
    if (api === null) return;
    account.remote = await api.listSaves().catch(() => []);
  }

  async function openAccount(): Promise<void> {
    if (accountView === null || sync === null) return;
    accountView.openSection({
      email: account.email,
      pending: await sync.pending(),
      configured: true,
    });
  }

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
    onMenu: () => (overlay.isOpen() ? closeView() : menu.open(state)),
    onInventory: () => (openView === 'inventory' ? closeView() : showView('inventory')),
    onSkills: () => (openView === 'skills' ? closeView() : showView('skills')),
    onCharacter: () => (openView === 'character' ? closeView() : showView('character')),
    onLog: () => {
      if (overlay.isOpen()) overlay.close();
      else overlay.show('Protokoll', MessageLog.fullView(host.ownerDocument, state.log));
    },
    resolveWeapon: (slot) => state.player.weapons[slot - 1] ?? null,
    resolveSkill: (slot) =>
      skillbarSlots(state, content)[slot - 1]?.id ?? skillBar(state, content)[slot - 1]?.skillId ?? null,
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
