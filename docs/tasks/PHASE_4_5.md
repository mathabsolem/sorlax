# PHASE 4.5 — Inventar, Charakterbogen, Fertigkeitenbaum

Vorbedingung: Phase 4 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/INTERFACES.md` v1.3, `docs/RPG.md`, `docs/BESTIARY.md` v3.

**Prüfe zuerst, ob alle drei Dateien vorhanden sind.** Fehlt eine, brich sofort ab und
melde welche. Erfinde keine Spielwerte.

INTERFACES bleibt ein Vertrag. Ändere dort nichts, melde Lücken.

---

## Umfang

`src/ui/`, `tests/`. `src/core/` wird gelesen, nicht verändert.
`src/ui/` mutiert den `GameState` niemals, es erzeugt ausschließlich `Command`-Objekte.

Drei Vollbildansichten, erreichbar über I, K und C, sowie über Knöpfe im Menü.
Alle drei blockieren die Spieleingabe, solange sie offen sind, und kosten keine Runde.

## Block 1, Bedienmuster

**Kein Ziehen und Ablegen.** Auf einem Handydisplay mit 40 Plätzen ist das fehleranfällig
und langsam. Stattdessen: Antippen wählt einen Gegenstand aus, darunter erscheint eine
Leiste mit den möglichen Aktionen. Anlegen, Ablegen, Untersuchen, Fallenlassen.

Doppeltippen legt direkt an, sofern die Voraussetzungen erfüllt sind. Das ist die
Abkürzung für geübte Spieler, nicht der einzige Weg.

Alle Trefferflächen mindestens 48 x 48 CSS-Pixel. Bei 40 Plätzen bedeutet das ein Raster
von fünf Spalten mit Scrollen, nicht acht Spalten gequetscht.

## Block 2, Inventaransicht

`src/ui/inventory.ts`.

Zwei Bereiche:
- oben die Puppe mit zehn Steckplätzen in anatomischer Anordnung, Waffe und Zusatzschutz
  links und rechts, Messgeräte an den Handgelenken
- unten das Raster mit 40 Plätzen, scrollbar

Jeder Platz zeigt das Symbol aus `ItemDef.icon` und einen Rahmen in der Raritätsfarbe aus
Phase 4 Block 1. Nicht identifizierte Gegenstände bekommen zusätzlich ein Fragezeichen.

Belegte Zahl wird angezeigt, Format `31 / 40`. Bei vollem Inventar wird der Zähler rot.

Verbrauchsgüter und Munition erscheinen nicht im Raster, sondern in einer eigenen
schmalen Leiste, weil sie in `consumables` und `ammo` als Zähler liegen und keine
Instanzen sind.

## Block 3, Gegenstandsdetails

Die wichtigste Ansicht im ganzen Spiel. Sie entscheidet, ob das Itemsystem Spaß macht.

Angezeigt wird:
- Name in Raritätsfarbe, darunter Grundtyp und Steckplatz
- `itemLevel`
- Grundwerte aus `baseModifiers`
- jeder Affix als eigene Zeile mit seinem gewürfelten Wert
- Voraussetzungen, jede nicht erfüllte Zeile in Rot
- bei nicht identifizierten Teilen nur Grundwerte plus ein Hinweis

**Vergleich mit dem Getragenen.** Ist der passende Steckplatz belegt, wird hinter jedem
Wert die Differenz zum aktuell getragenen Teil angezeigt, grün bei Verbesserung, rot bei
Verschlechterung, in der Form `+12` oder `-3`. Werte, die nur eines der beiden Teile hat,
zählen gegen Null.

Zusätzlich eine Zusammenfassung: die Veränderung von `maxHealth`, `armor`, `accuracy`,
`evasion` und den fünf Resistenzen, berechnet über `getDerivedStats` mit einem
hypothetisch angelegten Teil. Diese Berechnung darf den echten Zustand nicht anfassen,
sie arbeitet auf einer flachen Kopie.

## Block 4, Identifizieren

`content/items.json` bekommt das Verbrauchsgut `scanner_charge`, Typ `heal` ist falsch,
also Typ `powerup` mit `amount` 1.

Anwenden auf einen nicht identifizierten Gegenstand setzt `identified` auf true und kostet
eine Runde. Umsetzung über ein neues Kommando ist nicht nötig, `useConsumable` bekommt ein
optionales Ziel über die vorhandene Signatur nicht her. Melde das als Vertragslücke, bevor
du etwas erfindest.

Anmerkung zur Vorlage: RPG.md Abschnitt 4 nennt eine Fertigkeit `field_analysis` ab
Stufe 3 als zweiten Weg. Diese Fertigkeit existiert in keinem der drei Bäume aus
`content/skills.json`. Lege sie als gesperrten Platzhalter in `tree_endure` an, ohne
Wirkung. Der einzige funktionierende Weg bleibt vorerst das Verbrauchsgut.

## Block 5, Charakterbogen

`src/ui/character.ts`.

Links die vier Attribute mit aktuellem Wert und einem Plusknopf, sichtbar nur solange
`unspentAttributePoints` über 0 steht. Ein Klick erzeugt `spendAttribute`.

**Punkte sind endgültig.** Beim ersten Vergeben in einer Sitzung erscheint einmal ein
Hinweis darauf, danach nicht mehr. Kein Bestätigungsdialog pro Klick, das nervt.

Rechts die abgeleiteten Werte aus `getDerivedStats`, alle Felder aus `DerivedStats`,
Resistenzen als eigener Block mit Farbcodierung nach Element. Negative Resistenzen rot.

Darunter Level, Erfahrung, Schwierigkeitsgrad, Spielzeit und Rundenzahl.

Jeder abgeleitete Wert bekommt bei Berührung eine Aufschlüsselung: Basis aus Attributen,
Beitrag aus Ausrüstung, Beitrag aus Fertigkeiten. Ohne diese Aufschlüsselung versteht
niemand, warum seine Genauigkeit bei 43 liegt.

## Block 6, Fertigkeitenbaum

`src/ui/skills.ts`.

Drei Reiter für die drei Bäume. Je Baum drei Stufen untereinander, je Stufe zwei
Fertigkeiten nebeneinander.

Je Fertigkeit: Name, Symbol, `punkte / maxPoints`, Kurzbeschreibung, und die Wirkung beim
nächsten Punkt konkret ausgerechnet, nicht als Formel. Also `Genauigkeit 9 auf 12`, nicht
`plus 3 pro Punkt`.

Zustände:
- vergebbar, Plusknopf sichtbar
- gelernt und voll, Plusknopf aus
- gesperrt wegen `reqLevel` oder `reqPointsInTree`, mit Angabe was fehlt
- gesperrt wegen `locked`, abgeblendet mit dem Hinweis, dass dieser Baum noch nicht
  verfügbar ist

`tree_reaction` und `tree_endure` sind vollständig abgeblendet. Sie werden trotzdem
gezeichnet, damit sichtbar ist, dass es sie gibt.

Fertigkeitsleiste: gelernte aktive Fertigkeiten lassen sich per Antippen auf einen der
sechs Plätze der HUD-Leiste legen. Die Belegung gehört in `state.flags` unter
`skillbar_<index>`, damit sie im Spielstand landet.

## Block 7, Verdrahtung

- I öffnet das Inventar, K die Fertigkeiten, C den Charakterbogen, Escape schließt
- am unteren Rand der drei Ansichten je ein Reiter zum direkten Wechseln, damit man nicht
  über das Menü muss
- ein roter Punkt auf dem jeweiligen Symbol im HUD, solange Punkte unvergeben sind
- beim Aufnehmen eines Gegenstands, der besser ist als das Getragene, eine kurze Meldung
  im Protokoll. Als besser gilt: gleicher Steckplatz und höhere Summe aus `maxHealth`,
  `armor`, `accuracy`, `evasion` in der Vergleichsrechnung aus Block 3

## Tests

Kein jsdom. Berechnungen werden aus der Oberfläche in reine Funktionen gezogen und dort
geprüft.

1. `canEquip(player, item, content)` liefert false bei zu niedriger Kraft und nennt das
   fehlende Attribut
2. `compareItems(state, candidate, content)` liefert für ein Teil mit `+20 maxHealth`
   gegen ein getragenes mit `+8` die Differenz `+12`
3. `compareItems` mutiert den übergebenen Zustand nicht, geprüft über eine Serialisierung
   vor und nach dem Aufruf
4. `compareItems` zählt einen Affix, den nur der Kandidat hat, gegen Null
5. `formatAffix` erzeugt für `suf_of_embers` mit Wert 14 die erwartete Zeichenkette
6. `affixLines` eines nicht identifizierten Teils enthält keine Affixwerte
7. `skillNodeState` liefert für `breach` bei Level 5 gesperrt mit Grund `reqLevel`
8. `skillNodeState` liefert für `breach` bei Level 6 und 1 Punkt in Stufe 1 gesperrt mit
   Grund `reqPointsInTree`
9. `nextPointPreview` für `precise_strike` bei 3 Punkten liefert die Werte 9 und 12
10. `statBreakdown` für `accuracy` summiert Basis, Ausrüstung und Fertigkeiten genau zum
    Wert aus `getDerivedStats`
11. `isUpgrade` erkennt ein besseres Teil und lehnt ein gleichwertiges ab
12. Die Skillleistenbelegung überlebt Serialisieren und Deserialisieren
13. Der Determinismustest aus Phase 2 ist weiterhin grün

Test 10 ist der wichtigste. Wenn die Aufschlüsselung nicht exakt zur Summe passt, ist
entweder die Anzeige falsch oder `getDerivedStats`, und beides fällt sonst erst beim
Balancieren auf.

## Abnahmekriterium

`npm run dev` erlaubt es, einen gefundenen Gegenstand zu untersuchen, mit dem getragenen
zu vergleichen, anzulegen, und die Änderung im Charakterbogen wiederzufinden. Attribut-
und Fertigkeitspunkte lassen sich vergeben, eine aktive Fertigkeit lässt sich auf die
Leiste legen und im Kampf auslösen.

`npm run typecheck` und `npm test` grün.
Commit mit `feat(ui): inventory, item comparison, character sheet, skill tree`.
Danach anhalten.
