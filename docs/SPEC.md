# Scepter of Sorlax — SPEC v1.0

Status: eingefroren. Aenderungen nur ueber diesen Chat, danach Versionsnummer erhoehen.
Alle Module lesen diese Datei plus INTERFACES.md als Input.

---

## 1. Ziel

Rundenbasierter Dungeon Crawler aus der Ego-Perspektive, mechanisch angelehnt an DOOM RPG (2005).
Eigene Marke, eigene Assets, keine Uebernahme geschuetzter Namen, Texturen oder Sounds.

Kernschleife: Der Spieler bewegt sich Feld fuer Feld durch ein Raster, jede zeitkostende Aktion
gibt allen Gegnern eine Aktion. Kaempfe sind Rechenoperationen ohne Reaktionszeitanforderung.

## 2. Plattform und Technik

| Bereich | Entscheidung |
|---|---|
| Sprache | TypeScript, strict mode |
| Build | Vite |
| Rendering | HTML5 Canvas 2D, Raycaster |
| Interne Aufloesung | 320 x 200, per Nearest Neighbor auf Canvas skaliert |
| Ziel-Framerate | 60 fps, Logik ist framerateunabhaengig |
| Mobile Verpackung | Capacitor, Android und iOS |
| Backend | PHP 8.1+, MySQL 8, JSON ueber HTTPS |
| Framework Frontend | keines |

Begruendung interne Aufloesung: Ein Raycaster kostet pro Bildspalte einen Ray. 320 Spalten sind
auf jedem Geraet der letzten zehn Jahre unkritisch, native Aufloesung waere es nicht.

## 3. Spielmodell

### 3.1 Raster und Koordinaten

- Karte ist ein 2D-Raster fester Groesse, Kachelgroesse 1.0 in Weltkoordinaten.
- x waechst nach Osten, y waechst nach Sueden.
- Spieler und Gegner besetzen genau eine Kachel.
- Vier Blickrichtungen: 0 = Nord, 1 = Ost, 2 = Sued, 3 = West.
- Die Logik kennt nur ganzzahlige Positionen und die vier Richtungen. Der Renderer haelt
  zusaetzlich eine interpolierte Float-Position und einen Float-Winkel fuer weiche Uebergaenge.

### 3.2 Rundenmodell

Aktionen und ihre Zeitkosten:

| Aktion | Kosten |
|---|---|
| Drehen um 90 Grad | 0 |
| Schritt vorwaerts, rueckwaerts, seitwaerts | 1 |
| Angriff | 1 |
| Item benutzen | 1 |
| Warten | 1 |
| Tuer oeffnen, Schalter betaetigen | 1 |
| Menue oeffnen, Karte ansehen | 0 |

Ablauf pro Runde:
1. Spieler fuehrt eine Aktion mit Kosten 1 aus.
2. Rundenzaehler wird erhoeht.
3. Jeder aktive Akteur erhaelt `speed` Aktionspunkte. Solange ein Akteur mindestens 1.0 Punkte
   hat, fuehrt er eine Aktion aus und verliert 1.0 Punkte.
4. Statuseffekte werden abgearbeitet, dann Siegbedingung und Tod geprueft.

`speed` 1.0 ist Standard, 2.0 bedeutet zwei Aktionen pro Runde, 0.5 bedeutet eine Aktion in
jeder zweiten Runde. Die Punkte werden im Savegame persistiert, sonst ist Laden nicht
deterministisch.

### 3.3 Determinismus

Ein einziger Seeded RNG (xorshift128), Zustand ist Teil des Savegames. Kein `Math.random()`
im Verzeichnis `core/`. Damit ist ein Spielverlauf reproduzierbar und serverseitig grob pruefbar.

### 3.4 Sichtbarkeit

- Gegner handeln nur, wenn sie aktiv sind. Aktiv wird ein Gegner, wenn er Sichtlinie zum Spieler
  hat und die Distanz kleiner gleich `aggroRange` ist, oder wenn er Schaden nimmt.
- Sichtlinie per Bresenham ueber das Raster, blockiert durch solide Kacheln und geschlossene Tueren.
- Einmal aktiv bleibt ein Gegner aktiv bis zu seinem Tod.

## 4. Kampfregeln

Alle Formeln sind verbindlich. Kein Modul erfindet eigene.

### 4.1 Trefferwahrscheinlichkeit

```
hitChance = clamp(0.05, 0.95, 0.75 + (attacker.accuracy - defender.evasion) * 0.02 - rangePenalty)
rangePenalty = max(0, distance - weapon.optimalRange) * 0.05
```

Nahkampf hat `optimalRange` 1. Distanz ist die Chebyshev-Distanz in Kacheln.

### 4.2 Schaden

```
roll        = randInt(weapon.dmgMin, weapon.dmgMax)
isCrit      = rng() < weapon.critChance
raw         = isCrit ? roll * 2 : roll
final       = max(1, raw - floor(defender.armor * 0.5))
```

### 4.3 Flaechenschaden

Explosionen treffen alle Akteure im Radius, Schaden faellt linear ab:
```
final = max(1, floor(baseDamage * (1 - distance / radius)) - floor(armor * 0.5))
```
Der Spieler nimmt Selbstschaden aus eigenen Explosionen zu 50 Prozent.

### 4.4 Munition

Jede Waffe hat einen `ammoType` oder `null` fuer Nahkampf. Ein Angriff ohne Munition ist keine
gueltige Aktion und kostet keine Runde.

## 5. Entitaeten

### 5.1 Spieler

Startwerte: maxHealth 50, armor 0, accuracy 10, evasion 5, level 1, xp 0.

### 5.2 Gegner

Definiert in `data/enemies.json`. Verhaltensmuster:

| behavior | Beschreibung |
|---|---|
| `melee` | naehert sich per Pfadsuche, greift bei Distanz 1 an |
| `ranged` | haelt Distanz `preferredRange`, schiesst bei Sichtlinie |
| `charger` | speed 2.0, nur Nahkampf, keine Pfadsuche, laeuft direkt |
| `turret` | bewegt sich nie, schiesst bei Sichtlinie |

Pfadsuche: A-Stern auf dem Raster, nur vier Nachbarn, Grenze 200 besuchte Knoten pro Aufruf.
Bei Ueberschreitung faellt der Gegner auf Direktbewegung zurueck.

### 5.3 Items

Typen: `weapon`, `ammo`, `heal`, `armor`, `key`, `keyCard`, `quest`, `powerup`.
Schluessel sind farbcodiert und blockieren passende Tueren.

### 5.4 Tueren und Kacheln

Wandkacheln sind ganze Zahlen, 0 ist begehbarer Boden. Tueren sind eigene Entitaeten mit
Zustand `closed`, `open`, `locked`. Geheimtueren sehen wie Waende aus und oeffnen per Schalter.

## 6. Progression

XP-Schwellen liegen als Tabelle in `data/progression.json`, nicht im Code.
Pro Levelaufstieg: maxHealth +10, accuracy +2, evasion +1, armor +1 bei geraden Leveln.
Health wird beim Aufstieg voll aufgefuellt.

## 7. Karten

Eine Karte ist eine JSON-Datei. Schema steht in INTERFACES.md.
Level 1 bis 3 sind handgebaut, Groesse jeweils maximal 48 x 48 Kacheln.
Jede Karte hat mindestens einen Ausgang und definiert die Startposition beim Betreten.

Persistenter Kartenzustand: geoeffnete Tueren, getoetete Gegner, aufgesammelte Items,
ausgeloeste Trigger. Dieser Zustand gehoert ins Savegame, nicht in die Kartendatei.

## 8. Speichern und Sync

- Autosave bei jedem Kartenwechsel und alle 50 Runden.
- Drei manuelle Speicherplaetze plus ein Autosave-Slot.
- Lokal in IndexedDB, remote ueber die API aus BACKEND.md.
- Konfliktstrategie: Server gewinnt bei hoeherem `turnCount`, sonst lokal. Bei Gleichstand
  wird der Nutzer gefragt.
- Savegames sind versioniert. Beim Laden einer aelteren Version laeuft eine Migrationskette.

## 9. Steuerung

Touch: virtuelles Steuerkreuz links unten, Aktionsknopf rechts unten, Waffenwechsel per Wischen
ueber die Waffenanzeige, Tippen auf einen Gegner setzt das Ziel.
Tastatur: WASD oder Pfeiltasten, Q und E fuer Drehen, Leertaste fuer Aktion, 1 bis 9 fuer Waffen,
Tab fuer Karte, Escape fuer Menue.

Alle Bedienelemente sind mindestens 48 x 48 CSS-Pixel gross.

## 10. Ausdruecklich nicht im Umfang

Multiplayer, prozedurale Level, Sprachausgabe, Controller-Support, Achievements, Shop.
Diese Punkte werden nicht vorbereitet und nicht abstrahiert.
