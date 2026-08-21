/**
 * HUD als DOM ueber dem Canvas, PHASE_4 Block 2 und 3.
 *
 * Aktualisierung ausschliesslich ereignisgesteuert: `update` laeuft einmal nach
 * jedem applyCommand, nie in der Renderschleife. Ein HUD, das 60 mal je Sekunde
 * ins DOM schreibt, kostet auf Mobilgeraeten mehr als der ganze Raycaster.
 *
 * Die Oberflaeche liest den GameState und mutiert ihn nie.
 */
import { getDerivedStats, enemyActor } from '../core/derived';
import { hudModel, targetModel } from './hudModel';
import type { HudModel, TargetModel } from './hudModel';
import type { ContentDb, Entity, GameState } from '../core/types';

/** Dauer der Hervorhebung geaenderter Zahlen, muss zu ui.css passen. */
const FLASH_MS = 300;

type Parts = {
  root: HTMLElement;
  healthFill: HTMLElement;
  healthText: HTMLElement;
  armor: HTMLElement;
  weaponName: HTMLElement;
  weaponAmmo: HTMLElement;
  effects: HTMLElement;
  levelText: HTMLElement;
  xpFill: HTMLElement;
  skills: HTMLElement;
  status: HTMLElement;
  target: HTMLElement;
};

function element(doc: Document, tag: string, className: string, text = ''): HTMLElement {
  const node = doc.createElement(tag);
  node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function labelled(doc: Document, label: string): { row: HTMLElement; value: HTMLElement } {
  const row = element(doc, 'div', 'sx-line');
  row.appendChild(element(doc, 'span', 'sx-line__label', label));
  const value = element(doc, 'span', 'sx-line__value');
  row.appendChild(value);
  return { row, value };
}

function bar(doc: Document, extra = ''): { root: HTMLElement; fill: HTMLElement; text: HTMLElement } {
  const root = element(doc, 'div', `sx-bar${extra}`);
  const fill = element(doc, 'div', 'sx-bar__fill');
  const text = element(doc, 'span', 'sx-bar__text');
  root.append(fill, text);
  return { root, fill, text };
}

function build(host: HTMLElement): Parts {
  const doc = host.ownerDocument;
  const root = element(doc, 'div', 'sx-hud');

  const vitals = element(doc, 'div', 'sx-hud__vitals');
  const health = bar(doc);
  const armor = labelled(doc, 'Ruestung');
  const weapon = labelled(doc, 'Waffe');
  const ammo = labelled(doc, 'Munition');
  const xp = bar(doc, ' sx-bar--xp');
  const level = labelled(doc, 'Stufe');
  vitals.append(health.root, armor.row, weapon.row, ammo.row, level.row, xp.root);

  const status = element(doc, 'div', 'sx-hud__status');
  const effects = element(doc, 'div', 'sx-hud__effects');
  status.appendChild(effects);

  const skills = element(doc, 'div', 'sx-hud__skills');
  const target = element(doc, 'div', 'sx-target');
  target.hidden = true;

  root.append(vitals, status, skills, target);
  host.appendChild(root);

  return {
    root,
    healthFill: health.fill,
    healthText: health.text,
    armor: armor.value,
    weaponName: weapon.value,
    weaponAmmo: ammo.value,
    effects,
    levelText: level.value,
    xpFill: xp.fill,
    skills,
    status,
    target,
  };
}

export class Hud {
  private readonly parts: Parts;
  private readonly previous = new Map<HTMLElement, string>();
  private readonly timers = new Map<HTMLElement, ReturnType<typeof setTimeout>>();

  constructor(host: HTMLElement) {
    this.parts = build(host);
  }

  /** Schreibt einen Wert und hebt ihn hervor, wenn er sich geaendert hat. */
  private set(node: HTMLElement, value: string): void {
    const before = this.previous.get(node);
    if (before === value) return;
    node.textContent = value;
    this.previous.set(node, value);
    if (before === undefined) return;

    node.classList.remove('sx-changed');
    const running = this.timers.get(node);
    if (running !== undefined) clearTimeout(running);
    // Ein Reflow erzwingt den Neustart der Animation.
    void node.offsetWidth;
    node.classList.add('sx-changed');
    this.timers.set(
      node,
      setTimeout(() => node.classList.remove('sx-changed'), FLASH_MS)
    );
  }

  private renderEffects(model: HudModel): void {
    const doc = this.parts.effects.ownerDocument;
    this.parts.effects.replaceChildren();
    for (const chip of model.effects) {
      const node = element(doc, 'span', `sx-chip sx-chip--${chip.sourceType}`);
      node.textContent = `${chip.id} ${chip.remaining}`;
      this.parts.effects.appendChild(node);
    }
  }

  private renderSkills(model: HudModel): void {
    const doc = this.parts.skills.ownerDocument;
    this.parts.skills.replaceChildren();
    for (const slot of model.skills) {
      const node = element(doc, 'div', `sx-slot sx-slot--${slot.state}`);
      node.title = slot.name;
      node.appendChild(element(doc, 'span', 'sx-slot__name', slot.name.slice(0, 6)));
      if (slot.state === 'cooling') {
        node.appendChild(element(doc, 'span', 'sx-slot__remaining', String(slot.remaining)));
      }
      this.parts.skills.appendChild(node);
    }
  }

  /** Einmal je Kommando aufrufen, nicht je Bild. */
  update(state: GameState, content: ContentDb): void {
    const model = hudModel(state, content);

    this.parts.healthFill.style.width = `${model.health.ratio * 100}%`;
    this.set(this.parts.healthText, model.health.text);
    this.set(this.parts.armor, String(model.armor));
    this.set(this.parts.weaponName, model.weapon.name);
    this.set(this.parts.weaponAmmo, model.weapon.ammo);
    this.set(this.parts.levelText, `${model.level} · Runde ${model.turnCount} · ${model.mapName}`);
    this.parts.xpFill.style.width = `${model.xpRatio * 100}%`;

    this.renderEffects(model);
    this.renderSkills(model);
  }

  /** Zeigt den angewaehlten Gegner oben mittig, oder blendet die Anzeige aus. */
  setTarget(state: GameState, content: ContentDb, entity: Entity | null): void {
    const node = this.parts.target;
    if (entity === null) {
      node.hidden = true;
      return;
    }
    const actor = enemyActor(entity, content);
    if (actor === null) {
      node.hidden = true;
      return;
    }
    const stats = getDerivedStats(actor, content, state.difficulty);
    const model = targetModel(state, content, entity, stats);
    if (model === null) {
      node.hidden = true;
      return;
    }

    node.hidden = false;
    node.className = `sx-target sx-target--${model.rank}`;
    node.replaceChildren();
    this.appendTarget(node, model);
  }

  private appendTarget(node: HTMLElement, model: TargetModel): void {
    const doc = node.ownerDocument;
    const head = element(doc, 'div', 'sx-line');
    head.appendChild(element(doc, 'span', 'sx-line__value', model.name));
    head.appendChild(element(doc, 'span', `sx-chip sx-chip--${model.element}`, model.element));
    node.appendChild(head);

    const health = bar(doc);
    health.fill.style.width = `${model.health.ratio * 100}%`;
    health.text.textContent = model.health.text;
    node.appendChild(health.root);

    // Resistenzen erscheinen erst, wenn der Spieler sie selbst erlebt hat.
    if (model.knownResistances.length > 0) {
      const text = model.knownResistances
        .map((entry) => `${entry.type} ${entry.value}`)
        .join('  ');
      node.appendChild(element(doc, 'div', 'sx-target__resists', text));
    }
  }

  /** Entfernt das HUD und alle laufenden Hervorhebungen. */
  destroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.parts.root.remove();
  }
}
