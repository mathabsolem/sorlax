# PHASE 5 — Vertragsnachzug, fehlende Inhalte, Gegner-Generator

Vorbedingung: Phase 4.5 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/INTERFACES.md` v1.5, `docs/BESTIARY.md` v3,
`docs/CONTENT_TABLES.md`, `docs/RPG.md`, `docs/SPEC.md` v1.2.

**Prüfe zuerst, ob alle fünf Dateien vorhanden sind und ob INTERFACES auf v1.5 steht.**
Fehlt eine oder ist die Version niedriger, brich sofort ab und melde es.
Erfinde keine Spielwerte.

INTERFACES v1.5 ersetzt die Fassung im Repo. Alle Punkte aus der Rückmeldung nach Phase 4.5
sind darin entschieden. Ändere die Datei nicht weiter, melde neue Lücken.

---

## Block 1, Vertragsnachzug

Vier Änderungen aus v1.5 umsetzen:

1. `ItemDef.slot` wird zu `slots: EquipSlot[]`. Die Messgeräte tragen künftig
   `slots: ['gauge_left', 'gauge_right']`. Die Ausweichlogik in `equipAction`, die den
   Zwillingsplatz sucht, bleibt bestehen, stützt sich aber auf `slots` statt auf eine
   Sonderregel. Entferne den Kommentar zur Umgehung.
2. `GameEvent` bekommt `unequipped`. Alle Stellen, die das Ablegen bisher als `message`
   melden, stellen um. Die Oberfläche wertet es aus.
3. `SaveMeta` bekommt `mapName`. Beim Schreiben eines Standes wird der Name aus der
   `ContentDb` aufgelöst und mitgespeichert. Die Umgehung im Menü, das zusätzlich die
   `ContentDb` bekommt, wird zurückgebaut.
4. `rollItem` bekommt als siebten Parameter `uid: number` statt `state`. Der Aufrufer liest
   `state.nextItemUid`, übergibt ihn und erhöht ihn. `rollItem` kennt den `GameState`
   danach nicht mehr.

Die drei erweiterten Signaturen aus Task-Dateien, `createInstance`, `freeTilesAround` und
`applyEffect`, bleiben wie umgesetzt. Sie waren nie Teil des Vertrags.

## Block 2, positive Effekte und Heilmittel

`getDerivedStats` bezieht `ActiveEffect` ein. Regel:
- Effekte aus SPEC 4.5 wirken wie bisher, `drain` senkt `maxHealth` und `armor`
- Effekte aus CONTENT_TABLES Abschnitt 1 wirken additiv auf das dort genannte Feld
- Die Beiträge werden wie Ausrüstungsaffixe behandelt: flach aufsummieren, prozentual
  aufsummieren und einmal anwenden

`useConsumable` bekommt zwei neue Fälle:
- `ItemDef.effect.id` mit Präfix `cure_` entfernt den Effekt hinter dem Präfix vom Spieler
  und erzeugt ein `effectExpired`-Ereignis
- alle übrigen `effect`-Einträge werden über `applyEffect` gesetzt

`targetUid` aus v1.4 wird für `scanner_charge` ausgewertet: Der Gegenstand mit dieser `uid`
wird auf `identified: true` gesetzt. Fehlt `targetUid` oder ist der Gegenstand bereits
identifiziert, ist das Kommando ungültig und kostet keine Runde.

## Block 3, fehlende Inhalte

`content/items.json` um alle Einträge aus CONTENT_TABLES Abschnitt 1 erweitern, also acht
Verbrauchsgüter, `scanner_charge` sofern noch nicht vorhanden, und fünf Munitionssorten für
die Elementwaffen.

`content/uniques.json` neu anlegen mit den acht Einträgen aus CONTENT_TABLES Abschnitt 2.

`content/enemies.json`: die vier Bosse um die Felder aus CONTENT_TABLES Abschnitt 3
ergänzen beziehungsweise korrigieren. `boss_sporemother` bekommt `aggroRange` 20.

Garantierte Bossbeute: Beim Tod eines Bosses fällt zusätzlich zum normalen Wurf der zu ihm
gehörende einzigartige Gegenstand aus CONTENT_TABLES Abschnitt 2, ohne Wurf. Zuordnung
über ein neues Feld `guaranteedUniqueId` in `EnemyDef`. Melde das als Vertragslücke, bevor
du es hinzufügst, und warte auf Freigabe. Bis dahin über `drops` mit Chance 1.0 lösen.

## Block 4, Gegner-Generator

`scripts/genEnemies.ts`, ausgeführt über ein npm-Skript `gen:enemies`.
Kein Laufzeitcode, das Ergebnis wird committet.

Eingabe: die Archetypentabelle aus BESTIARY Abschnitt 4, die Resistenzprofile aus
Abschnitt 2, die Elementmodifikatoren aus Abschnitt 3, die Gegnerwaffen aus Abschnitt 5
und der Sohlenplan aus Abschnitt 10.

Diese Werte werden als TypeScript-Konstanten im Skript gehalten, nicht aus dem Markdown
gelesen. Sie sind identisch mit denen in `tests/content.lint.test.ts`. Ziehe sie in eine
gemeinsame Datei `scripts/canonical.ts`, damit es nur eine Quelle gibt.

Ausgabe: alle im Sohlenplan genannten Kombinationen aus Archetyp und Element, insgesamt 28,
plus die vorhandenen vier Bosse.

Je Eintrag:
- `id` nach dem Schema `<archetyp>_<element>`
- `archetype`, `element`, `name` mit deutschem Zusatz je Element, etwa
  "Brennende Grubenratte", "Vergiftete Grubenratte", "Erfrorene Grubenratte",
  "Geladene Grubenratte", "Leere Grubenratte"
- Basiswerte mit dem Elementmodifikator aus Abschnitt 3 multipliziert und gerundet
- `resistances` aus dem Profil des Elements
- `weaponId` als geklonte Waffe `<waffe>_<element>`, bei `physical` die Grundwaffe
- `frames` mit den Dateinamen des Archetyps, Varianten teilen sich die Dateien
- `drops` und `dropTableId` nach BESTIARY Abschnitt 9

Die geklonten Gegnerwaffen erzeugt dasselbe Skript nach `content/weapons.json`:
`damageType` und `appliesEffect` auf das Element gesetzt, alle übrigen Felder unverändert.

Der Elementmodifikator wirkt auf `baseHealth`, `baseAccuracy` und `baseEvasion`.
Er wirkt nicht auf `baseArmor`, `baseXp` oder `speed`.

## Block 5, Prüfungen

`tests/content.lint.test.ts` erweitern:
- alle 28 Varianten existieren, mit den erwarteten Ids
- `rat_fire` hat genau die Werte, die sich aus Basis mal Modifikator ergeben, mit einem
  fest hinterlegten Erwartungswert im Test, nicht neu berechnet
- jede Variante hat das Resistenzprofil ihres Elements, ausformuliert geprüft
- jede referenzierte `weaponId` existiert in `content/weapons.json`
- jede in `drops` referenzierte `defId` existiert in `content/items.json`
- jede in `uniques.json` referenzierte `affixId` und `baseId` existiert
- kein Eintrag in `content/` referenziert eine unbekannte Id

Der letzte Punkt ist der wichtigste. Er hätte die still verschluckten Drops aus der
Rückmeldung sofort aufgedeckt.

Weitere Tests:
1. `plating` erhöht die Rüstung um 10 und läuft nach 20 Runden ab
2. `antitoxin` entfernt `toxin` und heilt 10
3. `scanner_charge` ohne `targetUid` ist ungültig und kostet keine Runde
4. `scanner_charge` auf ein bereits identifiziertes Teil ist ungültig
5. Ein Messgerät lässt sich in beide Handgelenke legen, aber nicht zweimal dasselbe
   einzigartige Teil
6. `unequipped` wird beim Ablegen erzeugt, `message` nicht mehr
7. `rollItem` gibt bei gleichem RNG-Zustand und gleicher `uid` dasselbe Ergebnis
8. Ein Bosstod hinterlässt sein garantiertes einzigartiges Teil
9. Der Determinismustest aus Phase 2 ist weiterhin grün

## Block 6, PHASE_3_6 Test 14 korrigieren

Der Test erwartet 40 bis 80 ausgerüstete Gegner bei 200. Verbindlich sind 9 Prozent aus
RPG.md Abschnitt 9, Erwartungswert 18. Ändere den erwarteten Bereich auf 8 bis 32. Der
Bereich ist bewusst weit, weil ein enger Bereich bei einem Zufallswurf gelegentlich ohne
Fehler fehlschlägt.

## Abschluss

`npm run typecheck`, `npm test` und `npm run gen:enemies` grün.
Commit mit `feat(content): enemy generator, consumables, uniques, contract v1.5`.

Melde abschließend:
- ob `guaranteedUniqueId` als Vertragslücke bestätigt wurde oder über `drops` gelöst ist
- welche Referenzen der neue Vollständigkeitstest gefunden hat, die ins Leere liefen
- neue Widersprüche zwischen Dokumenten

Danach anhalten. Der Kartengenerator ist Phase 6.
