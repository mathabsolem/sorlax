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
    for (const file of [...sourceFiles('src/ui', /\.ts$/), ...sourceFiles('src/app', /\.ts$/)]) {
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
