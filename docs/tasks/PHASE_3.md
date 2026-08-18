# PHASE 3 — Software-Renderer und Eingabe

Vorbedingung: Phase 2 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/SPEC.md` v1.1 und `docs/INTERFACES.md` v1.1.

Achtung: SPEC und INTERFACES wurden auf v1.1 gehoben. Prüfe zuerst, ob `src/core/types.ts`
noch zu INTERFACES v1.1 passt. Abweichungen sind in `types.ts` nachzuziehen, das ist der
einzige Eingriff in `src/core/`, der in dieser Phase erlaubt ist. Zusätzlich neu anzulegen
ist `src/core/tiles.ts` mit den Kodierfunktionen aus INTERFACES Abschnitt 6 und
`src/core/lighting.ts` mit `generateLightMap` nach SPEC Abschnitt 7.

INTERFACES.md bleibt im Übrigen ein Vertrag. Ändere dort nichts.

---

## Umfang

`src/render/`, `src/input/`, minimaler Bootstrap in `src/app/`, dazu die beiden oben
genannten Ergänzungen in `src/core/`.

Kein HUD, keine Menüs, keine Automap, kein Speichern, kein Netz.

Der Renderer mutiert den Spielzustand niemals und hält seinen Animationszustand getrennt.

## Grundaufbau

Ein Pixelpuffer als `Uint32Array` mit 320 * 200 Einträgen, gebunden an ein `ImageData`
über einen gemeinsamen `ArrayBuffer`. Pro Bild wird der Puffer gefüllt und einmal per
`putImageData` auf einen Offscreen-Canvas von 320 x 200 geschrieben.

Dieser Offscreen-Canvas wird mit `imageSmoothingEnabled = false` auf den sichtbaren Canvas
skaliert. Seitenverhältnis bleibt erhalten, Rest schwarz. Anpassung per `ResizeObserver`
unter Berücksichtigung von `devicePixelRatio`.

Kein `drawImage` für Spielinhalte. Wände, Boden, Decke und Sprites gehen alle in den Puffer.

## Zeichenreihenfolge

1. Boden und Decke, zeilenweise
2. Wände, spaltenweise, füllt dabei den `zBuffer`
3. Sprites, sortiert von weit nach nah, spaltenweise gegen den `zBuffer` geprüft
4. Waffenansicht, ungeprüft darüber
5. Vollbildeffekte wie der Trefferblitz

Boden zuerst zu zeichnen und Wände darüber ist verschwenderisch, aber deutlich einfacher
als exaktes Clipping. Bei 64000 Pixeln ist das vertretbar.

## src/render/floorcast.ts

Boden und Decke in einer gemeinsamen Schleife, weil die Decke das Spiegelbild des Bodens ist.

Für jede Bildzeile `y` unterhalb des Horizonts:
```
p          = y - screenHeight / 2
posZ       = 0.5 * screenHeight
rowDistance = posZ / p
```
Daraus die Weltkoordinate am linken Bildrand und ein konstanter Schrittvektor pro Pixel.
Innerhalb der Zeile also nur zwei Additionen pro Pixel, keine Division.

Pro Pixel:
- Kachel aus der Weltkoordinate bestimmen
- Bodenwert und Deckenwert der Kachel lesen, Textur-Id und Drehung nach `tiles.ts` trennen
- Texturkoordinate aus dem Nachkommaanteil, danach die Drehung anwenden
- Helligkeit nach SPEC Abschnitt 7, `dist` ist `rowDistance`
- Boden bei Zeile `y`, Decke bei Zeile `screenHeight - y - 1`

Die Deckenzeile nutzt dieselbe `rowDistance` und dieselbe Kachel, nur das andere Array.

## src/render/raycaster.ts

DDA über das Kachelraster, eine Ray pro Bildspalte, 320 Rays, Sichtfeld 66 Grad.

- perpendikulare Distanz, Wandseite, Texturkoordinate pro Spalte
- `lineHeight = screenHeight / perpDistance`
- Wandwert liefert Textur-Id und Drehung, Drehung wirkt auf die horizontale
  Texturkoordinate und wird bei 1 und 3 zusätzlich vertikal gespiegelt
- Helligkeit nach SPEC Abschnitt 7. `light` wird aus der letzten begehbaren Kachel vor
  dem Treffer gelesen, nicht aus der Wandkachel
- Nordsüdwände zusätzlich Faktor 0.7
- `zBuffer: Float32Array(320)` wird gefüllt

## src/render/shading.ts

Helligkeit wird nicht per Multiplikation pro Kanal berechnet, sondern über eine
Nachschlagetabelle.

```
LEVELS = 32
shadeLUT: Uint8Array(LEVELS * 256)
shadeLUT[level * 256 + value] = round(value * level / (LEVELS - 1))
```

Der Renderer quantisiert `brightness` auf einen Level 0 bis 31 und schlägt die drei Kanäle
nach. Das ersetzt drei Multiplikationen und drei Rundungen pro Pixel durch drei
Array-Zugriffe. Die Tabelle wird einmal beim Start gebaut.

Sichtbare Abstufung bei 32 Stufen ist gewollt und passt zum Stil.

## src/render/sprites.ts

Billboards für Gegner, Items und Dekoration.

- Weltposition in Kamerakoordinaten über die inverse Kameramatrix
- Sortierung nach Distanz, weit nach nah
- Distanz kleiner 0.2 oder hinter der Kamera wird verworfen
- Breite in Kacheln aus `EnemyDef.spriteWidth`, sonst 0.8
- Spaltenweises Clipping gegen den `zBuffer`
- Alpha 0 wird übersprungen, kein Blending
- Helligkeit wie Wände, `light` aus der Kachel des Sprites
- Bildschirmrechteck jedes gezeichneten Sprites wird für `pickEntityAt` abgelegt

## src/render/animation.ts

`consumeEvents` startet Tweens, `frame(dtMs)` treibt sie voran.

| Ereignis | Wirkung | Dauer |
|---|---|---|
| `moved` | Position linear interpoliert | 180 ms |
| `turned` | Winkel interpoliert, kürzester Weg | 140 ms |
| `attack` durch Spieler | Waffensprite fährt zurück und vor | 200 ms |
| `attack` durch Gegner | Attack-Frames | 220 ms |
| Treffer am Spieler | roter Vollbildblitz, Alpha fällt ab | 250 ms |
| Treffer am Gegner | Pain-Frames | 180 ms |
| `died` | Death-Frames, letzter Frame bleibt liegen | 400 ms |

`isAnimating()` liefert true, solange ein blockierender Tween läuft. Blockierend sind
Bewegung, Drehung und Angriff, der Trefferblitz nicht.

Mehrere Gegneraktionen derselben Runde laufen gleichzeitig, nicht nacheinander.

Idle-Frames mit 4 Bildern pro Sekunde, gesteuert über akkumulierte Renderzeit, nicht über
`turnCount`.

## src/render/placeholders.ts

Solange keine Grafik vorliegt, erzeugt dieses Modul die `AssetBundle` prozedural als
`PixelSurface`-Objekte:
- Wandtexturen als 64 x 64 Muster mit sichtbarem Raster, mehrere Farbtöne
- Bodentexturen mit erkennbarer Richtung, etwa ein Pfeilmuster, damit die Drehung
  beim Testen sichtbar wird
- Deckentexturen mit einem hellen Feld in der Mitte als Lampenersatz
- Sprites als farbige Rechtecke mit Buchstabenkürzel des `defId`

Umschaltung über die Konstante `USE_PLACEHOLDERS`.
Der echte PNG-Loader wird mit korrekter Signatur angelegt und dekodiert per
`createImageBitmap` und einem temporären Canvas nach `Uint32Array`. Er muss in dieser
Phase nicht mit echten Dateien getestet werden.

## src/input/

`touch.ts` und `keyboard.ts` erzeugen beide `Command`-Objekte und reichen sie an einen
Callback. Keine direkte Kopplung an `core`.

Touch als DOM-Elemente über dem Canvas:
- Steuerkreuz links unten, vier Flächen mindestens 56 x 56 CSS-Pixel
- zwei Drehflächen daneben
- Aktionsknopf rechts unten, Halten wiederholt nicht
- `touch-action: none` und `user-select: none` auf allen Bedienelementen
- Positionierung mit `env(safe-area-inset-bottom)` und `env(safe-area-inset-left/right)`

Tastatur nach SPEC Abschnitt 11. Waffenwechsel und Kartentaste erzeugen bereits Kommandos.

Eingabesperre: Solange `isAnimating()` true liefert, werden Kommandos verworfen. Genau
eines darf zwischengespeichert und direkt danach ausgeführt werden, nicht mehr.

## src/app/main.ts

Minimaler Bootstrap zur Sichtprüfung:
- lädt eine Entwicklungskarte aus `src/app/devFixture.ts`, 16 x 16 Kacheln, mit
  mindestens einer Tür, zwei Gegnern verschiedener Verhaltensmuster, einem Item,
  zwei Deckenlampen und mindestens einer gedrehten Bodenkachel
- `light` wird in der Fixture über `generateLightMap` erzeugt
- erzeugt `GameState` über `createNewGame` mit festem Seed
- verdrahtet Input, `applyCommand`, `consumeEvents` und die Renderschleife
- `requestAnimationFrame`, `dtMs` auf maximal 100 begrenzen

Die Fixture liegt bewusst nicht in `content/`.

## Tests

Bildausgabe wird nicht getestet. Getestet wird die Mathematik:

1. `encodeTile` und `textureIdOf` plus `rotationOf` sind für alle vier Drehungen und
   Textur-Ids 0, 1, 4095 zueinander invers
2. Ein Ray auf eine Wand in Distanz 3 liefert perpendikulare Distanz 3, Toleranz 0.01
3. Fischaugenausgleich: eine gerade Wand hat über alle Spalten dieselbe Höhe, Toleranz 1 Pixel
4. `rowDistance` für die Bildzeile direkt unter dem Horizont ist deutlich größer als für
   die unterste Bildzeile, und beide sind endlich und positiv
5. Winkelinterpolation von 350 auf 10 Grad läuft über 0, nicht rückwärts über 180
6. `isAnimating` ist nach Ablauf aller Tweens wieder false
7. `generateLightMap`: eine Lampe mit Radius 4 erzeugt am Ursprung den vollen
   Intensitätswert, in Distanz 4 den Wert 0, hinter einer Wand ebenfalls 0
8. Zwei überlappende Lampen ergeben pro Kachel das Maximum, nicht die Summe
9. Textur mit Drehung 1 liefert bei Abfrage von (u, v) denselben Pixel wie die ungedrehte
   Textur bei (v, 63 - u)

## Abnahmekriterium

`npm run dev` zeigt eine begehbare Ansicht mit Platzhaltergrafik. Boden und Decke sind
texturiert, gedrehte Bodenkacheln zeigen ihre Richtung korrekt, unter Lampen ist es
sichtbar heller als in den Ecken, Wände verdecken Gegner, Türen lassen sich öffnen.

`npm run typecheck` und `npm test` grün.
Commit mit `feat(render): software renderer, floorcast, lighting, input`.
Danach anhalten.
