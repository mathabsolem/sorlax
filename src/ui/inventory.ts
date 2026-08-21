/**
 * Inventar mit Puppe, Raster und Gegenstandsdetails,
 * PHASE_4_5 Bloecke 2 und 3.
 *
 * Liest den Zustand und erzeugt Command-Objekte, mutiert nie selbst.
 */
import { MAX_INVENTORY } from '../core/items';
import { canEquip, compareItems, wornFor } from './itemModel';
import { affixLines, baseLines, itemDetail } from './itemText';
import { EQUIP_SLOTS } from '../core/types';
import { deltaSpan, button, node } from './views';
import type { Command, ContentDb, EquipSlot, GameState, ItemInstance } from '../core/types';

/** Anordnung der Puppe: Waffe und Zusatzschutz aussen, Messgeraete an den Handgelenken. */
const DOLL_LAYOUT: (EquipSlot | null)[] = [
  'helmet', null, 'amulet',
  'weapon', 'suit', 'guard',
  'gauge_left', 'gloves', 'gauge_right',
  'belt', null, 'boots',
];

const SLOT_LABELS: Record<EquipSlot, string> = {
  suit: 'Anzug',
  helmet: 'Helm',
  belt: 'Gürtel',
  boots: 'Stiefel',
  gloves: 'Handschuhe',
  weapon: 'Waffe',
  guard: 'Schutz',
  amulet: 'Amulett',
  gauge_left: 'Messgerät L',
  gauge_right: 'Messgerät R',
};

export type InventoryHandlers = {
  onCommand: (cmd: Command) => void;
  /** Nach jeder Aenderung neu zeichnen. */
  onChanged: () => void;
};

function cellFor(
  doc: Document,
  item: ItemInstance,
  content: ContentDb,
  selected: boolean,
  onPick: () => void,
  onDouble: () => void
): HTMLButtonElement {
  const def = content.items[item.baseId];
  const cell = button(doc, `sx-cell sx-cell--${item.rarity}`, '', onPick);
  if (selected) cell.classList.add('sx-cell--selected');
  cell.title = def?.name ?? item.baseId;
  cell.replaceChildren();

  if (!item.identified) cell.appendChild(node(doc, 'span', 'sx-cell__unknown', '?'));
  cell.appendChild(node(doc, 'span', 'sx-cell__icon', (def?.name ?? '??').slice(0, 8)));
  // Doppeltippen legt direkt an, die Abkuerzung fuer geuebte Spieler.
  cell.addEventListener('dblclick', onDouble);
  return cell;
}

export class InventoryView {
  private selected: number | null = null;

  constructor(private readonly handlers: InventoryHandlers) {}

  /** Waehlt einen Gegenstand ab, etwa nach dem Anlegen. */
  clearSelection(): void {
    this.selected = null;
  }

  render(doc: Document, state: GameState, content: ContentDb): HTMLElement[] {
    const wrapper = node(doc, 'div', 'sx-columns');
    wrapper.appendChild(this.renderDoll(doc, state, content));

    const right = node(doc, 'div', '');
    right.appendChild(this.renderCounter(doc, state));
    right.appendChild(this.renderGrid(doc, state, content));
    right.appendChild(this.renderStacks(doc, state, content));
    wrapper.appendChild(right);

    const parts: HTMLElement[] = [wrapper];
    const detail = this.renderDetail(doc, state, content);
    if (detail !== null) parts.push(detail);
    return parts;
  }

  private current(state: GameState): ItemInstance | null {
    if (this.selected === null) return null;
    const carried = state.player.inventory.find((item) => item.uid === this.selected);
    if (carried !== undefined) return carried;
    for (const slot of EQUIP_SLOTS) {
      const worn = state.player.equipment[slot];
      if (worn?.uid === this.selected) return worn;
    }
    return null;
  }

  private select(uid: number): void {
    this.selected = this.selected === uid ? null : uid;
    this.handlers.onChanged();
  }

  private renderDoll(doc: Document, state: GameState, content: ContentDb): HTMLElement {
    const doll = node(doc, 'div', 'sx-doll');
    for (const slot of DOLL_LAYOUT) {
      if (slot === null) {
        doll.appendChild(node(doc, 'div', ''));
        continue;
      }
      const item = state.player.equipment[slot];
      if (item === undefined) {
        const empty = node(doc, 'div', 'sx-cell sx-cell--empty', SLOT_LABELS[slot].slice(0, 8));
        empty.title = SLOT_LABELS[slot];
        doll.appendChild(empty);
        continue;
      }
      doll.appendChild(
        cellFor(doc, item, content, item.uid === this.selected, () => this.select(item.uid), () =>
          this.handlers.onCommand({ type: 'unequip', slot })
        )
      );
    }
    return doll;
  }

  private renderCounter(doc: Document, state: GameState): HTMLElement {
    const used = state.player.inventory.length;
    const full = used >= MAX_INVENTORY;
    return node(doc, 'div', `sx-count${full ? ' sx-count--full' : ''}`, `${used} / ${MAX_INVENTORY}`);
  }

  private renderGrid(doc: Document, state: GameState, content: ContentDb): HTMLElement {
    const grid = node(doc, 'div', 'sx-grid');
    for (const item of state.player.inventory) {
      grid.appendChild(
        cellFor(doc, item, content, item.uid === this.selected, () => this.select(item.uid), () =>
          this.equip(state, content, item)
        )
      );
    }
    for (let index = state.player.inventory.length; index < MAX_INVENTORY; index++) {
      grid.appendChild(node(doc, 'div', 'sx-cell sx-cell--empty'));
    }
    return grid;
  }

  /**
   * Verbrauchsgueter und Munition liegen als Zaehler in `consumables` und
   * `ammo`, nicht als Instanzen. Sie bekommen deshalb eine eigene Leiste.
   */
  private renderStacks(doc: Document, state: GameState, content: ContentDb): HTMLElement {
    const stacks = node(doc, 'div', 'sx-stack');
    for (const [id, count] of Object.entries(state.player.consumables)) {
      if (count <= 0) continue;
      const name = content.items[id]?.name ?? id;
      stacks.appendChild(
        button(doc, 'sx-actions__item', `${name} ${count}`, () =>
          this.handlers.onCommand({ type: 'useConsumable', itemId: id })
        )
      );
    }
    for (const [id, count] of Object.entries(state.player.ammo)) {
      if (count <= 0) continue;
      stacks.appendChild(node(doc, 'span', '', `${content.items[id]?.name ?? id}: ${count}`));
    }
    return stacks;
  }

  private equip(state: GameState, content: ContentDb, item: ItemInstance): void {
    if (!canEquip(state.player, item, content).ok) return;
    this.handlers.onCommand({ type: 'equip', uid: item.uid });
  }

  private renderDetail(doc: Document, state: GameState, content: ContentDb): HTMLElement | null {
    const item = this.current(state);
    if (item === null) return null;
    const detail = itemDetail(state, item, content);
    if (detail === null) return null;

    const panel = node(doc, 'div', 'sx-detail');
    panel.appendChild(node(doc, 'div', `sx-detail__name sx-rarity--${detail.rarity}`, detail.name));
    panel.appendChild(
      node(doc, 'div', 'sx-overlay__meta', `${SLOT_LABELS[detail.slot]} · Stufe ${detail.itemLevel}`)
    );

    for (const line of detail.base) panel.appendChild(node(doc, 'div', '', line));
    for (const line of detail.affixes) panel.appendChild(node(doc, 'div', 'sx-rarity--magic', line));
    if (!detail.identified) {
      panel.appendChild(
        node(doc, 'div', 'sx-overlay__meta', 'Nicht identifiziert. Nur Grundwerte sichtbar.')
      );
    }

    for (const requirement of detail.requirements) {
      panel.appendChild(
        node(doc, 'div', requirement.met ? 'sx-overlay__meta' : 'sx-unmet', requirement.text)
      );
    }

    this.appendComparison(doc, panel, state, content, item);
    panel.appendChild(this.renderActions(doc, state, content, item));
    return panel;
  }

  private appendComparison(
    doc: Document,
    panel: HTMLElement,
    state: GameState,
    content: ContentDb,
    item: ItemInstance
  ): void {
    const worn = wornFor(state.player, item);
    // Gegen sich selbst gibt es nichts zu vergleichen.
    if (worn === null || worn === item) return;
    const comparison = compareItems(state, item, content);

    panel.appendChild(node(doc, 'div', 'sx-overlay__meta', 'Gegen das getragene Teil'));
    for (const entry of comparison.derived) {
      if (entry.delta === 0) continue;
      const row = node(doc, 'div', 'sx-detail__row');
      row.appendChild(node(doc, 'span', '', entry.stat));
      const value = node(doc, 'span', '', `${entry.before} → ${entry.after}`);
      const delta = deltaSpan(doc, entry.delta);
      if (delta !== null) value.appendChild(delta);
      row.appendChild(value);
      panel.appendChild(row);
    }
  }

  private renderActions(
    doc: Document,
    state: GameState,
    content: ContentDb,
    item: ItemInstance
  ): HTMLElement {
    const bar = node(doc, 'div', 'sx-actions');
    const worn = wornFor(state.player, item) === item;
    const check = canEquip(state.player, item, content);

    if (worn) {
      bar.appendChild(
        button(doc, 'sx-actions__item', 'Ablegen', () =>
          this.handlers.onCommand({ type: 'unequip', slot: item.slot })
        )
      );
    } else {
      bar.appendChild(
        button(
          doc,
          'sx-actions__item',
          'Anlegen',
          () => this.equip(state, content, item),
          !check.ok
        )
      );
    }
    bar.appendChild(
      button(doc, 'sx-actions__item', 'Fallenlassen', () =>
        this.handlers.onCommand({ type: 'dropItem', uid: item.uid })
      )
    );
    return bar;
  }
}

/** Alle Grundwerte und Affixe eines Teils als Text, fuer Anzeige und Test. */
export function itemLines(item: ItemInstance, content: ContentDb): string[] {
  const def = content.items[item.baseId];
  if (def === undefined) return [];
  return [...baseLines(def), ...affixLines(item, content)];
}
