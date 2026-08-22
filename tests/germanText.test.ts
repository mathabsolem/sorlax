/**
 * Deutsche Ausgabe braucht echte Umlaute und Eszett.
 *
 * Der Test ist eine Sperrliste konkreter Ersatzschreibweisen, kein Beweis:
 * eine allgemeine Regel gaebe es nicht, weil Woerter wie "Biss",
 * "Induktionsstab" oder "Druckmesser" dieselben Buchstabenfolgen enthalten,
 * ohne einen Umlaut zu brauchen. Die Liste faengt genau die Fehler, die schon
 * einmal vorgekommen sind, und alles, was ihnen aehnelt.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/core/commands';
import {
  ATTRIBUTE_NAMES,
  DAMAGE_TYPE_NAMES,
  DIFFICULTY_NAMES,
  EFFECT_NAMES,
  SLOT_NAMES,
  damageTypeName,
  effectName,
} from '../src/core/text';
import { EFFECT_ORDER } from '../src/core/effectDefs';
import { DIFFICULTY_ORDER } from '../src/core/difficulty';
import { DAMAGE_TYPES, EQUIP_SLOTS } from '../src/core/types';
import { setup } from './fixtures/world';

/** Ersatzschreibweisen, die in deutscher Ausgabe nie vorkommen duerfen. */
const FORBIDDEN = [
  'ueber',
  'Ruestung',
  'Guertel',
  'Sprueher',
  'Traeger',
  'Verschuettet',
  'Kaelte',
  'Behaelter',
  'Verkuerzt',
  'Erhoeht',
  'Entlaedt',
  'laenger',
  'toedlich',
  'Abschuetteln',
  'Menue',
  'Zurueck',
  'Lautstaerke',
  'Geschuetz',
  'Schuerf',
  'Waechter',
  'Laeufer',
  'Stoss',
  'Groesse',
  'moeglich',
  'koennen',
  'muessen',
  'naechst',
  'fuer',
  'Staerke',
  'Schluessel',
  'Gegenstaende',
  'Faehigkeit',
];

function sourceFiles(root: string, extensions: RegExp): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root)) {
    if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('.')) continue;
    const full = join(root, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full, extensions));
    else if (extensions.test(entry)) found.push(full);
  }
  return found;
}

/** Zeichenkettenliterale einer TypeScript-Datei, ohne Importpfade. */
function stringLiterals(source: string): string[] {
  const found: string[] = [];
  const pattern = /'([^'\\\n]{2,})'|"([^"\\\n]{2,})"/g;
  let match = pattern.exec(source);
  while (match !== null) {
    const text = match[1] ?? match[2] ?? '';
    if (!text.startsWith('.') && !text.includes('/')) found.push(text);
    match = pattern.exec(source);
  }
  return found;
}

function offendersIn(text: string, where: string): string[] {
  return FORBIDDEN.filter((word) => text.toLowerCase().includes(word.toLowerCase())).map(
    (word) => `${where}: "${word}" statt der Umlautschreibweise`
  );
}

describe('Deutsche Ausgabe', () => {
  it('nutzt in der Oberflaeche echte Umlaute', () => {
    const offenders: string[] = [];
    for (const file of [
      ...sourceFiles('src/ui', /\.ts$/),
      ...sourceFiles('src/app', /\.ts$/),
      ...sourceFiles('src/core', /\.ts$/),
    ]) {
      const source = readFileSync(file, 'utf8');
      for (const literal of stringLiterals(source)) {
        offenders.push(...offendersIn(literal, `${file} → ${literal}`));
      }
    }
    expect(offenders).toEqual([]);
  });

  it('nutzt in content/ echte Umlaute', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles('content', /\.json$/)) {
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<
        string,
        Record<string, unknown>
      >;
      for (const [id, entry] of Object.entries(parsed)) {
        for (const field of ['name', 'description']) {
          const value = entry[field];
          if (typeof value !== 'string') continue;
          offenders.push(...offendersIn(value, `${file} → ${id}.${field} "${value}"`));
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('faengt eine Ersatzschreibweise wirklich', () => {
    // Der Test ist nur so viel wert, wie er auch findet.
    expect(offendersIn('Ruestung 12', 'probe')).toHaveLength(1);
    expect(offendersIn('Rüstung 12', 'probe')).toEqual([]);
    // Woerter ohne Umlautbedarf bleiben unbehelligt.
    expect(offendersIn('Induktionsstab', 'probe')).toEqual([]);
    expect(offendersIn('Biss', 'probe')).toEqual([]);
    expect(offendersIn('Druckmesser', 'probe')).toEqual([]);
  });
});

describe('Vokabelliste', () => {
  it('benennt jede Schadensart, jeden Steckplatz, jedes Attribut und jeden Grad', () => {
    for (const type of DAMAGE_TYPES) expect(DAMAGE_TYPE_NAMES[type]).toBeTruthy();
    for (const slot of EQUIP_SLOTS) expect(SLOT_NAMES[slot]).toBeTruthy();
    for (const attr of ['strength', 'agility', 'vitality', 'focus'] as const) {
      expect(ATTRIBUTE_NAMES[attr]).toBeTruthy();
    }
    for (const difficulty of DIFFICULTY_ORDER) expect(DIFFICULTY_NAMES[difficulty]).toBeTruthy();
    for (const effect of EFFECT_ORDER) expect(EFFECT_NAMES[effect]).toBeTruthy();
  });

  it('faellt bei einem unbekannten Effekt auf die Id zurueck', () => {
    expect(effectName('gibtsnicht')).toBe('gibtsnicht');
    expect(effectName('burn')).toBe('Brand');
  });

  it('benennt jede Schadensart einzeln', () => {
    expect(damageTypeName('physical')).toBe('physisch');
    expect(damageTypeName('void')).toBe('Leere');
    for (const type of DAMAGE_TYPES) expect(damageTypeName(type)).toBe(DAMAGE_TYPE_NAMES[type]);
  });
});

describe('Meldungsprotokoll', () => {
  it('schreibt Kampf, Aufnahme und Aufstieg auf Deutsch', () => {
    const { state, content } = setup({
      seed: 4,
      spawn: { pos: { x: 1, y: 1 }, facing: 1 },
      entities: [
        { kind: 'enemy', defId: 'tank', pos: { x: 2, y: 1 } },
        { kind: 'item', defId: 'medkit', pos: { x: 1, y: 2 } },
      ],
    });
    state.player.attributes.agility = 200;

    applyCommand(state, { type: 'attack' }, content);
    // Blick nach Osten, das Medkit liegt suedlich: das ist 'right'.
    applyCommand(state, { type: 'move', dir: 'right' }, content);

    const texts = state.log.map((entry) => entry.text);
    expect(texts.some((text) => text.startsWith('physisch trifft für'))).toBe(true);
    expect(texts).toContain('Medkit aufgenommen (20)');
    // Kein englischer Rest im Protokoll.
    for (const text of texts) {
      expect(text).not.toMatch(/\b(hit for|missed|picked up|died|reached level|used)\b/);
    }
  });

  it('meldet Aufstieg, Ablegen und Fertigkeiten auf Deutsch', () => {
    const { state, content } = setup();
    state.player.level = 20;
    state.player.unspentSkillPoints = 1;
    state.player.unspentAttributePoints = 1;

    applyCommand(state, { type: 'spendAttribute', attr: 'vitality' }, content);
    applyCommand(state, { type: 'spendSkillPoint', skillId: 'precise_strike' }, content);
    applyCommand(state, { type: 'unequip', slot: 'weapon' }, content);

    const texts = state.log.map((entry) => entry.text);
    expect(texts).toContain('Punkt auf Konstitution');
    expect(texts).toContain('Punkt auf Zielschlag');
    expect(texts.some((text) => text.startsWith('Brechstange abgelegt'))).toBe(true);
  });
});
