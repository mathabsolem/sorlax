/**
 * Vollbildansichten, PHASE_4 Block 1 und 6.
 * Blockieren die Eingabe darunter, solange sie offen sind.
 */
export class Overlay {
  private readonly root: HTMLElement;

  constructor(host: HTMLElement) {
    this.root = host.ownerDocument.createElement('div');
    this.root.className = 'sx-overlay';
    this.root.hidden = true;
    host.appendChild(this.root);
  }

  isOpen(): boolean {
    return !this.root.hidden;
  }

  /** Zeigt Titel und Inhalt. Ein zweiter Aufruf ersetzt den Inhalt. */
  show(title: string, ...content: readonly HTMLElement[]): void {
    const doc = this.root.ownerDocument;
    this.root.replaceChildren();
    const heading = doc.createElement('div');
    heading.className = 'sx-overlay__title';
    heading.textContent = title;
    this.root.append(heading, ...content);
    this.root.hidden = false;
  }

  close(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  element(): HTMLElement {
    return this.root;
  }

  destroy(): void {
    this.root.remove();
  }
}

/** Eine Schaltflaeche im Vollbild, mindestens 48 x 48 CSS-Pixel. */
export function overlayButton(
  doc: Document,
  label: string,
  meta: string,
  onClick: () => void,
  disabled = false
): HTMLButtonElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'sx-overlay__item';
  button.disabled = disabled;

  const text = doc.createElement('span');
  text.textContent = label;
  button.appendChild(text);

  if (meta !== '') {
    const note = doc.createElement('span');
    note.className = 'sx-overlay__meta';
    note.textContent = meta;
    button.appendChild(note);
  }

  button.addEventListener('click', onClick);
  return button;
}
