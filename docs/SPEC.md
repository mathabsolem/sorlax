# Scepter of Sorlax — SPEC v1.2

Status: eingefroren. Ersetzt v1.1 vollständig.
Ergänzende Dokumente: BESTIARY.md v2 für Inhalte, RPG.md für das Fortschrittssystem.

Änderungen gegenüber v1.1: Schadensarten und Resistenzen, Statuseffekte, Attribute und
abgeleitete Werte, Ausrüstung, Fertigkeiten, drei Schwierigkeitsgrade, 16 Sohlen,
Bossskripte, ausgerüstete Gegner.

---

## 1. Ziel und Setting

Rundenbasierter Dungeon Crawler aus der Ego-Perspektive mit Fortschrittssystem in der
Tradition von Diablo 2. Eigene Marke, eigene Assets.

Setting: die unterirdische Bergbauanlage Schacht Corvane der Verrath Fördergesellschaft.
Beim Vortrieb auf Sohle 7 wurde eine ältere, nicht menschliche Struktur angeschnitten.
Sechzehn Sohlen, alle vier Sohlen ein Boss.

Kernschleife: Der Spieler bewegt sich Feld für Feld durch ein Raster, jede zeitkostende
Aktion gibt allen Gegnern eine Aktion.

## 2. Plattform und Technik

| Bereich | Entscheidung |
|---|---|
| Sprache | TypeScript, strict mode |
| Build | Vite |
| Rendering | Software-Renderer in einen Pixelpuffer, Ausgabe per putImageData |
| Interne Auflösung | 320 x 200, per Nearest Neighbor hochskaliert |
| Mobile Verpackung | Capacitor, Android und iOS |
| Backend | PHP 8.1+, MySQL 8, JSON über HTTPS |
| Framework Frontend | keines |

## 3. Spielmodell

### 3.1 Raster und Koordinaten

Kachelgröße 1.0, x nach Osten, y nach Süden. Vier Blickrichtungen: 0 Nord, 1 Ost, 2 Süd,
3 West. Die Logik kennt nur ganzzahlige Positionen, der Renderer interpoliert.

### 3.2 Rundenmodell

| Aktion | Kosten |
|---|---|
| Drehen | 0 |
| Schritt | 1 |
| Angriff | 1 |
| Aktive Fertigkeit | 1 |
| Verbrauchsgut benutzen | 1 |
| Warten | 1 |
| Tür oder Schalter | 1 |
| Anlegen, Ablegen, Punkte verteilen, Menü, Karte | 0 |

Ablauf pro Runde:
1. Spieler führt eine Aktion mit Kosten 1 aus.
2. Rundenzähler wird erhöht.
3. Jeder aktive Akteur erhält `speed` Aktionspunkte, bei `chill` beim Spieler das Doppelte.
   Solange ein Akteur mindestens 1.0 Punkte hat, handelt er und verliert 1.0.
4. Statuseffekte werden abgearbeitet, Abklingzeiten um 1 gesenkt, dann Tod geprüft.

`freeActionChance` wird vor Schritt 2 geprüft. Bei Erfolg kostet die Aktion keine Runde,
Schritte 2 bis 4 entfallen. Höchstens einmal pro Spieleraktion.

### 3.3 Determinismus

Ein Seeded RNG, xorshift128, Zustand im Savegame. Kein `Math.random()` in `src/core/`,
einschließlich `src/core/bosses/` und `src/core/skills/`.

Ausrüstung und Drops einer Sohle werden beim ersten Betreten gewürfelt und in
`MapRuntimeState` festgeschrieben, `rolled` wird auf true gesetzt. Neuladen erzeugt keine
neuen Würfe.

### 3.4 Sichtbarkeit

Ein Gegner wird aktiv bei Sichtlinie und Distanz kleiner gleich `aggroRange`, oder bei
erlittenem Schaden. Einmal aktiv bleibt aktiv. Sichtlinie per Bresenham, blockiert durch
solide Kacheln und geschlossene Türen.

## 4. Kampfregeln

### 4.1 Trefferwahrscheinlichkeit

```
hitChance = clamp(0.05, 0.95, 0.75 + (attacker.accuracy - defender.evasion) * 0.02 - rangePenalty)
rangePenalty = max(0, distance - weapon.optimalRange) * 0.05
```

Distanz ist die Chebyshev-Distanz in Kacheln.

### 4.2 Schaden

Verbindliche Reihenfolge:

```
roll        = randInt(weapon.dmgMin, weapon.dmgMax)
typBonus    = (damageType === 'physical' && optimalRange <= 1) ? meleeBonus
            : (damageType !== 'physical') ? elemBonus : 0
raw         = round(roll * (1 + typBonus))
isCrit      = rng() < (weapon.critChance + attacker.critBonus)
raw         = isCrit ? raw * 2 : raw
afterResist = max(1, floor(raw * (1 - defender.resistances[damageType] / 100)))
final       = max(1, afterResist - floor(defender.armor * 0.5))
```

Erst Resistenz, dann Rüstung. Umgekehrt wären Resistenzen bei gepanzerten Zielen fast
wirkungslos.

Spielerresistenzen sind auf 75 Prozent gedeckelt, nach unten unbegrenzt.

### 4.3 Flächenschaden

```
final = max(1, floor(baseDamage * (1 - distance / radius) * (1 - resist / 100)) - floor(armor * 0.5))
```

Der Spieler nimmt Selbstschaden aus eigenen Explosionen zu 50 Prozent.

### 4.4 Munition

Waffen ohne `ammoType` sind Nahkampf. Ein Angriff ohne Munition ist ungültig und kostet
keine Runde. `ammoSaveChance` verhindert den Verbrauch, nicht den Schuss.

### 4.5 Statuseffekte

| id | Quelle | Wirkung | Dauer |
|---|---|---|---|
| `burn` | fire | 4 Schaden pro Runde, ignoriert Rüstung | 3 |
| `toxin` | poison | 2 Schaden pro Runde, ignoriert Rüstung | 6 |
| `chill` | ice | Gegner erhalten doppelte Aktionspunkte | 4 |
| `jolt` | shock | Genauigkeit minus 8 | 3 |
| `drain` | void | maxHealth minus 15 Prozent, Rüstung minus 3 | 5 |

Gleiche Effekte stapeln nicht, die Dauer wird erneuert. Abarbeitung in fester Reihenfolge
`burn`, `toxin`, `drain`, `chill`, `jolt`.

Ein Effekt wird nicht ausgelöst, wenn die Resistenz des Ziels gegen sein Element 50 oder
höher ist.

## 5. Fortschritt

Attribute, abgeleitete Werte, Ausrüstung, Gegenstände und Fertigkeiten sind vollständig in
RPG.md beschrieben. Verbindlich sind dort die Abschnitte 1 bis 7 und 9.

Kurzfassung:
- vier Attribute, Start je 10, fünf Punkte pro Level, Maximum 300
- `maxHealth = 20 + 3 * vitality`, `accuracy = floor(4 + 0.6 * agility)`,
  `evasion = floor(1 + 0.4 * agility)`
- ein Fertigkeitspunkt pro Level, höchstens 5 pro Fertigkeit
- Maximales Spielerlevel 60, XP-Schwellen in `content/progression.json`
- zehn Ausrüstungsplätze, 40 Inventarplätze
- Gegenstände sind Instanzen mit gewürfelten Affixen

## 6. Texturkodierung

```
textureId = value & 0x0FFF
rotation  = (value >> 12) & 0x3
```

Konstanten in `src/core/tiles.ts`.

## 7. Beleuchtung

```
staticLight    = light[tileIndex] / 255
distanceFactor = clamp(0, 1, 1 - dist / MAX_VIEW_DIST)          // MAX_VIEW_DIST = 16
playerLight    = 0.35 * clamp(0, 1, 1 - dist / lightRadius)     // lightRadius aus DerivedStats
brightness     = clamp(0.04, 1, ambientLight * staticLight * distanceFactor + playerLight)
```

Wandflächen nutzen den Lichtwert der Kachel, aus der der Ray auf die Wand trifft.
Nordsüdwände zusätzlich Faktor 0.7.

`generateLightMap` erzeugt beim Kartenbau einen Startwert aus `lamps`, Flutfüllung mit
linearem Abfall, blockiert durch solide Kacheln, mehrere Lampen per Maximum kombiniert.

## 8. Schwierigkeitsgrade und Gegnerlevel

| Grad | Stufenversatz | Resistenzstrafe Spieler | Gegner-HP | Gegner-Schaden | XP | Gegnerresistenz |
|---|---|---|---|---|---|---|
| `normal` | 0 | 0 | x1.0 | x1.0 | x1.0 | +0 |
| `hard` | +18 | -40 | x1.9 | x1.6 | x2.0 | +25 |
| `nightmare` | +36 | -100 | x3.2 | x2.4 | x3.0 | +50 |

```
sohleBasis   = round(depth * 1.6) + gradVersatz
monsterLevel = clamp(sohleBasis, sohleBasis + 6, playerLevel)

faktor     = 1 + 0.045 * (monsterLevel - 1)
health     = round(baseHealth * faktor * gradFaktorHP)
dmgMin/Max = round(base * (1 + 0.030 * (monsterLevel - 1)) * gradFaktorDmg)
armor      = baseArmor    + floor(monsterLevel / 6)
accuracy   = baseAccuracy + floor(monsterLevel * 0.8)
evasion    = baseEvasion  + floor(monsterLevel / 3)
xpReward   = round(baseXp * (1 + 0.10 * (monsterLevel - 1)) * gradFaktorXP)
```

Ein Grad wird durch den Sieg über Sorlax im vorherigen freigeschaltet. Level, Attribute,
Fertigkeiten und Ausrüstung bleiben erhalten.

## 9. Gegner

| behavior | Beschreibung |
|---|---|
| `melee` | nähert sich per Pfadsuche, greift bei Distanz 1 an |
| `ranged` | hält `preferredRange`, schießt bei Sichtlinie |
| `charger` | speed 2.0, keine Pfadsuche, läuft direkt |
| `turret` | bewegt sich nie, schießt bei Sichtlinie |
| `scripted` | Verhalten aus `src/core/bosses/<scriptId>.ts` |

Pfadsuche: A-Stern, vier Nachbarn, Grenze 200 Knoten, danach Direktbewegung.
Gegner öffnen keine Türen und sammeln keine Items ein.

Ränge: `common` ohne Ausrüstung, `equipped` mit ein bis zwei Teilen und farbigem Umriss,
`boss` mit zwei bis vier Teilen. Anteile und Grenzen in RPG.md Abschnitt 9.

## 10. Karten

16 Sohlen, maximal 48 x 48 Kacheln, erzeugt durch einen deterministischen Generator mit
Seed und geprüft durch einen Validator. Der Validator bricht ab bei nicht erreichbaren
Bereichen, Türen ohne erreichbaren Schlüssel, Gegnern in soliden Kacheln oder fehlendem
Ausgang.

Persistenter Kartenzustand gehört ins Savegame.

## 11. Speichern und Sync

- Autosave bei Sohlenwechsel und alle 50 Runden
- drei manuelle Plätze plus ein Autosave-Platz, je Schwierigkeitsgrad geteilt
- lokal in IndexedDB, remote über BACKEND.md
- Konflikt: Server gewinnt bei höherem `turnCount`, sonst lokal, bei Gleichstand fragt das
  Spiel nach
- versioniert mit Migrationskette
- Obergrenze 2 MB je serialisiertem Stand

## 12. Steuerung

Touch: Steuerkreuz links unten, Drehknöpfe daneben, Aktionsknopf rechts unten,
Fertigkeitsleiste über dem Aktionsknopf, Tippen auf einen Gegner setzt das Ziel.
Alle Bedienelemente sind DOM-Elemente über dem Canvas, mindestens 48 x 48 CSS-Pixel.

Tastatur: WASD oder Pfeiltasten, Q und E drehen, Leertaste Aktion, 1 bis 9 Waffen,
F1 bis F6 Fertigkeiten, I Inventar, K Fertigkeiten, Tab Karte, Escape Menü.

## 13. Ausdrücklich nicht im Umfang

Multiplayer, Handel, Handwerk, Sockelsystem, Söldner, prozedurale Levelgeometrie zur
Laufzeit, Sprachausgabe, Controller, Achievements, dynamische Lichtquellen,
Höhenunterschiede, schräge Wände, Rasterinventar mit Gegenstandsgrößen.
