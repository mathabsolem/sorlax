/**
 * Meldungsprotokoll, PHASE_4 Block 4.
 *
 * Zeigt die letzten fuenf Eintraege aus `state.log`, aelteste oben, und blendet
 * sie nach acht Sekunden aus. Das vollstaendige Protokoll liegt in einer
 * Vollbildansicht.
 */
import type { LogEntry } from '../core/types';

/** Sichtbare Eintraege im laufenden Spiel. */
export const VISIBLE_ENTRIES = 5;

/** Standzeit einer Meldung, danach blendet sie aus. */
export const FADE_AFTER_MS = 8000;

/** Dauer der Ausblendung, muss zu ui.css passen. */
const FADE_MS = 400;

/** Die zuletzt hinzugekommenen Eintraege, aelteste zuerst. */
export function tail(entries: readonly LogEntry[], count = VISIBLE_ENTRIES): LogEntry[] {
  return entries.slice(Math.max(0, entries.length - count));
}

function render(doc: Document, entry: LogEntry): HTMLElement {
  const node = doc.createElement('div');
  node.className = `sx-log__entry sx-log__entry--${entry.kind}`;
  node.textContent = entry.text;
  return node;
}

export class MessageLog {
  private readonly root: HTMLElement;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private shown = 0;

  constructor(
    host: HTMLElement,
    private readonly fadeAfterMs: number = FADE_AFTER_MS
  ) {
    this.root = host.ownerDocument.createElement('div');
    this.root.className = 'sx-log';
    host.appendChild(this.root);
  }

  /**
   * Nimmt den gewachsenen Teil des Logs auf. Der Aufrufer uebergibt das ganze
   * Log; angezeigt wird nur, was seit dem letzten Aufruf dazugekommen ist.
   */
  push(entries: readonly LogEntry[]): void {
    const fresh = entries.slice(Math.min(this.shown, entries.length));
    this.shown = entries.length;

    for (const entry of tail(fresh)) this.show(entry);
    while (this.root.childElementCount > VISIBLE_ENTRIES) {
      this.root.firstElementChild?.remove();
    }
  }

  private show(entry: LogEntry): void {
    const node = render(this.root.ownerDocument, entry);
    this.root.appendChild(node);

    const fade = setTimeout(() => {
      node.classList.add('sx-log__entry--fading');
      const drop = setTimeout(() => {
        node.remove();
        this.timers.delete(drop);
      }, FADE_MS);
      this.timers.add(drop);
      this.timers.delete(fade);
    }, this.fadeAfterMs);
    this.timers.add(fade);
  }

  /** Das vollstaendige Protokoll fuer die Vollbildansicht. */
  static fullView(doc: Document, entries: readonly LogEntry[]): HTMLElement {
    const scroll = doc.createElement('div');
    scroll.className = 'sx-overlay__scroll';
    for (const entry of entries) {
      const line = render(doc, entry);
      line.textContent = `${entry.turn}  ${entry.text}`;
      scroll.appendChild(line);
    }
    return scroll;
  }

  destroy(): void {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.root.remove();
  }
}
