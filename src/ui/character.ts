/**
 * Charakterbogen, PHASE_4_5 Block 5.
 * Links die Attribute mit Plusknopf, rechts die abgeleiteten Werte.
 */
import { playerStats, resistanceList, statLabel } from './itemText';
import { statBreakdown } from './progressModel';
import { node, button } from './views';
import type { Attributes, Command, ContentDb, GameState } from '../core/types';

const ATTRIBUTES: { key: keyof Attributes; label: string }[] = [
  { key: 'strength', label: 'Kraft' },
  { key: 'agility', label: 'Geschick' },
  { key: 'vitality', label: 'Konstitution' },
  { key: 'focus', label: 'Fokus' },
];

/** Werte, die eine Aufschluesselung bei Beruehrung bekommen. */
const BREAKDOWN_STATS = ['maxHealth', 'armor', 'accuracy', 'evasion', 'meleeBonus', 'elemBonus', 'critBonus'];

export type CharacterHandlers = {
  onCommand: (cmd: Command) => void;
  onChanged: () => void;
};

/** Spielzeit als Minuten und Sekunden. */
export function formatPlayTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)} min ${String(total % 60).padStart(2, '0')} s`;
}

export class CharacterView {
  /** Der Hinweis auf die Endgueltigkeit erscheint einmal je Sitzung. */
  private warned = false;

  constructor(private readonly handlers: CharacterHandlers) {}

  render(doc: Document, state: GameState, content: ContentDb): HTMLElement[] {
    const columns = node(doc, 'div', 'sx-columns');
    columns.appendChild(this.renderAttributes(doc, state, content));
    columns.appendChild(this.renderDerived(doc, state, content));

    const footer = node(doc, 'div', 'sx-detail');
    footer.appendChild(
      node(
        doc,
        'div',
        '',
        `Stufe ${state.player.level} · ${state.player.xp} Erfahrung · ${state.difficulty}`
      )
    );
    footer.appendChild(
      node(
        doc,
        'div',
        'sx-overlay__meta',
        `${formatPlayTime(state.playTimeMs)} · Runde ${state.turnCount}`
      )
    );

    const parts: HTMLElement[] = [columns, footer];
    if (this.warned) {
      parts.push(
        node(doc, 'div', 'sx-overlay__meta', 'Vergebene Punkte lassen sich nicht zurücknehmen.')
      );
    }
    return parts;
  }

  private renderAttributes(doc: Document, state: GameState, content: ContentDb): HTMLElement {
    const panel = node(doc, 'div', 'sx-detail');
    const open = state.player.unspentAttributePoints;
    panel.appendChild(node(doc, 'div', 'sx-detail__name', 'Attribute'));
    if (open > 0) {
      panel.appendChild(node(doc, 'div', 'sx-count--full', `${open} Punkte offen`));
    }

    for (const { key, label } of ATTRIBUTES) {
      const row = node(doc, 'div', 'sx-detail__row');
      row.appendChild(node(doc, 'span', '', label));
      const right = node(doc, 'span', '', String(state.player.attributes[key]));
      if (open > 0) {
        right.appendChild(
          button(doc, 'sx-actions__item', '+', () => {
            // Punkte sind endgueltig, der Hinweis kommt einmal je Sitzung.
            this.warned = true;
            this.handlers.onCommand({ type: 'spendAttribute', attr: key });
          })
        );
      }
      row.appendChild(right);
      panel.appendChild(row);
    }
    void content;
    return panel;
  }

  private renderDerived(doc: Document, state: GameState, content: ContentDb): HTMLElement {
    const panel = node(doc, 'div', 'sx-detail');
    panel.appendChild(node(doc, 'div', 'sx-detail__name', 'Abgeleitete Werte'));
    const stats = playerStats(state, content);

    const rows: [string, string][] = [
      ['maxHealth', `${state.player.health} / ${stats.maxHealth}`],
      ['armor', String(stats.armor)],
      ['accuracy', String(stats.accuracy)],
      ['evasion', String(stats.evasion)],
      ['meleeBonus', `${Math.round(stats.meleeBonus * 100)} %`],
      ['elemBonus', `${Math.round(stats.elemBonus * 100)} %`],
      ['critBonus', `${Math.round(stats.critBonus * 1000) / 10} %`],
      ['lightRadius', String(stats.lightRadius)],
      ['freeActionChance', `${Math.round(stats.freeActionChance * 100)} %`],
      ['ammoSaveChance', `${Math.round(stats.ammoSaveChance * 100)} %`],
    ];

    for (const [stat, text] of rows) {
      const row = node(doc, 'div', 'sx-detail__row');
      row.appendChild(node(doc, 'span', '', statLabel(stat)));
      row.appendChild(node(doc, 'span', '', text));
      // Ohne Aufschluesselung versteht niemand, warum die Genauigkeit bei 43 liegt.
      if (BREAKDOWN_STATS.includes(stat)) {
        const parts = statBreakdown(state, content, stat);
        row.title = `Basis ${round(parts.base)} · Ausrüstung ${round(parts.equipment)} · Fertigkeiten ${round(parts.skills)}`;
      }
      panel.appendChild(row);
    }

    panel.appendChild(node(doc, 'div', 'sx-overlay__meta', 'Widerstände'));
    for (const entry of resistanceList(stats)) {
      const row = node(doc, 'div', 'sx-detail__row');
      row.appendChild(node(doc, 'span', `sx-chip--${entry.type}`, entry.type));
      row.appendChild(node(doc, 'span', entry.value < 0 ? 'sx-down' : '', `${entry.value} %`));
      panel.appendChild(row);
    }
    return panel;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
