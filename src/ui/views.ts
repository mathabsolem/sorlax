/**
 * Gemeinsame Bausteine der drei Vollbildansichten, PHASE_4_5 Bloecke 1 und 7.
 *
 * Kein Ziehen und Ablegen: Antippen waehlt aus, darunter erscheint eine
 * Aktionsleiste. Alle Trefferflaechen sind mindestens 48 x 48 CSS-Pixel, das
 * setzt ui.css ueber `--sx-touch`.
 */
export type ViewId = 'inventory' | 'character' | 'skills';

export const VIEW_TITLES: Record<ViewId, string> = {
  inventory: 'Inventar',
  character: 'Charakterbogen',
  skills: 'Fertigkeiten',
};

export function node(doc: Document, tag: string, className: string, text = ''): HTMLElement {
  const element = doc.createElement(tag);
  element.className = className;
  if (text !== '') element.textContent = text;
  return element;
}

export function button(
  doc: Document,
  className: string,
  label: string,
  onClick: () => void,
  disabled = false
): HTMLButtonElement {
  const element = doc.createElement('button');
  element.type = 'button';
  element.className = className;
  element.textContent = label;
  element.disabled = disabled;
  element.addEventListener('click', onClick);
  return element;
}

/** Reiterleiste am unteren Rand, damit man nicht ueber das Menue muss. */
export function tabs(doc: Document, current: ViewId, onSwitch: (view: ViewId) => void): HTMLElement {
  const bar = node(doc, 'div', 'sx-tabs');
  for (const [view, title] of Object.entries(VIEW_TITLES) as [ViewId, string][]) {
    const item = button(doc, 'sx-tabs__item', title, () => onSwitch(view));
    if (view === current) item.setAttribute('aria-current', 'true');
    bar.appendChild(item);
  }
  return bar;
}

/** Vorzeichenbehaftete Differenz, gruen bei Verbesserung, rot bei Verschlechterung. */
export function deltaSpan(doc: Document, delta: number, unit = ''): HTMLElement | null {
  if (delta === 0) return null;
  const sign = delta > 0 ? '+' : '−';
  const span = node(doc, 'span', delta > 0 ? 'sx-up' : 'sx-down');
  span.textContent = ` ${sign}${Math.abs(delta)}${unit}`;
  return span;
}
