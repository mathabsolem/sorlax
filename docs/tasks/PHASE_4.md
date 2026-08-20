# PHASE 4 — HUD, Automap, Menü, lokales Speichern

Vorbedingung: Phase 3.8 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/SPEC.md` v1.2, `docs/INTERFACES.md` v1.3, `docs/RPG.md`.

**Prüfe zuerst, ob alle drei Dateien vorhanden sind.** Fehlt eine, brich sofort ab und
melde welche. Erfinde keine Werte, die dort stehen sollten.

INTERFACES bleibt ein Vertrag. Ändere dort nichts, melde Lücken.

Inventar, Charakterbogen und Fertigkeitenbaum gehören nicht in diese Phase. Sie kommen in
Phase 4.5. Diese Phase liefert alles, was während des Spielens sichtbar ist.

---

## Umfang

`src/ui/`, `src/net/` nur für die lokale Ablage, `src/app/`, `tests/`.
`src/core/` wird gelesen, nicht verändert.

Harte Regel: `src/ui/` mutiert den `GameState` niemals. Es liest ihn und erzeugt
`Command`-Objekte. Jede Zustandsänderung läuft über `applyCommand`.

## Block 1, Aufbau der Oberfläche

Die Oberfläche ist DOM über dem Canvas, nicht in den Pixelpuffer gezeichnet.
Ausnahme ist die Automap, siehe Block 5.

Ebenen von unten nach oben:
1. Spiel-Canvas
2. HUD, nicht anklickbar, `pointer-events: none`
3. Bedienelemente aus Phase 3, anklickbar
4. Vollbildansichten wie Menü und Karte, blockieren die Eingabe darunter

Alles in einer CSS-Datei `src/ui/ui.css`, keine Inline-Styles im TypeScript außer für
Werte, die sich pro Bild ändern.

Positionierung mit `env(safe-area-inset-*)`. Bedienflächen mindestens 48 x 48 CSS-Pixel.

Farben und Abstände als CSS-Variablen in `:root`. Raritätsfarben verbindlich:
normal grau `#b8b8b8`, magisch blau `#5a8fd4`, selten gelb `#d4c25a`,
einzigartig orange `#d4915a`.

## Block 2, HUD

`src/ui/hud.ts`. Angezeigt werden:

- Lebensbalken mit Zahl, Format `health / maxHealth`
- Rüstungswert
- aktuelle Waffe mit Namen und Munitionsstand, bei Nahkampf statt Munition ein Strich
- aktive Statuseffekte als kleine Symbole mit Restrundenzahl, Reihenfolge wie in SPEC 4.5
- Erfahrungsbalken mit Level, Fortschritt zur nächsten Schwelle aus `progression`
- Fertigkeitsleiste mit sechs Plätzen, belegt mit gelernten aktiven Fertigkeiten,
  abgeblendet solange `cooldowns[skillId]` über 0 steht, mit Restrundenzahl
- Rundenzähler und Sohlenname

**Aktualisierung ausschließlich ereignisgesteuert.** Das HUD wird nach jedem
`applyCommand` einmal aktualisiert, nicht in der Renderschleife. Ein HUD, das 60 mal pro
Sekunde DOM schreibt, kostet auf Mobilgeräten mehr als der gesamte Raycaster.

Zahlen, die sich geändert haben, werden kurz hervorgehoben, 300 ms, per CSS-Klasse.

## Block 3, Zielanzeige

Wird ein Gegner über `pickEntityAt` oder die Tastatur angewählt, erscheint oben mittig:
Name, Lebensbalken, Rang als farbiger Rahmen, `common` ohne, `equipped` blau, `boss` orange.

Zusätzlich die Elementzugehörigkeit als kleines Symbol. Resistenzwerte werden nicht
angezeigt, solange der Spieler den Gegner nicht mindestens einmal getroffen hat. Danach
werden die Werte gezeigt, die er selbst verursacht hat.

Die dafür nötigen Kenntnisse liegen in `state.flags` unter dem Schlüssel
`known_res_<enemyDefId>_<damageType>`.

## Block 4, Meldungsprotokoll

`src/ui/log.ts`. Zeigt die letzten fünf Einträge aus `state.log`, älteste oben, mit
Einblendung und automatischem Ausblenden nach 8 Sekunden. Vollständiges Protokoll über
eine Taste erreichbar, dort alle 100 Einträge scrollbar.

Farbcodierung nach `LogEntry.kind`: `combat` weiß, `pickup` grün, `skill` blau,
`story` gelb, `system` grau.

## Block 5, Automap

`src/ui/automap.ts`, eigener Canvas, nicht der Pixelpuffer des Spiels.

- zeichnet nur Kacheln aus `MapRuntimeState.explored`
- Wände als Striche, begehbarer Boden dunkel gefüllt, Türen farbig nach Schlüsselfarbe
- Spielerposition als Dreieck in Blickrichtung
- Ausgänge markiert, Gegner nicht
- zwei Ansichten: kleine Übersicht in einer Ecke, umschaltbar auf Vollbild
- Zoom und Verschieben im Vollbild per Geste

`explored` wird beim Bewegen gefüllt: alle Kacheln in Sichtlinie und innerhalb
`lightRadius` plus 2 werden ergänzt. Diese Ergänzung gehört nach `src/core/`, in eine
Funktion `updateExplored(state, content)`, aufgerufen aus `applyCommand` nach einer
Bewegung. Sie ist der einzige Eingriff in `core` in dieser Phase.

## Block 6, Menü

`src/ui/menu.ts`. Vollbild, blockiert Eingaben darunter.

Einträge: Fortsetzen, Speichern, Laden, Einstellungen, Spiel beenden.
Einstellungen: Lautstärke, Empfindlichkeit der Bedienelemente, Anzeige der Schadenszahlen,
Sprache vorbereitet aber ohne Auswahl.

Vier Speicherplätze je Schwierigkeitsgrad: drei manuelle und einer für Autosave.
Jeder Platz zeigt Level, Sohle, Spielzeit und Zeitstempel aus `SaveMeta`.

Der Autosave-Platz kann geladen, aber nicht überschrieben werden.

## Block 7, Lokale Ablage

`src/net/localStore.ts` mit `idb`.

```ts
export interface LocalStore {
  list(): Promise<SaveMeta[]>;
  read(difficulty: Difficulty, slot: number): Promise<{ meta: SaveMeta; state: GameState } | null>;
  write(difficulty: Difficulty, slot: number, state: GameState): Promise<SaveMeta>;
  remove(difficulty: Difficulty, slot: number): Promise<void>;
}
```

- Schlüssel `<difficulty>:<slot>`
- `checksum` als SHA-256 über den serialisierten Zustand, per `crypto.subtle`
- Autosave bei Sohlenwechsel und alle 50 Runden, ausgelöst in `src/app/`, nicht in `core`
- Vor dem Schreiben wird die Größe geprüft. Über 2 MB wird nicht geschrieben, sondern eine
  Meldung erzeugt. Diese Grenze steht in SPEC Abschnitt 11 und ist kein Richtwert

Die Anbindung an den PHP-Endpunkt kommt in Phase 8. `ApiClient` wird hier nicht angefasst.

## Block 8, Verdrahtung

`src/app/main.ts` erweitern:
- nach jedem `applyCommand` erst `renderer.consumeEvents`, dann `hud.update`,
  dann `log.push`
- Eingabesperre aus Phase 3 bleibt, zusätzlich sperren offene Vollbildansichten
- Tastenbelegung nach SPEC Abschnitt 12 vervollständigen

## Tests

Kein jsdom. Getestet werden ausschließlich reine Funktionen, die aus der Oberfläche
herausgezogen sind. Wo eine Funktion nicht testbar ist, weil sie DOM anfasst, wird die
Berechnung in eine eigene reine Funktion getrennt.

1. `formatHealth` liefert für 37 von 120 die erwartete Zeichenkette und einen Anteil von
   0.308, gerundet auf drei Stellen
2. `xpProgress` liefert bei Level 5 mit 40 Prozent Fortschritt genau 0.4
3. `skillSlotState` liefert für eine Fertigkeit mit Abklingzeit 3 den Zustand gesperrt mit
   Restwert 3, bei 0 den Zustand bereit
4. `updateExplored` ergänzt genau die Kacheln in Sichtlinie innerhalb `lightRadius` plus 2
   und keine dahinter
5. `updateExplored` ist idempotent, ein zweiter Aufruf ohne Bewegung ändert nichts
6. `automapTiles` liefert für eine Testkarte die erwartete Menge an Wandkanten
7. `saveSizeOf` erkennt einen Zustand über 2 MB und liefert false
8. `checksum` ist stabil: derselbe Zustand ergibt zweimal denselben Wert, ein geänderter
   einen anderen
9. Ein Zustand, geschrieben und wieder gelesen, ist strukturgleich. Der Test nutzt eine
   Attrappe des Speichers, kein echtes IndexedDB
10. Der Determinismustest aus Phase 2 ist weiterhin grün

## Abnahmekriterium

`npm run dev` zeigt ein vollständiges HUD, das sich beim Spielen aktualisiert. Ein
angewählter Gegner erscheint oben. Die Automap füllt sich beim Erkunden. Speichern und
Laden funktioniert über das Menü, und ein geladener Stand läuft identisch weiter.

`npm run typecheck` und `npm test` grün.
Commit mit `feat(ui): hud, target display, log, automap, menu, local saves`.
Danach anhalten. Phase 4.5 nicht beginnen.
