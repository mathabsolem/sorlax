/**
 * Fertigkeitenbaum, PHASE_4_5 Block 6.
 *
 * Drei Reiter, je Baum drei Stufen mit je zwei Fertigkeiten.
 * `tree_reaction` und `tree_endure` werden gezeichnet, aber abgeblendet:
 * es soll sichtbar sein, dass es sie gibt.
 */
import { SKILL_SLOTS } from './hudModel';
import { statLabel } from './itemText';
import { nextPointPreview, skillNodeState, skillbarSlots, treeNodes } from './progressModel';
import { node, button } from './views';
import type { Command, ContentDb, GameState, SkillDef, SkillTreeId } from '../core/types';

const TREE_TITLES: Record<SkillTreeId, string> = {
  tree_gear: 'Gerät und Gewalt',
  tree_reaction: 'Reaktion',
  tree_endure: 'Beharrlichkeit',
};

export type SkillsHandlers = {
  onCommand: (cmd: Command) => void;
  onChanged: () => void;
};

export class SkillsView {
  private tree: SkillTreeId = 'tree_gear';
  private picked: string | null = null;

  constructor(private readonly handlers: SkillsHandlers) {}

  render(doc: Document, state: GameState, content: ContentDb): HTMLElement[] {
    const tabs = node(doc, 'div', 'sx-tabs sx-tabs--trees');
    for (const [tree, title] of Object.entries(TREE_TITLES) as [SkillTreeId, string][]) {
      const item = button(doc, 'sx-tabs__item sx-tabs__item--tree', title, () => {
        this.tree = tree;
        this.handlers.onChanged();
      });
      if (tree === this.tree) item.setAttribute('aria-current', 'true');
      tabs.appendChild(item);
    }

    const open = state.player.unspentSkillPoints;
    const header = node(
      doc,
      'div',
      open > 0 ? 'sx-count--full' : 'sx-count',
      open > 0 ? `${open} Fertigkeitspunkte offen` : 'Keine offenen Punkte'
    );

    const columns = node(doc, 'div', 'sx-columns');
    const left = node(doc, 'div', '');
    for (const def of treeNodes(content, this.tree)) {
      left.appendChild(this.renderNode(doc, state, content, def));
    }
    columns.appendChild(left);

    return [tabs, header, columns, this.renderBar(doc, state, content)];
  }

  private renderNode(
    doc: Document,
    state: GameState,
    content: ContentDb,
    def: SkillDef
  ): HTMLElement {
    const status = skillNodeState(state, def, content);
    const panel = node(doc, 'div', `sx-node sx-node--${status.state}`);

    const head = node(doc, 'div', 'sx-node__head');
    head.appendChild(node(doc, 'span', '', def.name));
    head.appendChild(node(doc, 'span', '', `${status.points} / ${status.maxPoints}`));
    panel.appendChild(head);
    panel.appendChild(node(doc, 'div', 'sx-overlay__meta', def.description));

    // Die Wirkung des naechsten Punkts wird ausgerechnet, nicht als Formel gezeigt.
    const preview = nextPointPreview(def, status.points);
    if (preview !== null && status.state !== 'locked') {
      panel.appendChild(
        node(doc, 'div', '', `${statLabel(preview.stat)} ${preview.now} auf ${preview.next}`)
      );
    }

    if (status.state === 'locked') {
      panel.appendChild(node(doc, 'div', 'sx-overlay__meta', 'Dieser Baum ist noch nicht verfügbar.'));
      return panel;
    }
    if (status.state === 'blocked') {
      const text =
        status.reason === 'reqLevel'
          ? `Braucht Stufe ${status.needed}`
          : `Braucht ${status.needed} Punkte in diesem Baum`;
      panel.appendChild(node(doc, 'div', 'sx-unmet', text));
      return panel;
    }

    if (status.state === 'available' && state.player.unspentSkillPoints > 0) {
      panel.appendChild(
        button(doc, 'sx-actions__item', '+', () =>
          this.handlers.onCommand({ type: 'spendSkillPoint', skillId: def.id })
        )
      );
    }
    if (def.active && status.points > 0) {
      panel.appendChild(
        button(doc, 'sx-actions__item', this.picked === def.id ? 'Platz wählen' : 'Auf Leiste', () => {
          this.picked = this.picked === def.id ? null : def.id;
          this.handlers.onChanged();
        })
      );
    }
    return panel;
  }

  /** Die sechs Plaetze der HUD-Leiste, belegbar durch Antippen. */
  private renderBar(doc: Document, state: GameState, content: ContentDb): HTMLElement {
    const bar = node(doc, 'div', 'sx-actions');
    bar.appendChild(node(doc, 'span', 'sx-overlay__meta', 'Leiste'));

    const slots = skillbarSlots(state, content);
    for (let index = 0; index < SKILL_SLOTS; index++) {
      const assigned = slots[index] ?? null;
      const label = `F${index + 1} ${assigned?.name ?? '—'}`;
      bar.appendChild(
        button(
          doc,
          'sx-actions__item',
          label,
          () => {
            if (this.picked === null) return;
            // Seit INTERFACES v1.4 gibt es dafuer ein Kommando; die
            // Oberflaeche fasst den Zustand nicht mehr selbst an.
            this.handlers.onCommand({ type: 'assignSkillSlot', index, skillId: this.picked });
            this.picked = null;
          },
          this.picked === null
        )
      );
    }
    return bar;
  }
}
