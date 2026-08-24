# PHASE 8, Nachtrag

Gilt zusätzlich zu `docs/tasks/PHASE_8.md`. Ist Phase 8 bereits abgearbeitet, ist dies eine
eigenständige kleine Aufgabe. Läuft sie noch, gehören diese Punkte hinein.

Pflichtlektüre: `docs/INTERFACES.md` v1.10, `docs/CONTENT_TABLES.md` v1.4,
`docs/BESTIARY.md`, `docs/ART_PROMPTS.md`.

**Prüfe zuerst, ob alle vier Dateien vorhanden sind und ob INTERFACES auf v1.10 und
CONTENT_TABLES auf v1.4 stehen.** Fehlt eine oder ist die Version niedriger, brich ab.

---

## 1. Spritegrößen folgen spriteWidth

PHASE_8 Block 1 nennt für `prepAsset` feste Größen je Typ. Das gilt für `texture`,
`weapon` und `icon` weiterhin. Für Gegner gilt jetzt CONTENT_TABLES Abschnitt 6:

| spriteWidth | Kantenlänge |
|---|---|
| bis 1.0 | 64 |
| über 1.0 bis 1.5 | 96 |
| über 1.5 | 128 |

Der Typ `boss` in `prepAsset` entfällt. Stattdessen ermittelt `prepAsset` beim Typ `sprite`
die Zielgröße aus `content/enemies.json`, indem es `spriteWidth` der Einheit nachschlägt,
deren Name im Dateinamen steht. Ist die Einheit unbekannt, bricht es ab und nennt den
Namen. Kein stiller Rückfall auf 64.

`checkAssets` erwartet je Datei genau diese Größe und meldet Abweichungen.

Der Loader liest die Größe aus der Datei, nicht aus einer Konstante. Falls in
`assetLoader.ts` eine feste 64 steht, entfernen.

## 2. Neue Textur-Id 55

CONTENT_TABLES Abschnitt 6 führt Id 55 als freistehenden Ölfleck ohne Kantenanbindung.
Id 64 ist jetzt eine gerade Ölspur und Teil des Zone-1-Spursatzes.

Im Generator entsprechend ändern:
- der Spursatz für Zone 1 ist 64, 65 gerade, 66 Kurve, 67 Anfang, 68 Ende
- der freistehende Ölfleck ist Id 55, wird einzeln gesetzt, nie gedreht, nie an eine Spur
  angeschlossen und nie auf eine Spurkachel

Die bisherige Sonderbehandlung von 64 als freistehender Fleck entfällt.
`gen:maps` neu laufen lassen, die Karten ändern sich.

Der Platzhaltergenerator braucht für 55 eine eigene Platzhaltertextur.

## 3. Beschwörungen auf Sohle 16

BESTIARY Abschnitt 10 nennt jetzt ausdrücklich die vier Archetypen, die `boss_sorlax` in
Phase 2 ruft: `crawler_void`, `cultist_void`, `hauler_void`, `warden_void`.

Prüfe, ob `src/core/bosses/sorlax.ts` genau diese Liste verwendet. Falls dort eine andere
oder eine selbst gewählte Liste steht, korrigieren und im Bericht nennen, welche es war.

## 4. Frameanzahl

BESTIARY Abschnitt 4 nennt zwölf Frames je Einheit, für Archetypen und Bosse gleichermaßen.
Prüfe, dass `content/enemies.json` für jede Einheit genau diese zwölf Framenamen führt und
dass der Contentlint gegen zwölf prüft, nicht gegen elf.

## Tests

1. `prepAsset` erzeugt für `warden_idle_0.png` eine 96 x 96 Datei, für `rat_idle_0.png`
   eine 64 x 64 und für `boss_sporemother_idle_0.png` eine 128 x 128
2. `prepAsset` bricht bei einem unbekannten Einheitennamen ab
3. `checkAssets` meldet eine Datei mit falscher Kantenlänge
4. Keine Karte setzt Id 55 auf eine Kachel, die zu einer Spur gehört
5. Jede Zone-1-Spur besteht aus Ids aus 64 bis 68
6. Jede Einheit in `content/enemies.json` hat genau zwölf Framenamen
7. `sorlax.ts` ruft genau die vier genannten Archetypen
8. Zweimaliger Lauf von `gen:maps` erzeugt weiterhin byteweise identische Dateien

## Abschluss

`npm run typecheck`, `npm test`, `npm run gen:maps` und `npm run check:assets` grün.
Commit mit `fix(assets): sprite sizes from spriteWidth, oil stain id, frame count`.

Melde abschließend, welche Beschwörungsliste in `sorlax.ts` stand, bevor du sie geändert
hast.
