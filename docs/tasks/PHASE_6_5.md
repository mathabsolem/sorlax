# PHASE 6.5 — Korrekturen am Kartengenerator

Vorbedingung: Phase 6 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/INTERFACES.md` v1.7, `docs/CONTENT_TABLES.md` v1.2,
`docs/SPEC.md` v1.2, `docs/BESTIARY.md` v3.

**Prüfe zuerst, ob alle vier Dateien vorhanden sind und ob INTERFACES auf v1.7 und
CONTENT_TABLES auf v1.2 stehen.** Fehlt eine oder ist die Version niedriger, brich sofort
ab und melde es.

Kurze Phase. Sie schließt die zehn Punkte aus der Rückmeldung nach Phase 6 ab.
Alle vorläufigen Entscheidungen der Umsetzung waren richtig, sofern unten nichts anderes
steht. Sie werden hier nur festgeschrieben.

---

## Block 1, Schlüssel werden verbraucht

Die einzige inhaltliche Kehrtwende. CONTENT_TABLES Abschnitt 7 gilt.

1. Vier `ItemDef`-Einträge für die Schlüssel entsprechen jetzt CONTENT_TABLES Abschnitt 1.
   Wo die in Phase 6 selbst angelegten Werte abweichen, gewinnt die Tabelle.
2. Beim Öffnen einer verriegelten Tür wird die Schlüsselfarbe aus `PlayerState.keys`
   entfernt. Das `doorChanged`-Ereignis bleibt unverändert.
3. Der Generator legt je verriegelter Tür einen Schlüssel aus, also ab Sohle 5 zwei. Jeder
   Schlüssel muss vom Start aus erreichbar sein, ohne eine der Türen zu durchqueren, für
   die noch kein Schlüssel gefunden wurde.
4. Validatorregel 4 wird entsprechend erweitert: Sie prüft die Reihenfolge, nicht nur die
   Erreichbarkeit eines einzelnen Schlüssels. Das ist die aufwendigste Änderung dieser
   Phase, und sie ist notwendig, weil zwei Türen mit derselben Farbe eine Falle bilden
   können, die bei einer Einzelprüfung unsichtbar bleibt.

## Block 2, Räume in der Kartendatei

`MapDef.rooms` aus INTERFACES v1.7 wird vom Generator gefüllt, mit `kind` je Raum.
Korridore werden als eigene Einträge mit `kind: 'corridor'` geführt, sofern der Generator
sie ohnehin als Rechtecke erzeugt. Ist ein Korridor keine Rechteckform, wird er nicht
eingetragen, und der Validator behandelt ihn wie bisher.

Validatorregeln 10 und 12 stützen sich künftig auf `rooms`:
- Regel 10: Jeder Raum mit `kind` ungleich `corridor` hat mindestens eine Lampe, außer er
  gehört zu den ab Zone 3 bewusst entfernten 20 Prozent. Diese Räume bekommen ein
  Kennzeichen, damit die Prüfung ehrlich ist.
- Regel 12: Der Startraum enthält keinen Gegner, geprüft über sein Rechteck.

## Block 3, Bodenspuren in Zone 1

CONTENT_TABLES Abschnitt 6 führt jetzt 67 als Anfang und 68 als Ende der Schleifspur.
Zone 1 nutzt damit denselben vierteiligen Aufbau wie die übrigen Zonen: 67 Anfang,
65 gerade, 66 Kurve, 68 Ende. Der Ölfleck 64 bleibt als eigenständige Bodendekoration ohne
Spurfunktion und wird einzeln gesetzt, nicht als Kette.

## Block 4, Kleinigkeiten

1. **Test 10** wird auf die Stärke der eigenen Zone umgeschrieben. Geprüft wird, dass an
   einer Lampenposition genau die `intensity` der Zone aus CONTENT_TABLES Abschnitt 6
   steht, und dass in mindestens einer Ecke ein Wert unter 40 liegt.
2. **Lampenstärke** je Zone: 220, 197, 173, 150. Die interpolierten Werte werden bestätigt.
3. **Lampen im Korridor** werden entlang des Korridorverlaufs gesetzt, alle 6 Kacheln,
   nicht in Rasterreihenfolge.
4. **Bosskarten** tragen keine Geheimtür. Die Ausnahme steht jetzt in CONTENT_TABLES
   Abschnitt 7 und ist damit kein Widerspruch mehr.
5. **Stapelgüter** folgen der Ableitung aus der Rückmeldung, festgeschrieben in
   CONTENT_TABLES Abschnitt 7.
6. **Id-Bereiche**: 0 bis 199 Katalog, 200 aufwärts Entwicklung. Ein Test prüft, dass keine
   Platzhalter-Id unter 200 liegt und dass jede in `content/maps/` benutzte Textur-Id im
   Katalog steht.

## Block 5, Bestätigte Annahmen

Diese Punkte aus der Rückmeldung werden ohne Änderung übernommen und brauchen keine Arbeit.
Sie stehen hier, damit sie später nicht erneut infrage gestellt werden.

- Start und Ausgang sind die Enden des längsten Weges im Raumgraphen
- Türen sitzen bei etwa der Hälfte und drei Vierteln des kritischen Pfades
- Schlüsselplatzierung wird auf Kachelebene gerechnet, nicht über den Raumgraphen.
  Die Begründung in der Rückmeldung ist richtig: Korridore laufen durch fremde Räume, eine
  Tür sperrt mehr als ihre eigene Kante
- Die Bossarena ist eine Halle über die Kartenbreite minus Rand, Zugang von Süden, vier
  Pfeiler auf den Viertelpunkten
- Kartennamen nach dem Muster "Sohle 3, Industrie"

## Tests

1. Eine geöffnete verriegelte Tür entfernt die Schlüsselfarbe aus `keys`
2. Nach dem Öffnen einer roten Tür lässt sich eine zweite rote Tür ohne neuen Schlüssel
   nicht öffnen
3. Jede Sohle enthält so viele Schlüssel wie verriegelte Türen
4. Der erweiterte Validator lehnt eine Karte ab, bei der der zweite Schlüssel hinter der
   ersten Tür liegt und diese Tür bereits den ersten Schlüssel verbraucht hat
5. `rooms` ist auf allen sechzehn Karten gefüllt und die Rechtecke überschneiden sich nicht
6. Regel 12 findet einen Gegner, der absichtlich in den Startraum gesetzt wurde
7. Keine Platzhalter-Textur hat eine Id unter 200
8. Jede in `content/maps/` benutzte Textur-Id steht im Katalog
9. Eine Schleifspur in Zone 1 beginnt mit 67 und endet mit 68
10. Zweimaliger Lauf von `gen:maps` erzeugt weiterhin byteweise identische Dateien
11. Der Determinismustest aus Phase 2 ist weiterhin grün

## Abnahmekriterium

Sohle 1 ist durchspielbar, der Schlüssel verschwindet nach dem Öffnen aus dem Inventar.
Sohle 5 hat zwei Türen und zwei Schlüssel, und beide sind in einer Reihenfolge erreichbar,
die nicht in eine Sackgasse führt.

`npm run typecheck`, `npm test`, `npm run gen:enemies` und `npm run gen:maps` grün.
Commit mit `fix(content): consumable keys, room metadata, trail fixes`.

Melde abschließend, ob der erweiterte Validator auf einer der sechzehn Karten angeschlagen
hat und wie viele Neuwürfe nötig waren.

Danach anhalten. Das Backend ist Phase 7.
