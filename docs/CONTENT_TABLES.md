# Scepter of Sorlax — CONTENT_TABLES v1.4

Status: verbindlich. Anhang zu BESTIARY v3.

## Änderungsverlauf

### v1.4, aus der Rückmeldung zur Grafikerstellung
- Id 64 ist eine gerade Ölspur mit Kantenanbindung, Teil des Zone-1-Spursatzes. Der
  freistehende Ölfleck bekommt die eigene Id 55 und wird nie gedreht oder angeschlossen.
- Neuer Unterabschnitt in Abschnitt 6: Spritegrößen folgen `spriteWidth`.
- Der Änderungsverlauf steht jetzt unter einer zweiten Überschriftenebene. Zwei
  Überschriften der ersten Ebene in einer Datei zerlegen die Gliederung.

### v1.3
- Abschnitt 7 führt die Grenzen für dunkle Räume, die bisher nur in einer Task-Datei
  standen und damit nicht dauerhaft galten.

### v1.2, aus der Rückmeldung nach Phase 6:
- Abschnitt 1 führt die vier Schlüssel. Sie hatten nie eine Tabelle.
- Abschnitt 6 bekommt zwei Bodenspur-Ids für Zone 1 und einen verbindlichen Id-Bereich.
- Abschnitt 6 nennt die Lampenstärke aller vier Zonen, nicht nur der äußeren.
- Neuer Abschnitt 7 mit den Kartenregeln, die in PHASE_6 unvollständig waren.

Korrekturen gegenüber v1.0, alle aus der Rückmeldung nach Phase 5:
- Abschnitt 1 nannte zwei positive Effekte, definierte aber nur einen. Es ist einer.
- Abschnitt 1 sprach von vier Elementmunitionen und listete fünf. Es sind fünf.
- Die Bedeutung von `amount` war zweideutig. Jetzt eindeutig je Typ.
- `antitoxin` war als `powerup` geführt und muss `heal` sein.
- Neu: Abschnitt 6 mit dem Texturkatalog, den der Kartengenerator braucht.

---

## 1. Verbrauchsgüter

Bedeutung von `ItemDef.amount`, verbindlich:
- bei `type: 'heal'` die Zahl der wiederhergestellten Lebenspunkte
- bei `type: 'ammo'` die Stapelgröße, also die Menge pro Aufnahme
- bei `type: 'powerup'` immer 1

| id | Name | type | amount | ammoType | Wirkung |
|---|---|---|---|---|---|
| `heal_small` | Notverband | heal | 25 | — | stellt 25 Lebenspunkte her |
| `heal_large` | Trauma-Kit | heal | 60 | — | stellt 60 Lebenspunkte her |
| `antitoxin` | Antitoxin | heal | 10 | — | entfernt `toxin`, stellt 10 Leben her |
| `armor_plate` | Panzerplatte | powerup | 1 | — | Effekt `plating`, 20 Runden, Rüstung plus 10 |
| `scanner_charge` | Prüfzelle | powerup | 1 | — | identifiziert einen Gegenstand |
| `ammo_pistol` | 9-mm-Magazin | ammo | 8 | `pistol` | — |
| `ammo_rivet` | Bolzenstreifen | ammo | 6 | `rivet` | — |
| `ammo_shell` | Setzpatronen | ammo | 4 | `shell` | — |
| `ammo_charge` | Vortriebsladung | ammo | 2 | `charge` | — |
| `ammo_fuel` | Brennstoffpatrone | ammo | 6 | `fuel` | — |
| `ammo_toxin_canister` | Toxinkanister | ammo | 5 | `toxin_canister` | — |
| `ammo_coolant` | Kühlmittelzelle | ammo | 4 | `coolant` | — |
| `ammo_cell` | Induktionszelle | ammo | 6 | `cell` | — |
| `ammo_essence` | Essenzsplitter | ammo | 3 | `essence` | — |

### Schlüssel

| id | Name | type | amount | Zone | Sohlen |
|---|---|---|---|---|---|
| `key_red` | Roter Schlüssel | key | 1 | 1 | 1 bis 4 |
| `key_green` | Grüner Schlüssel | key | 1 | 2 | 5 bis 8 |
| `key_blue` | Blauer Schlüssel | key | 1 | 3 | 9 bis 12 |
| `key_violet` | Violetter Schlüssel | key | 1 | 4 | 13 bis 16 |

`reqLevel`, `reqStrength` und `reqAgility` sind 0. Schlüssel werden nicht angelegt,
sie liegen in `PlayerState.keys`.

**Ein Schlüssel wird beim Öffnen verbraucht.** Siehe Abschnitt 7.

`antitoxin` kombiniert Heilung und Effektentfernung. Der Eintrag trägt zusätzlich
`effect: { id: 'cure_toxin', turns: 0, magnitude: 0 }`.

### Positiver Effekt

Einer. SPEC 4.5 kennt bisher nur schädliche.

| id | Feld in DerivedStats | mode | magnitude | Dauer |
|---|---|---|---|---|
| `plating` | armor | flat | 10 | 20 Runden |

### Effekte entfernen

`ItemDef.effect.id` mit dem Präfix `cure_` entfernt den Effekt, dessen Id nach dem Präfix
steht. `turns` und `magnitude` sind dabei 0.

## 2. Einzigartige Gegenstände

Affixwerte sind fest, nicht gewürfelt. `minItemLevel` entspricht der `sohleBasis` des
Fundorts.

| id | baseId | Name | minItemLevel | bossExclusive | Affixe |
|---|---|---|---|---|---|
| `uq_halvern_visier` | `helmet_visor` | Halverns Brandvisier | 6 | ja | `suf_of_embers` 35, `pre_plated` 5, `suf_of_the_lamp` 2 |
| `uq_sporenlunge` | `suit_overall` | Sporenlunge | 13 | ja | `suf_of_spores` 35, `suf_of_vigor` 28, `pre_plated` 4 |
| `uq_frostkern` | `guard_deflector` | Frostkern | 19 | ja | `suf_of_rime` 35, `pre_reinforced` 11, `suf_of_embers` 15 |
| `uq_sorlax_auge` | `amulet_sigil` | Das Auge von Sorlax | 26 | ja | `suf_of_focus` 6, `pre_charged` 9, `suf_of_vigor` 30 |
| `uq_stollenschritt` | `boots_rubber` | Stollenschritt | 8 | nein | `suf_of_evasion` 6, `suf_of_haste` 7 |
| `uq_greifer` | `gloves_grip` | Der Greifer | 10 | nein | `pre_honed` 8, `suf_of_precision` 5 |
| `uq_pruefblei` | `gauge_pressure` | Prüfblei | 14 | nein | `suf_of_might` 6, `pre_plated` 5 |
| `uq_wetterglas` | `gauge_seismic` | Wetterglas | 20 | nein | `suf_of_focus` 6, `pre_honed` 7 |

Zuordnung über `EnemyDef.guaranteedUniqueId`:
`boss_halvern` zu `uq_halvern_visier`, `boss_sporemother` zu `uq_sporenlunge`,
`boss_rime` zu `uq_frostkern`, `boss_sorlax` zu `uq_sorlax_auge`.

## 3. Bossfelder, ratifiziert

| Boss | weaponId | aggroRange | preferredRange | spriteWidth |
|---|---|---|---|---|
| `boss_halvern` | `nw_slam_fire` | 12 | 1 | 1.3 |
| `boss_sporemother` | `nw_sporeburst` | 20 | 3 | 2.0 |
| `boss_rime` | `nw_boltpistol_ice` | 16 | 6 | 1.4 |
| `boss_sorlax` | `nw_slam_void` | 20 | 1 | 1.6 |

## 4. Korrekturen an BESTIARY v3

**Abschnitt 9, Zeile `cultist`.** Die Menge 10 für `ammo_pistol` ist bei Stapelgröße 8
nicht darstellbar. Verbindlich sind 8, also genau ein Stapel.

**Abschnitt 9, Elementmunition.** Die Bedingung, dass die passende Waffe im Besitz sein
muss, ist eine Laufzeitbedingung und gehört nicht in den Generator. Sie wird in `dropLoot`
ausgewertet: Fällt der Munitionsdrop einer Elementvariante und besitzt der Spieler die
zugehörige Waffe, wird die Standardmunition durch die Elementmunition ersetzt, Menge nach
`ItemDef.amount` der jeweiligen Sorte. Andernfalls bleibt es bei der Standardmunition.

**Abschnitt 10, Generator.** Er ist Gegenstand von Phase 5 und dort erledigt, nicht von
Phase 7. Die Nummerierung im Bestiarium ist überholt.

**Abschnitt 5, Sporenträger.** Die Entscheidung, für `spore_poison` die Grundwaffe statt
eines identischen Klons zu nutzen, ist richtig und wird übernommen. Ein Klon, der in jedem
Feld dem Original gleicht, ist toter Katalogeintrag.

## 5. Korrekturen an früheren Task-Dateien

**PHASE_3_6 Test 14** steht auf 8 bis 32, verbindlich sind 9 Prozent aus RPG.md Abschnitt 9.

**PHASE_5 Block 3, Ersatzweg über `drops`.** Der war falsch. `drops` erzeugt Stapelware,
ein einzigartiger Gegenstand ist eine `ItemInstance`. Gelöst über
`EnemyDef.guaranteedUniqueId` in INTERFACES v1.6.

## 6. Texturkatalog

Der Kartengenerator braucht feste Textur-Ids. Diese Tabelle ist die Quelle, auch für die
spätere Erstellung der Grafiken.

Vier Zonen zu je vier Sohlen. Jede Zone hat eigene Wände, Böden und Decken.

### Zone 1, Sohlen 1 bis 4, Industrie

| id | Art | Beschreibung |
|---|---|---|
| 10 | Wand | Betonwand mit Rissen |
| 11 | Wand | Stahlpaneel mit Nieten |
| 12 | Wand | Bruchstein, unbehauen |
| 13 | Wand | Stützpfeiler aus Holz und Stahl |
| 40 | Boden | Betonboden |
| 41 | Boden | Gitterrost über Dunkelheit |
| 42 | Boden | Schienenstück, gerade |
| 70 | Decke | Betondecke |
| 71 | Decke | Deckenlampe, eingelassen |
| 72 | Decke | Rohrleitungsbündel |

### Zone 2, Sohlen 5 bis 8, Pilzbefall

| id | Art | Beschreibung |
|---|---|---|
| 14 | Wand | Beton, überwuchert |
| 15 | Wand | Myzelgeflecht |
| 16 | Wand | Stahlpaneel, korrodiert |
| 17 | Wand | Fruchtkörper an Fels |
| 43 | Boden | Beton mit Sporenteppich |
| 44 | Boden | Feuchte Erde |
| 45 | Boden | Gitterrost, überwachsen |
| 73 | Decke | Decke mit hängenden Ranken |
| 74 | Decke | Deckenlampe, überwuchert |
| 75 | Decke | Sporenkolonie |

### Zone 3, Sohlen 9 bis 12, Frost

| id | Art | Beschreibung |
|---|---|---|
| 18 | Wand | Fels mit Eisschicht |
| 19 | Wand | Stahlpaneel, vereist |
| 20 | Wand | Massives Eis, blaustichig |
| 21 | Wand | Gefrorene Rohrleitung |
| 46 | Boden | Vereister Beton |
| 47 | Boden | Blankes Eis |
| 48 | Boden | Raureif auf Gitterrost |
| 76 | Decke | Decke mit Eiszapfen |
| 77 | Decke | Deckenlampe, vereist |
| 78 | Decke | Frostblumen |

### Zone 4, Sohlen 13 bis 16, Struktur

| id | Art | Beschreibung |
|---|---|---|
| 22 | Wand | Fremdes Material, glatt und dunkel |
| 23 | Wand | Geriefte Säule, nicht menschlich |
| 24 | Wand | Fels mit violetten Adern |
| 25 | Wand | Verschmolzener Stahl und Stein |
| 49 | Boden | Fremder Boden, spiegelnd |
| 50 | Boden | Fels mit violetten Adern |
| 51 | Boden | Aufgebrochener Beton über Leere |
| 79 | Decke | Decke mit violetten Adern |
| 80 | Decke | Lichtquelle, fremd |
| 81 | Decke | Offene Leere |

### Zonenübergreifende Bodenspuren

Diese nutzen die Drehungskodierung aus SPEC Abschnitt 6. Kanten müssen so gezeichnet sein,
dass ein gerades Stück an ein weiteres oder an eine Kurve anschließt.

| id | Beschreibung |
|---|---|
| 60 | Blutspur, gerade |
| 61 | Blutspur, Kurve nach rechts |
| 62 | Blutspur, Anfang, also Schleifbeginn |
| 63 | Blutspur, Ende an einer Wand |
| 64 | Ölspur, gerade |
| 65 | Schleifspur im Staub, gerade |
| 66 | Schleifspur im Staub, Kurve nach rechts |
| 55 | Ölfleck, freistehend, ohne Kantenanbindung |
| 67 | Schleifspur, Anfang |
| 68 | Schleifspur, Ende an einer Wand |

Kurven nach links entstehen durch Drehung, nicht durch eigene Grafik.

### Zuordnung je Zone

| Zone | Wandsatz | Bodensatz | Deckensatz | Lampe | intensity | ambientLight | Spur |
|---|---|---|---|---|---|---|---|
| 1 | 10 bis 13 | 40 bis 42 | 70, 72 | 71 | 220 | 0.55 | 64 bis 68, dazu 55 |
| 2 | 14 bis 17 | 43 bis 45 | 73, 75 | 74 | 197 | 0.40 | 60 bis 63 |
| 3 | 18 bis 21 | 46 bis 48 | 76, 78 | 77 | 173 | 0.45 | 60 bis 63 |
| 4 | 22 bis 25 | 49 bis 51 | 79, 81 | 80 | 150 | 0.25 | 60 bis 63 |

Die Zwischenwerte 197 und 173 sind die linear interpolierten aus der Rückmeldung und
werden übernommen.

Der vierte Wandtyp jeder Zone ist der Stützpfeiler und wird nur in Bossarenen benutzt.

### Spritegrößen

Die Kantenlänge eines Gegnersprites folgt `spriteWidth` aus BESTIARY Abschnitt 4 und
CONTENT_TABLES Abschnitt 3, nicht der Einteilung in Gegner und Boss.

| spriteWidth | Sprite in Pixeln |
|---|---|
| bis 1.0 | 64 |
| über 1.0 bis 1.5 | 96 |
| über 1.5 | 128 |

Daraus folgt: `hauler`, `warden`, `boss_halvern` und `boss_rime` bekommen 96,
`boss_sporemother` und `boss_sorlax` bekommen 128, alle übrigen 64.

Eine feste Größe je Kategorie wäre im Ladecode einfacher, aber `warden` und `boss_rime`
haben denselben `spriteWidth` von 1.4 und dürfen nicht unterschiedlich aufgelöst sein.
Die Quellbilder sind ohnehin 1024 x 1024, die Mehrarbeit ist reine Rechenzeit.

### Id-Bereiche, verbindlich

- 0 bis 199 gehören dem Katalog in diesem Abschnitt
- 200 aufwärts gehören der Entwicklung, also prozeduralen Platzhaltern

Ein Platzhalter darf nie eine Katalog-Id belegen. Beide teilen sich zur Laufzeit dieselbe
Tabelle, und eine Kollision erzeugt ein schwarzes Bild, das kein Test bemerkt.

`ambientLight` fällt mit der Tiefe. Zone 4 ist fast dunkel, dort trägt fast nur noch
`playerLight` und die Sichtweite aus der Ausrüstung.


## 7. Kartenregeln

Ergänzt und korrigiert PHASE_6. Diese Regeln sind verbindlich.

### Schlüssel und Türen

Ein Schlüssel wird beim Öffnen der zugehörigen Tür verbraucht und aus `PlayerState.keys`
entfernt. Der Generator legt je verriegelter Tür genau einen Schlüssel aus, also ab
Sohle 5 zwei.

Grund: Die Farbe ist an die Zone gebunden, `keys` gilt aber für den ganzen Spielstand.
Ohne Verbrauch öffnet der rote Schlüssel von Sohle 1 auch die Türen der Sohlen 2 bis 4, und
von zwölf regulären Sohlen hätten nur vier eine echte Suche. Das war ein Entwurfsfehler.

Verbrauch ist der Weg mit den wenigsten Nebenwirkungen. Eine Schlüssel-Id je Sohle würde
zwölf zusätzliche Einträge und zwölf zusätzliche Symbole bedeuten, und das Leeren beim
Sohlenwechsel wäre für den Spieler nicht nachvollziehbar.

### Bosskarten

Bosskarten tragen keine Geheimtür und keinen Schalter. Sie bestehen aus Zugangskorridor
und Arena. Der Zonenschlüssel für die Arenatür liegt im Zugangskorridor.
Das ist eine Ausnahme von der Regel, dass jede Karte eine Geheimtür trägt.

### Stapelgüter je Sohle

Genommen wird, was die Gegner dieser Sohle nach BESTIARY Abschnitt 9 fallen lassen, dazu
immer `heal_small`. Damit stammt jede Id aus einer Tabelle, und der Nachschub passt zu den
Waffen, die auf dieser Sohle gebraucht werden. Die Ableitung aus der Rückmeldung wird
übernommen.

### Lampen im Korridor

Der Abstand von 6 Kacheln zählt entlang des Korridorverlaufs, nicht in Rasterreihenfolge.
Bei geknickten Gängen entstehen sonst ungleiche Abstände.

### Dunkle Räume

`RoomDef.dark` kennzeichnet Räume, die bewusst ohne Lampe bleiben. Verbindlich:

- nur ab Zone 3, also ab Sohle 9
- höchstens 25 Prozent der Räume einer Karte
- niemals Start-, Ausgangs- oder Arenaräume
- Validatorregel 10 lautet: Jeder Raum mit `kind` ungleich `corridor` hat mindestens eine
  Lampe oder `dark: true`

Ohne die Obergrenze hat der Generator keinen Grund, sich zurückzuhalten, und Zone 4 mit
`ambientLight` 0.25 wird unspielbar.

### Räume

`MapDef.rooms` aus INTERFACES v1.7 hält die Räume, die der Generator gesetzt hat.
Der Validator prüft Lampen und Startraum darüber, statt die Raumform aus dem Raster zu
raten.
