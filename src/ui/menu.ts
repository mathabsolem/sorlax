/**
 * Menue, PHASE_4 Block 6.
 *
 * Vier Plaetze je Schwierigkeitsgrad: drei manuelle und einer fuer den
 * Autosave. Der Autosave-Platz kann geladen, aber nicht ueberschrieben werden.
 */
import { AUTOSAVE_SLOT, MANUAL_SLOTS } from '../net/localStore';
import type { LocalStore } from '../net/localStore';
import { Overlay, overlayButton } from './overlay';
import type { Difficulty, GameState, SaveMeta } from '../core/types';

export type Settings = {
  volume: number;
  /** Empfindlichkeit der Bedienelemente, 0.5 bis 2. */
  sensitivity: number;
  showDamageNumbers: boolean;
  /** Vorbereitet, aber ohne Auswahl (PHASE_4 Block 6). */
  language: 'de';
};

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.8,
  sensitivity: 1,
  showDamageNumbers: true,
  language: 'de',
};

export type MenuHandlers = {
  onResume: () => void;
  onSave: (slot: number) => void;
  onLoad: (slot: number) => void;
  onQuit: () => void;
  onSettingsChanged: (settings: Settings) => void;
};

/** Menschenlesbare Kopfzeile eines Speicherplatzes. */
export function describeSlot(meta: SaveMeta | undefined, slot: number): string {
  if (meta === undefined) return 'leer';
  const minutes = Math.floor(meta.playTimeMs / 60000);
  const stamp = meta.updatedAt.replace('T', ' ').slice(0, 16);
  const label = slot === AUTOSAVE_SLOT ? 'Autosave' : `Platz ${slot + 1}`;
  // Seit INTERFACES v1.5 traegt SaveMeta den Kartennamen selbst.
  return `${label} · Stufe ${meta.level} · ${meta.mapName} · ${minutes} min · ${stamp}`;
}

export class Menu {
  private settings: Settings = { ...DEFAULT_SETTINGS };

  constructor(
    private readonly overlay: Overlay,
    private readonly store: LocalStore,
    private readonly handlers: MenuHandlers
  ) {}

  isOpen(): boolean {
    return this.overlay.isOpen();
  }

  close(): void {
    this.overlay.close();
  }

  currentSettings(): Settings {
    return { ...this.settings };
  }

  /** Hauptmenue: Fortsetzen, Speichern, Laden, Einstellungen, Beenden. */
  open(state: GameState): void {
    const doc = this.overlay.element().ownerDocument;
    this.overlay.show(
      'Menü',
      overlayButton(doc, 'Fortsetzen', '', () => this.handlers.onResume()),
      overlayButton(doc, 'Speichern', '', () => void this.openSlots(state.difficulty, 'save')),
      overlayButton(doc, 'Laden', '', () => void this.openSlots(state.difficulty, 'load')),
      overlayButton(doc, 'Einstellungen', '', () => this.openSettings()),
      overlayButton(doc, 'Spiel beenden', '', () => this.handlers.onQuit())
    );
  }

  /** Platzliste. Beim Speichern bleibt der Autosave-Platz gesperrt. */
  async openSlots(difficulty: Difficulty, mode: 'save' | 'load'): Promise<void> {
    const doc = this.overlay.element().ownerDocument;
    const metas = await this.store.list();
    const bySlot = new Map<number, SaveMeta>();
    for (const meta of metas) {
      if (meta.difficulty === difficulty) bySlot.set(meta.slot, meta);
    }

    const rows = [...MANUAL_SLOTS, AUTOSAVE_SLOT].map((slot) => {
      const meta = bySlot.get(slot);
      const isAutosave = slot === AUTOSAVE_SLOT;
      const disabled = mode === 'save' ? isAutosave : meta === undefined;
      return overlayButton(
        doc,
        isAutosave ? 'Autosave' : `Platz ${slot + 1}`,
        describeSlot(meta, slot),
        () => (mode === 'save' ? this.handlers.onSave(slot) : this.handlers.onLoad(slot)),
        disabled
      );
    });

    this.overlay.show(
      mode === 'save' ? 'Speichern' : 'Laden',
      ...rows,
      overlayButton(doc, 'Zurück', '', () => this.handlers.onResume())
    );
  }

  private openSettings(): void {
    const doc = this.overlay.element().ownerDocument;
    const apply = (patch: Partial<Settings>): void => {
      this.settings = { ...this.settings, ...patch };
      this.handlers.onSettingsChanged(this.currentSettings());
      this.openSettings();
    };

    this.overlay.show(
      'Einstellungen',
      overlayButton(doc, 'Lautstärke', `${Math.round(this.settings.volume * 100)} %`, () =>
        apply({ volume: this.settings.volume >= 1 ? 0 : Math.round((this.settings.volume + 0.2) * 10) / 10 })
      ),
      overlayButton(doc, 'Empfindlichkeit', this.settings.sensitivity.toFixed(1), () =>
        apply({ sensitivity: this.settings.sensitivity >= 2 ? 0.5 : this.settings.sensitivity + 0.5 })
      ),
      overlayButton(doc, 'Schadenszahlen', this.settings.showDamageNumbers ? 'an' : 'aus', () =>
        apply({ showDamageNumbers: !this.settings.showDamageNumbers })
      ),
      // Sprache ist vorbereitet, hat aber noch keine Auswahl.
      overlayButton(doc, 'Sprache', 'Deutsch', () => undefined, true),
      overlayButton(doc, 'Zurück', '', () => this.handlers.onResume())
    );
  }
}
