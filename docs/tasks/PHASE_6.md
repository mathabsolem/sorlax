# PHASE 6 — Kartengenerator und Validator

Vorbedingung: Phase 5 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/INTERFACES.md` v1.6, `docs/SPEC.md` v1.2, `docs/BESTIARY.md` v3,
`docs/CONTENT_TABLES.md` v1.1, `docs/RPG.md`.

**Prüfe zuerst, ob alle fünf Dateien vorhanden sind und ob INTERFACES auf v1.6 und
CONTENT_TABLES auf v1.1 stehen.** Fehlt eine oder ist die Version niedriger, brich sofort
ab und melde es. Erfinde keine Spielwerte.

INTERFACES bleibt ein Vertrag. Ändere dort nichts, melde Lücken.

---

## Block 0, Vertragsnachzug aus v1.6

Drei Felder umsetzen, die die Umgehungen aus Phase 5 ablösen:

1. `EnemyDef.guaranteedUniqueId`. Die vier Bosse bekommen ihre Zuordnung aus
   CONTENT_TABLES Abschnitt 2. `src/core/bossLoot.ts` mit seiner Tabelle `BOSS_UNIQUES`
   entfällt, die Logik liest künftig das Feld.
2. `UniqueDef.bossExclusive`. `rollItem` zieht solche Einträge nie. Die vier Bossstücke
   bekommen `true`, die übrigen vier `false` oder das Feld gar nicht.
3. `ItemDef.ammoType`. Die Hilfsfunktion `ammoTypeOf` mit dem Präfixschnitt entfällt,
   `stow` bucht unter `ItemDef.ammoType`. Die Bedeutung von `amount` folgt CONTENT_TABLES
   Abschnitt 1: bei `heal` die Heilmenge, bei `ammo` die Stapelgröße.

Zusätzlich `content/items.json` an CONTENT_TABLES v1.1 angleichen: `antitoxin` wird
`type: 'heal'` mit `amount` 10 und `effect: { id: 'cure_toxin', turns: 0, magnitude: 0 }`.

Und die Korrektur aus CONTENT_TABLES Abschnitt 4: `cultist` wirft `ammo_pistol` mit
Menge 8, nicht 10. Die Elementmunitions-Regel wird in `dropLoot` ausgewertet, nicht im
Generator.

## Block 1, Aufbau des Generators

`scripts/genMaps.ts`, npm-Skript `gen:maps`. Kein Laufzeitcode. Das Ergebnis wird
committet, sechzehn Dateien `content/maps/sohle_01.json` bis `sohle_16.json`.

Ein fester Seed je Sohle, abgeleitet als `seed = 0x50524C + depth * 7919`. Derselbe Lauf
erzeugt zweimal dieselbe Datei, byteweise identisch.

Der Generator nutzt denselben xorshift128 aus `src/core/rng.ts`. Kein `Math.random`.

Kartengröße nach Tiefe: `size = 28 + depth`, gedeckelt auf 44. Bosskarten sind fest 32 x 32.

## Block 2, Geometrie

Verfahren: Räume setzen, dann verbinden. Kein BSP, weil die Ergebnisse dort zu regelmäßig
aussehen.

1. Zahl der Räume: `6 + floor(depth / 2)`, höchstens 14.
2. Je Raum eine Größe zwischen 4 x 4 und 10 x 8, zufällig gesetzt, Ablehnung bei
   Überschneidung oder weniger als 2 Kacheln Abstand zu einem bestehenden Raum.
   Höchstens 200 Versuche je Raum, danach wird mit weniger Räumen weitergemacht.
3. Verbindung: minimaler Spannbaum über die Raummittelpunkte nach Manhattan-Distanz,
   danach zusätzlich 20 Prozent der übrigen Kanten, damit Schleifen entstehen und die
   Karte nicht zum Baum wird.
4. Korridore als L-Form, Breite 1, Richtungswechsel zufällig zuerst waagerecht oder
   zuerst senkrecht.
5. Randkacheln der Karte sind immer solide.

Bosskarten weichen ab: ein Zugangskorridor von 8 Kacheln Länge, dann eine Arena von
mindestens 16 x 16 freien Kacheln, mit vier Stützpfeilern als Deckung. Keine weiteren
Räume.

## Block 3, Türen, Schlüssel, Ausgang

1. Start ist der Raum mit dem größten Abstand zum Ausgang, gemessen über den Graphen.
2. Ausgang liegt in einem Raum am gegenüberliegenden Ende, als `exits`-Eintrag mit
   `targetMapId` der nächsten Sohle. Sohle 16 hat keinen Ausgang.
3. Auf dem kritischen Pfad wird eine Tür gesetzt, ab Sohle 5 zwei. Sie sind verriegelt mit
   der Schlüsselfarbe der Zone nach BESTIARY Abschnitt 10, also rot, grün, blau, violett.
4. Der Schlüssel liegt in einem Raum, der vom Start aus ohne Durchqueren dieser Tür
   erreichbar ist. Der Generator prüft das selbst, nicht erst der Validator.
5. Je Karte eine Geheimtür mit `secret: true`, dahinter ein Raum mit erhöhtem Beutewurf.
   Sie wird über einen Schalter geöffnet, der als Trigger mit `on: 'use'` in einem anderen
   Raum liegt.

## Block 4, Texturen und Bodenspuren

Zuordnung nach CONTENT_TABLES Abschnitt 6, Zone ergibt sich aus `ceil(depth / 4)`.

- Wände: je Raum ein Hauptwandtyp aus dem Zonensatz, Korridore einen anderen
- Boden: Grundtyp je Raum, Korridore einen anderen
- Decke: Grundtyp, an Lampenpositionen die Lampentextur der Zone
- `ambientLight` aus der Zonentabelle

Bodenspuren nach dem Muster, das die Kachelkodierung aus SPEC Abschnitt 6 nutzt:
Je Karte werden zwei bis vier Spuren gezogen, jede von einem zufälligen Raum zu einer
verriegelten Tür oder in eine Sackgasse. Eine Spur besteht aus `62` am Anfang, `60`
als geradem Stück, `61` an jeder Richtungsänderung und `63` am Ende. Die Drehung wird so
gesetzt, dass die Spur zusammenhängend aussieht.

Zone 1 nutzt Ölflecken und Staubspuren, ab Zone 2 Blutspuren. Der Unterschied ist Stimmung,
nicht Mechanik.

## Block 5, Lampen und Licht

- eine Lampe je Raum in der Mitte, bei Räumen ab 8 Kacheln Kantenlänge zwei
- im Korridor alle 6 Kacheln eine Lampe
- `radius` 5, `intensity` 220 in Zone 1, fallend auf 150 in Zone 4
- ab Zone 3 bleiben 20 Prozent der Lampen weg, gleichmäßig verteilt, damit dunkle
  Abschnitte entstehen
- `light` wird über `generateLightMap` erzeugt und in die Datei geschrieben

## Block 6, Gegner und Beute

Gegnerarten je Sohle strikt nach BESTIARY Abschnitt 10. Keine anderen.

Zahl der Gegner: `8 + depth`, höchstens 26. Auf Bosskarten steht nur der Boss.

Regeln für die Platzierung:
- nie im Startraum und nicht in einem an ihn angrenzenden Raum
- nie auf einer Kachel mit Tür, Item oder Ausgang
- `turret`-Verhalten nur an Wandkacheln angrenzend
- höchstens vier Gegner je Raum
- `forceRank` wird nicht gesetzt, die Rangverteilung übernimmt `rollMapLoot` zur Laufzeit

Fundstücke nach BESTIARY Abschnitt 7 Spalte Fundort: die dort genannte Waffe liegt als
Item auf der jeweiligen Sohle, in einem Raum abseits des kritischen Pfades.

Zusätzlich je Karte 3 bis 6 Stapelgüter aus CONTENT_TABLES Abschnitt 1, passend zur Zone.

## Block 7, Validator

`scripts/validateMap.ts`, aufgerufen vom Generator nach jeder Karte und zusätzlich als
Test über alle sechzehn Dateien. Bei einem Verstoß bricht der Generator ab und nennt
Sohle, Regel und Position. Keine stillschweigende Korrektur.

Geprüft wird:
1. alle vier Raster haben genau `width * height` Einträge
2. der Rand ist vollständig solide
3. vom Start aus ist der Ausgang per Flutfüllung erreichbar, Türen als passierbar gezählt
4. jeder Schlüssel ist vom Start aus erreichbar, ohne die zugehörige Tür zu durchqueren
5. keine Entität steht auf einer soliden Kachel
6. keine zwei Entitäten stehen auf derselben Kachel
7. jede referenzierte `defId` existiert in `content/`
8. jede Textur-Id existiert in CONTENT_TABLES Abschnitt 6
9. jeder `targetMapId` verweist auf eine vorhandene Karte, Sohle 16 ausgenommen
10. jeder Raum hat mindestens eine Lampe oder liegt bewusst im dunklen Anteil
11. auf Bosskarten steht genau ein Gegner, und die Arena hat mindestens 16 x 16 freie
    Kacheln
12. der Startraum enthält keinen Gegner
13. `light` enthält keinen Wert über 255 und keinen unter 0

Regel 4 ist die wichtigste. Eine Karte mit einem Schlüssel hinter seiner eigenen Tür ist
unspielbar und fällt beim Testen sonst erst nach zwanzig Minuten auf.

## Block 8, Anbindung

`content/maps/` wird vom Loader eingelesen und in `ContentDb.maps` aufgenommen.
Die Entwicklungsfixture aus `src/app/devFixture.ts` bleibt bestehen, das Spiel startet
aber künftig auf `sohle_01`.

Sohlenwechsel über die vorhandene `mapChange`-Behandlung. Beim Betreten einer noch nicht
besuchten Sohle läuft `rollMapLoot`.

## Tests

1. Zweimaliger Lauf von `gen:maps` erzeugt byteweise identische Dateien
2. Alle sechzehn Karten bestehen den Validator
3. Eine absichtlich beschädigte Karte, Schlüssel hinter seiner Tür, wird vom Validator
   mit Regel 4 abgelehnt
4. Eine absichtlich beschädigte Karte, Gegner in einer Wand, wird mit Regel 5 abgelehnt
5. Jede Sohle enthält ausschließlich die Gegnerarten aus BESTIARY Abschnitt 10
6. Die Waffen aus BESTIARY Abschnitt 7 liegen auf den dort genannten Sohlen
7. Bosskarten enthalten genau einen Gegner, und zwar den richtigen
8. Textur-Ids einer Karte gehören alle zur Zone ihrer Tiefe
9. Eine Bodenspur ist zusammenhängend: jedes Stück grenzt an ein weiteres oder an Anfang
   und Ende
10. `light` einer Karte hat an mindestens einer Lampenposition einen Wert über 200 und in
    mindestens einer Ecke einen unter 40
11. Der Determinismustest aus Phase 2 ist weiterhin grün

## Abnahmekriterium

`npm run dev` startet auf Sohle 1. Der Spieler kann sie durchqueren, den Schlüssel finden,
die Tür öffnen und über den Ausgang auf Sohle 2 gelangen. Die Bodenspuren sind sichtbar und
richtig gedreht. Unter Lampen ist es heller.

`npm run typecheck`, `npm test`, `npm run gen:enemies` und `npm run gen:maps` grün.
Commit mit `feat(content): map generator, validator, 16 levels`.

Melde abschließend:
- welche Regeln des Validators beim ersten Durchlauf angeschlagen haben
- ob eine Sohle mehrfach neu gewürfelt werden musste, weil die Raumsetzung scheiterte
- neue Widersprüche zwischen Dokumenten

Danach anhalten. Das Backend ist Phase 7.
