# Scepter of Sorlax — ART_PROMPTS

Für die Erstellung der Grafiken mit einem Bildmodell wie ChatGPT.
Grundlage: CONTENT_TABLES v1.4 Abschnitt 6, BESTIARY v3, INTERFACES v1.10 Abschnitt 11.

**Dieses Dokument ist abgeleitet.** Bei jeder Abweichung gewinnen BESTIARY und
CONTENT_TABLES.

Korrekturen in dieser Fassung: Framezahl auf zwölf und 156, Spritegrößen nach
`spriteWidth`, Id 64 als gerade Ölspur, freistehender Ölfleck als Id 55, sechzehn
Ausrüstungssymbole, Beschreibung des Bolzenkarabiners.

---

## 0. Lies das zuerst

**Bildmodelle erzeugen keine echte Pixelgrafik.** Sie erzeugen ein großes Bild, das wie
Pixelgrafik aussieht, mit weichen Kanten, Zwischenfarben und ungleichmäßigem Raster. Das
ist für einen Raycaster unbrauchbar, weil er Texturen pixelweise ausliest.

Der Ablauf ist deshalb immer zweistufig:
1. Bild erzeugen lassen, groß, etwa 1024 x 1024
2. Durch ein Aufbereitungswerkzeug schicken, das auf die Zielgröße herunterrechnet,
   die Farben auf höchstens 64 reduziert und den Alphakanal hart auf 0 oder 255 setzt

Schritt 2 macht `npm run prep:asset` aus Phase 8. Ohne diesen Schritt sehen die Texturen
im Spiel matschig aus und die Sprites bekommen graue Ränder.

**Kachelbare Texturen sind der schwierigste Teil.** Bildmodelle erzeugen selten Bilder,
deren linke Kante an die rechte anschließt. Rechne damit, dass du bei Wänden und Böden
mehrere Versuche brauchst oder nacharbeiten musst. Das Werkzeug aus Phase 8 zeigt dir eine
2x2-Kachelung zur Kontrolle an.

**Fang klein an.** Bevor du 143 Sprites erzeugst, mach eine Zone und einen Gegner
vollständig durch, bis er im Spiel richtig aussieht. Erst dann lohnt sich der Rest.

---

## 1. Gemeinsame Regeln für jeden Prompt

Diese Zeilen gehören an jeden Prompt, unverändert:

```
Pixel-Art im Stil der Mitte der 1990er Jahre, wie bei einem
Software-gerenderten Ego-Shooter. Begrenzte Palette, maximal
64 Farben. Harte Kanten, kein Anti-Aliasing, keine weichen
Verläufe, keine Unschärfe. Kein Text, keine Wasserzeichen,
keine Rahmen, keine Beschriftung. Gleichmäßige, flache
Ausleuchtung ohne eingebrannte Schatten, weil die Beleuchtung
im Spiel berechnet wird.
```

Für Wand-, Boden- und Deckentexturen zusätzlich:

```
Nahtlos kachelbar: die linke Kante schliesst exakt an die
rechte an, die obere exakt an die untere. Frontale Ansicht,
keine Perspektive, keine Fluchtlinien. Quadratisches Format.
```

Für Sprites zusätzlich:

```
Freigestellt auf vollstaendig transparentem Hintergrund.
Frontalansicht, mittig, ganze Figur, Fuesse am unteren Rand.
Kein Boden, kein Schatten, keine Umgebung.
```

## 2. Weltbeschreibung als Vorspann

Diesen Absatz stellst du jedem Prompt voran, damit der Stil zusammenpasst:

```
Schauplatz ist Schacht Corvane, eine unterirdische
Bergbauanlage der Verrath Foerdergesellschaft. Beim Vortrieb
wurde auf Sohle sieben eine aeltere, nicht menschliche
Struktur angeschnitten. Die Anlage ist verlassen, verrostet
und feucht. Der Ton ist industriell und schmutzig, nicht
futuristisch und nicht fantastisch.
```

## 3. Wandtexturen

Größe 64 x 64. Dateiname `public/assets/textures/<id>.png`.

Prompt-Muster:

```
[Weltbeschreibung]
Eine kachelbare Wandtextur: [Beschreibung].
[Gemeinsame Regeln] [Texturregeln]
```

| id | Beschreibung für den Prompt |
|---|---|
| 10 | grauer Beton mit feinen Rissen und Wasserflecken |
| 11 | Stahlpaneel mit Nietenreihen, Rost an den Kanten |
| 12 | unbehauener Bruchstein, dunkelgrau, unregelmässig |
| 13 | Stützpfeiler aus verschraubtem Holz und Stahlbändern |
| 14 | grauer Beton, von hellem Myzel überzogen |
| 15 | dichtes Myzelgeflecht, fahlgelb und faserig |
| 16 | Stahlpaneel, stark korrodiert, braunrot |
| 17 | Fels mit fleischigen Pilzfruchtkörpern |
| 18 | Fels unter einer dünnen, milchigen Eisschicht |
| 19 | Stahlpaneel mit Raureif und Eiszapfen |
| 20 | massives blaustichiges Eis mit Lufteinschlüssen |
| 21 | gefrorene Rohrleitung, dick vereist |
| 22 | glattes, dunkles Material, nicht menschlich, matt schimmernd |
| 23 | geriefte Säule aus schwarzem Material, fremdartig |
| 24 | Fels mit leuchtenden violetten Adern |
| 25 | verschmolzener Stahl und Stein, verworfen und blasig |

## 4. Boden- und Deckentexturen

Größe 64 x 64. Boden nach `textures/`, Decke ebenfalls, die Ids trennen sie.

| id | Art | Beschreibung |
|---|---|---|
| 40 | Boden | abgenutzter Betonboden mit Ölflecken |
| 41 | Boden | Metallgitterrost über Dunkelheit |
| 42 | Boden | Beton mit eingelassenem Schienenstück, gerade |
| 43 | Boden | Beton mit dünnem Sporenteppich |
| 44 | Boden | feuchte, dunkle Erde mit Wurzeln |
| 45 | Boden | Gitterrost, von Myzel überwachsen |
| 46 | Boden | vereister Beton, rutschig glänzend |
| 47 | Boden | blankes Eis mit Rissen |
| 48 | Boden | Gitterrost unter Raureif |
| 49 | Boden | fremder Boden, dunkel und spiegelnd glatt |
| 50 | Boden | Fels mit violetten Adern |
| 51 | Boden | aufgebrochener Beton, darunter Leere |
| 70 | Decke | rohe Betondecke mit Schalungsspuren |
| 71 | Decke | eingelassene Deckenlampe, warmes Licht, Gitterabdeckung |
| 72 | Decke | Bündel aus Rohrleitungen und Kabeln |
| 73 | Decke | Decke mit herabhängenden Pilzranken |
| 74 | Decke | Deckenlampe, von Myzel überwachsen, schwaches Licht |
| 75 | Decke | dichte Sporenkolonie |
| 76 | Decke | Decke mit Eiszapfen |
| 77 | Decke | vereiste Deckenlampe, kaltes Licht |
| 78 | Decke | Frostblumenmuster |
| 79 | Decke | Decke mit violetten Adern |
| 80 | Decke | fremde Lichtquelle, violett, ohne erkennbare Fassung |
| 81 | Decke | offene Leere, tiefschwarz mit fernen Lichtpunkten |

**Lampentexturen brauchen eine Zusatzzeile:**

```
Die Lichtquelle selbst ist deutlich heller als die Umgebung,
aber sie wirft keinen Lichtkegel und keine Strahlen. Der
Lichtabfall wird im Spiel berechnet.
```

## 5. Bodenspuren

Größe 64 x 64. Diese sind die schwierigsten Texturen, weil ihre Kanten aneinanderpassen
müssen. Nur die Kanten sind wichtig, nicht die Mitte.

Zusatzregel für alle Spuren:

```
Der Untergrund ist vollstaendig transparent, nur die Spur
selbst ist sichtbar. Die Spur laeuft von der Mitte der
unteren Kante zur Mitte der oberen Kante und ist an beiden
Kanten genau gleich breit und gleich positioniert.
```

| id | Beschreibung | Verlauf |
|---|---|---|
| 60 | breite Schleifspur aus geronnenem Blut | unten nach oben, gerade |
| 61 | dieselbe Blutspur, Richtungswechsel | unten nach rechts |
| 62 | Blutspur, Beginn: eine Lache, aus der die Spur herausführt | Lache in der Mitte, Spur nach oben |
| 63 | Blutspur, Ende: die Spur läuft an die obere Kante und verwischt | von unten, endet vor der Kante |
| 64 | breite Ölspur, dunkel und schillernd | unten nach oben, gerade |
| 65 | Schleifspur im Staub, zwei parallele Rillen | unten nach oben, gerade |
| 66 | dieselbe Staubspur, Richtungswechsel | unten nach rechts |
| 67 | Staubspur, Beginn: Abdruck, aus dem die Rillen herausführen | Mitte nach oben |
| 68 | Staubspur, Ende: die Rillen verlaufen sich | von unten, endet vor der Kante |

Kurven nach links entstehen im Spiel durch Drehung. Du brauchst sie nicht zu zeichnen.

Zone 1 hat mit 64 und 65 zwei gerade Stücke, ein Ölschliff und eine Staubrille. Das ist
Absicht und gibt dem Generator Abwechslung.

**Ausnahme, Id 55.** Der freistehende Ölfleck gehört nicht zum Spursatz. Er wird nie
gedreht und nie angeschlossen, deshalb gilt für ihn die Kantenregel oben nicht:

| id | Beschreibung |
|---|---|
| 55 | einzelner Ölfleck, dunkel und schillernd, freistehend in der Bildmitte, Rand transparent |

## 6. Gegner

Dateiname `public/assets/sprites/<archetype>_<zustand>_<n>.png`.

Benötigte Bilder je Einheit: `idle_0` bis `idle_3`, `attack_0` bis `attack_2`, `pain_0`,
`death_0` bis `death_3`. Das sind **zwölf** je Einheit, bei neun Archetypen und vier
Bossen also **156** Bilder.

Die Kantenlänge folgt `spriteWidth` nach CONTENT_TABLES Abschnitt 6:

| Einheit | spriteWidth | Größe |
|---|---|---|
| `rat`, `crawler`, `miner`, `drone`, `spore`, `chainrunner`, `cultist` | bis 1.0 | 64 |
| `hauler`, `warden`, `boss_halvern`, `boss_rime` | 1.1 bis 1.4 | 96 |
| `boss_sorlax`, `boss_sporemother` | 1.6 und 2.0 | 128 |

Für dich als Ersteller ändert sich dadurch nichts am Bild, nur die Zielgröße beim
Aufbereiten. Die Quellen sind ohnehin 1024 x 1024.

**Das ist die realistische Bremse des Projekts.** Mein Rat: Fang mit vier Bildern je Gegner
an, `idle_0`, `attack_0`, `pain_0`, `death_0`, und wiederhole sie im Spiel. Das sieht
weniger flüssig aus, ist aber in einem Abend zu schaffen statt in zwei Wochen. Die
Frame-Listen in `content/enemies.json` dürfen kürzer sein, das Format erlaubt es.

Vorgehen für Gleichbleiben über die Frames: Erst `idle_0` erzeugen, bis er stimmt. Dann
dieses Bild anhängen und die weiteren Zustände mit dem Zusatz anfordern:

```
Dieselbe Figur wie im angehaengten Bild, identische Farben,
identische Proportionen, identische Silhouette. Geaenderte
Haltung: [Zustandsbeschreibung].
```

| archetype | Beschreibung für `idle_0` |
|---|---|
| `rat` | aufgedunsenes Nagetier von Hundegrösse, halb verwest, kahle Stellen im Fell, milchige Augen |
| `crawler` | vielbeiniges Wesen, flach, sehnig, hängt kopfüber, sechs dünne Gliedmassen |
| `miner` | Bergmann in zerrissener Schutzkleidung, Helmlampe noch an, gebeugte Haltung, Gesicht im Schatten |
| `drone` | kompakte Wartungsdrohne, drei Linsen, ein ausgefahrener Schneidarm, an einer Halterung |
| `spore` | menschlicher Torso, Brustkorb aufgeplatzt, daraus wächst ein fahler Pilzkörper |
| `chainrunner` | vierbeiniges Wesen aus Fördergerät und Gewebe verwachsen, schleift schwere Ketten |
| `cultist` | Gestalt in einer Kutte aus Förderbandmaterial, Atemmaske mit runden Filtern |
| `hauler` | schweres Transport-Exoskelett, darin ein vertrockneter Körper, hydraulische Arme |
| `warden` | drei Meter hohe Gestalt, Panzerung aus verschmolzenem Gestein und Stahlträgern |

Zustandsbeschreibungen für die weiteren Frames:
- `attack`: holt aus beziehungsweise feuert, Gliedmassen nach vorn, Körper gestreckt
- `pain`: zuckt zurück, Kopf weggedreht, Gliedmassen eingezogen
- `death`: sackt zusammen, in vier Stufen bis zu einem Haufen am Boden

### Bosse

Größen nach der Tabelle oben. Bosse tragen dieselbe Frameliste wie Archetypen, auch
`boss_sporemother`: ihre `idle`-Frames zeigen die Atembewegung des Pilzkörpers, ihre
`death`-Frames den Zerfall.

| id | Beschreibung |
|---|---|
| `boss_halvern` | ehemaliger Schichtleiter, mit einem Schweissbrenner verwachsen, Gasflasche auf dem Rücken, Schläuche in den Körper eingewachsen, Flamme an der Lanze |
| `boss_sporemother` | unbeweglicher Pilzkörper, der eine Stollenwand ausfüllt, mehrere Öffnungen, aus denen Sporen austreten, menschliche Umrisse im Gewebe erkennbar |
| `boss_rime` | Gruppe menschlicher Gestalten, verschmolzen und in eine von innen wachsende Eisschicht eingeschlossen, blaustichig, ein einzelner Arm ragt heraus |
| `boss_sorlax` | kein zusammenhängender Körper, ein schwebender dunkler Kern, umgeben von acht ungleichen Gliedmassen, violette Adern, ein Zepter steckt im Kern |

## 7. Waffenansichten

Größe 160 x 100. Dateiname `public/assets/weapons/<name>.png`.
Das ist die Ansicht der eigenen Waffe am unteren Bildrand.

Zusatzregel:

```
Ansicht aus der Ego-Perspektive, die Waffe von schraeg unten
rechts ins Bild gehalten, die Haende des Traegers am unteren
Bildrand sichtbar. Querformat. Der obere Bildbereich bleibt
transparent.
```

| id | Beschreibung |
|---|---|
| `w_prybar` | schwere Brechstange aus Stahl, abgenutzt, Farbe abgeplatzt |
| `w_pistol` | schlichte 9-mm-Dienstpistole, mattschwarz, Werkschutz-Prägung |
| `w_shotgun` | umgebaute Bolzensetzflinte, kurzer dicker Lauf, Holzschaft |
| `w_riveter` | Bolzenkarabiner: druckluftbetriebenes Setzgerät in Karabinerform, Drucktank im Schaft eingebaut, Manometer am Gehäuse, kein loser Schlauch |
| `w_charger` | Werfer für Vortriebsladungen, dickes Rohr, Trommelmagazin |
| `w_lance` | Schweisslanze mit Brennerspitze, blaue Flamme, Schlauch zur Gasflasche |
| `w_sprayer` | Sprühgerät mit Kanister und Düse, grüne Schlieren am Auslass |
| `w_rod` | Induktionsstab mit Kupferwicklungen, gelbe Funken zwischen zwei Elektroden |
| `w_drill` | Handbohrer mit vereister Spitze, Kühlmittelleitung, weisser Dampf |
| `w_scepter` | fremdartiges Zepter aus dunklem Material, violett leuchtende Spitze, nicht menschliche Form |

Je Waffe zwei Bilder: Ruhehaltung `<name>_idle` und Feuern `<name>_fire`.

## 8. Inventarsymbole

Größe 32 x 32. Dateiname `public/assets/icons/<id>.png`.
Frontale Draufsicht, freigestellt, ohne Rahmen. Die Raritätsfarbe zeichnet die Oberfläche
selbst, sie gehört nicht ins Bild.

Benötigt für alle Ids aus BESTIARY Abschnitt 8, also die **16** Ausrüstungs-Grundtypen,
weil `gauge_right` dieselben Typen nutzt wie `gauge_left`, für
die zehn Waffen, für die Verbrauchsgüter und Munitionssorten aus CONTENT_TABLES
Abschnitt 1 und für die vier Schlüssel.

Zusatzregel:

```
Einzelner Gegenstand, frontal von oben, mittig, freigestellt
auf transparentem Hintergrund. Sehr einfache, klar lesbare
Silhouette, weil das Bild nur 32 Pixel gross dargestellt wird.
```

## 9. Reihenfolge, die ich empfehle

1. Zone 1 vollständig: Ids 10 bis 13, 40 bis 42, 70 bis 72. Ins Spiel einbauen und im
   Browser ansehen. Erst wenn eine Wand kachelt, ohne dass eine Naht sichtbar ist, stimmt
   der Ablauf
2. Zwei Bodenspuren, 65 bis 68, weil sie das Kachelproblem in seiner härtesten Form zeigen
3. Ein Gegner vollständig, `miner`, mit vier Frames
4. Eine Waffe, `w_prybar`, mit zwei Bildern
5. Erst danach der Rest

Nach Schritt 4 hast du jeden Typ von Grafik einmal durchgespielt und weißt, wie lange der
Rest dauert. Bis dahin bleiben die Platzhalter aktiv, das Spiel ist also durchgehend
lauffähig.


## 10. Bestätigte Annahmen

Beide Annahmen aus der Rückmeldung sind richtig und gelten.

**Einzigartige Gegenstände bekommen kein eigenes Symbol.** Sie nutzen das Symbol ihres
`baseId` und heben sich über Name, Rahmenfarbe und Affixe ab. Das ist auch in Diablo 2 so
gelöst und spart acht Bilder.

**Elementvarianten bekommen keine eigenen Sprites.** Farbfilter zur Ladezeit, wie in
BESTIARY Abschnitt 4 festgelegt. Dreizehn Einheiten decken alle 28 Gegnerdefinitionen plus
vier Bosse ab.

## 11. Gesamtzahl

| Kategorie | Anzahl |
|---|---|
| Wandtexturen | 16 |
| Boden- und Deckentexturen | 24 |
| Bodenspuren, inklusive Id 55 | 10 |
| Gegner- und Bossframes | 156 |
| Waffenansichten, je zwei Bilder | 20 |
| Inventarsymbole | 16 Grundtypen, 10 Waffen, 14 Verbrauchsgüter, 4 Schlüssel |

Mit dem Rat aus Abschnitt 6, zunächst vier Frames je Einheit statt zwölf, sinkt die
Framezahl von 156 auf 52 und die Gesamtzahl auf unter 150.
