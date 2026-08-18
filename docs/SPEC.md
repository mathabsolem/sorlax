# Scepter of Sorlax — SPEC v1.1

Status: eingefroren. Ersetzt v1.0 vollständig.
Änderungen gegenüber v1.0: Software-Renderer statt Canvas-Zeichenbefehlen, texturierter
Boden und Decke pro Kachel, Beleuchtung pro Kachel, Setting festgelegt.

Alle Module lesen diese Datei plus INTERFACES.md als Input.

---

## 1. Ziel und Setting

Rundenbasierter Dungeon Crawler aus der Ego-Perspektive, mechanisch angelehnt an DOOM RPG.
Eigene Marke, eigene Assets, keine Übernahme geschützter Namen, Texturen oder Töne.

Setting: eine unterirdische Bergbauanlage, in der ein Konzern beim Vortrieb eine ältere,
nicht menschliche Struktur angeschnitten hat. Optischer Kontrast aus verrosteter
Industrietechnik und organisch wirkendem Gestein. Der Kontrast ist kein Selbstzweck,
sondern liefert mit wenigen Texturen viel Abwechslung.

Kernschleife: Der Spieler bewegt sich Feld für Feld durch ein Raster, jede zeitkostende
Aktion gibt allen Gegnern eine Aktion. Kämpfe sind Rechenoperationen ohne
Reaktionszeitanforderung.

## 2. Plattform und Technik

| Bereich | Entscheidung |
|---|---|
| Sprache | TypeScript, strict mode |
| Build | Vite |
| Rendering | Software-Renderer in einen Pixelpuffer, Ausgabe per putImageData |
| Interne Auflösung | 320 x 200, per Nearest Neighbor hochskaliert |
| Ziel-Framerate | 60 fps, Logik ist framerateunabhängig |
| Mobile Verpackung | Capacitor, Android und iOS |
| Backend | PHP 8.1+, MySQL 8, JSON über HTTPS |
| Framework Frontend | keines |

Warum Software-Renderer: Texturierter Boden erfordert Pixelzugriff. Ein Mischbetrieb aus
Pixelpuffer für den Boden und `drawImage` für Wände kostet mehr als er spart, weil der
Browser den Puffer bei jedem Wechsel synchronisieren muss. Deshalb wird alles in einen
`Uint32Array` geschrieben und einmal pro Bild ausgegeben.

Kostenabschätzung: 320 x 200 sind 64000 Pixel pro Bild. Boden und Decke nutzen
Zeilenkohärenz, also eine Division pro Bildzeile und zwei Additionen pro Pixel. Das ist
auf Geräten der letzten zehn Jahre unkritisch.

## 3. Spielmodell

### 3.1 Raster und Koordinaten

- Karte ist ein 2D-Raster fester Größe, Kachelgröße 1.0 in Weltkoordinaten.
- x wächst nach Osten, y wächst nach Süden.
- Spieler und Gegner besetzen genau eine Kachel.
- Vier Blickrichtungen: 0 = Nord, 1 = Ost, 2 = Süd, 3 = West.
- Die Logik kennt nur ganzzahlige Positionen und die vier Richtungen. Der Renderer hält
  zusätzlich eine interpolierte Float-Position und einen Float-Winkel.

### 3.2 Rundenmodell

| Aktion | Kosten |
|---|---|
| Drehen um 90 Grad | 0 |
| Schritt vorwärts, rückwärts, seitwärts | 1 |
| Angriff | 1 |
| Item benutzen | 1 |
| Warten | 1 |
| Tür öffnen, Schalter betätigen | 1 |
| Menü öffnen, Karte ansehen | 0 |

Ablauf pro Runde:
1. Spieler führt eine Aktion mit Kosten 1 aus.
2. Rundenzähler wird erhöht.
3. Jeder aktive Akteur erhält `speed` Aktionspunkte. Solange ein Akteur mindestens 1.0
   Punkte hat, führt er eine Aktion aus und verliert 1.0 Punkte.
4. Statuseffekte werden abgearbeitet, dann Siegbedingung und Tod geprüft.

`speed` 1.0 ist Standard, 2.0 bedeutet zwei Aktionen pro Runde, 0.5 eine Aktion in jeder
zweiten Runde. Die Punkte werden im Savegame persistiert, sonst ist Laden nicht
deterministisch.

### 3.3 Determinismus

Ein einziger Seeded RNG, xorshift128, Zustand ist Teil des Savegames. Kein `Math.random()`
in `src/core/`.

### 3.4 Sichtbarkeit

- Ein Gegner wird aktiv, wenn er Sichtlinie zum Spieler hat und die Distanz kleiner gleich
  `aggroRange` ist, oder wenn er Schaden nimmt.
- Sichtlinie per Bresenham über das Raster, blockiert durch solide Kacheln und
  geschlossene Türen.
- Einmal aktiv bleibt ein Gegner aktiv bis zu seinem Tod.

## 4. Kampfregeln

Verbindlich. Kein Modul erfindet eigene Formeln.

### 4.1 Trefferwahrscheinlichkeit

```
hitChance = clamp(0.05, 0.95, 0.75 + (attacker.accuracy - defender.evasion) * 0.02 - rangePenalty)
rangePenalty = max(0, distance - weapon.optimalRange) * 0.05
```

Distanz ist die Chebyshev-Distanz in Kacheln. Nahkampf hat `optimalRange` 1.

### 4.2 Schaden

```
roll   = randInt(weapon.dmgMin, weapon.dmgMax)
isCrit = rng() < weapon.critChance
raw    = isCrit ? roll * 2 : roll
final  = max(1, raw - floor(defender.armor * 0.5))
```

### 4.3 Flächenschaden

```
final = max(1, floor(baseDamage * (1 - distance / radius)) - floor(armor * 0.5))
```

Der Spieler nimmt Selbstschaden aus eigenen Explosionen zu 50 Prozent.

### 4.4 Munition

Jede Waffe hat einen `ammoType` oder `null` für Nahkampf. Ein Angriff ohne Munition ist
keine gültige Aktion und kostet keine Runde.

## 5. Entitäten

### 5.1 Spieler

Startwerte: maxHealth 50, armor 0, accuracy 10, evasion 5, level 1, xp 0.

### 5.2 Gegner

| behavior | Beschreibung |
|---|---|
| `melee` | nähert sich per Pfadsuche, greift bei Distanz 1 an |
| `ranged` | hält Distanz `preferredRange`, schießt bei Sichtlinie |
| `charger` | speed 2.0, nur Nahkampf, keine Pfadsuche, läuft direkt |
| `turret` | bewegt sich nie, schießt bei Sichtlinie |

Pfadsuche: A-Stern auf dem Raster, nur vier Nachbarn, Grenze 200 besuchte Knoten pro
Aufruf. Bei Überschreitung fällt der Gegner auf Direktbewegung zurück.

Gegner öffnen keine Türen und sammeln keine Items ein.

### 5.3 Items

Typen: `weapon`, `ammo`, `heal`, `armor`, `key`, `keyCard`, `quest`, `powerup`.
Schlüssel sind farbcodiert und blockieren passende Türen.

### 5.4 Kacheln

Jede Kachel trägt vier Werte: Wand, Boden, Decke, Licht.
Wand 0 bedeutet begehbarer Boden. Boden und Decke sind immer gesetzt, auch unter Wänden,
dort werden sie nur nie sichtbar.

Türen sind eigene Entitäten mit Zustand `closed`, `open`, `locked`. Geheimtüren sehen wie
Wände aus und öffnen per Schalter.

## 6. Texturkodierung

Boden-, Decken- und Wandwerte sind je eine Zahl mit eingebetteter Drehung:

```
textureId = value & 0x0FFF          // 0 bis 4095
rotation  = (value >> 12) & 0x3     // 0 bis 3, Vierteldrehungen im Uhrzeigersinn
```

Der Renderer dreht beim Auslesen die Texturkoordinaten. Damit reicht eine Blutspur als
gerades Stück und als Kurve, statt acht Einzelbilder für alle Richtungen.

Konstanten liegen in `src/core/tiles.ts`, kein Modul schreibt die Werte direkt hin.

## 7. Beleuchtung

Jede Kachel hat einen statischen Lichtwert 0 bis 255. Er wird beim Kartenbau gesetzt und
zur Laufzeit nicht verändert.

```
staticLight    = light[tileIndex] / 255
distanceFactor = clamp(0, 1, 1 - dist / MAX_VIEW_DIST)     // MAX_VIEW_DIST = 16
playerLight    = 0.35 * clamp(0, 1, 1 - dist / 4)
brightness     = clamp(0.04, 1, ambientLight * staticLight * distanceFactor + playerLight)
```

`playerLight` ist eine Nahbereichsaufhellung. Ohne sie steht der Spieler in dunklen
Bereichen vor einer schwarzen Wand und sieht gar nichts.

Für Wandflächen wird der Lichtwert der Kachel verwendet, aus der der Ray auf die Wand
trifft, nicht der Wert der Wandkachel selbst. Wandkacheln haben keinen sinnvollen
eigenen Lichtwert.

Nordsüdwände werden zusätzlich mit Faktor 0.7 abgedunkelt, damit Kanten erkennbar sind.

Beim Kartenbau erzeugt `generateLightMap` einen Startwert aus den Positionen der
Deckenlampen. Das Ergebnis wird in die Karte geschrieben und darf danach von Hand
übermalt werden. Der Algorithmus ist eine Flutfüllung mit linearem Abfall über den Radius,
blockiert durch solide Kacheln, mehrere Lampen werden per Maximum kombiniert.

## 8. Progression

XP-Schwellen liegen als Tabelle in `content/progression.json`, nicht im Code.
Pro Levelaufstieg: maxHealth +10, accuracy +2, evasion +1, armor +1 bei geraden Leveln.
Health wird beim Aufstieg voll aufgefüllt.

## 9. Karten

Eine Karte ist eine JSON-Datei nach dem Schema in INTERFACES.md.
Level 1 bis 3 sind handgebaut, maximal 48 x 48 Kacheln.

Persistenter Kartenzustand gehört ins Savegame, nicht in die Kartendatei:
geöffnete Türen, getötete Gegner, aufgesammelte Items, ausgelöste Trigger.

## 10. Speichern und Sync

- Autosave bei jedem Kartenwechsel und alle 50 Runden.
- Drei manuelle Speicherplätze plus ein Autosave-Slot.
- Lokal in IndexedDB, remote über die API aus BACKEND.md.
- Konflikt: Server gewinnt bei höherem `turnCount`, sonst lokal. Bei Gleichstand fragt
  das Spiel nach.
- Savegames sind versioniert, beim Laden läuft eine Migrationskette.

## 11. Steuerung

Touch: virtuelles Steuerkreuz links unten, Drehknöpfe daneben, Aktionsknopf rechts unten,
Waffenwechsel per Wischen über die Waffenanzeige, Tippen auf einen Gegner setzt das Ziel.
Alle Bedienelemente sind DOM-Elemente über dem Canvas, nicht in das Bild gezeichnet, und
mindestens 48 x 48 CSS-Pixel groß.

Tastatur: WASD oder Pfeiltasten, Q und E zum Drehen, Leertaste für Aktion, 1 bis 9 für
Waffen, Tab für Karte, Escape für Menü.

## 12. Ausdrücklich nicht im Umfang

Multiplayer, prozedurale Level, Sprachausgabe, Controller-Support, Achievements, Shop,
dynamische Lichtquellen, Höhenunterschiede, schräge Wände.
Diese Punkte werden nicht vorbereitet und nicht abstrahiert.
