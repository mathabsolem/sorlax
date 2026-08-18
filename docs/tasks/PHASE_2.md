# PHASE 2 — Engine-Kern

Vorbedingung: `npm test` ist grün, `src/core/rng.ts` existiert.
Pflichtlektüre: `docs/SPEC.md` und `docs/INTERFACES.md`.

INTERFACES.md ist ein Vertrag. Ändere dort keine Signatur, keinen Typnamen und kein Feld.
Wenn etwas fehlt, brich ab und melde es, statt die Schnittstelle anzupassen.

---

## Umfang

Nur `src/core/` und `tests/`. Kein Renderer, kein Canvas, kein DOM, kein IndexedDB,
kein fetch, keine UI, keine Kartendateien. Diese Phase erzeugt eine Engine, die
ausschließlich über Funktionsaufrufe in Tests bedient wird.

Verbotene Aufrufe in `src/core/`: `Math.random`, `Date`, `document`, `window`, `fetch`,
`localStorage`, `console`. Zufall kommt nur aus `rng.ts`.

## Dateien

### src/core/types.ts
Alle Typen aus INTERFACES.md Abschnitt 2 bis 6, wörtlich übernommen.
Dies ist die einzige Quelle für diese Typen. Andere Module importieren von hier.
Nur `export type`, keine Logik.

### src/core/grid.ts
- `tileAt(map, x, y): number` gibt bei Koordinaten außerhalb der Karte einen soliden Wert zurück
- `isSolid(map, x, y, state): boolean` berücksichtigt Wände und geschlossene oder verriegelte Türen
- `isWalkable(map, x, y, state): boolean` zusätzlich frei von Gegnern
- `chebyshev(a, b): number`
- `stepFrom(pos, facing, dir): TileCoord` für die vier Bewegungsrichtungen aus SPEC 3.2
- `hasLineOfSight(map, from, to, state): boolean` per Bresenham, blockiert durch solide Kacheln
  und geschlossene Türen. Start- und Zielkachel selbst blockieren nie.
- `tileKey(pos): string` liefert `"x,y"`, `parseTileKey` die Umkehrung

### src/core/pathfinding.ts
`findPath(map, from, to, state, maxNodes = 200): TileCoord[] | null`
A-Stern, nur vier Nachbarn, Manhattan-Heuristik. Bei Überschreitung von `maxNodes`
Rückgabe `null`. Der erste Eintrag des Pfades ist das erste Feld nach `from`.

### src/core/combat.ts
Formeln exakt nach SPEC Abschnitt 4, keine eigenen Varianten.
- `hitChance(attacker: Stats, defender: Stats, weapon: WeaponDef, distance: number): number`
- `rollDamage(rng, weapon): { raw: number; crit: boolean }`
- `applyArmor(raw: number, armor: number): number`
- `splashDamage(baseDamage, radius, distance, armor): number`
- `resolveAttack(...)` würfelt Treffer, berechnet Schaden, zieht Leben ab und gibt
  ein `attack`-Event plus optional ein `died`-Event zurück

### src/core/progression.ts
- `xpToNextLevel(level, progression): number`
- `grantXp(player, amount, progression): GameEvent[]` erhöht ggf. mehrfach das Level
  nach SPEC Abschnitt 6 und füllt Health voll auf

### src/core/ai.ts
`takeEnemyTurn(state, entity, content): GameEvent[]` nach SPEC 5.2.
Aktivierung nach SPEC 3.4: Sichtlinie und `aggroRange`, oder erlittener Schaden.
Ein einmal aktiver Gegner bleibt aktiv.

- `melee`: Pfad zum Spieler, ein Schritt pro Aktion, Angriff bei Distanz 1
- `ranged`: bei Distanz kleiner `preferredRange` einen Schritt zurück, bei größerer
  Distanz einen Schritt vor, bei passender Distanz und Sichtlinie schießen
- `charger`: keine Pfadsuche, Schritt in Richtung der größeren Achsendifferenz,
  bei blockiertem Feld die andere Achse versuchen
- `turret`: nie bewegen, bei Sichtlinie und Reichweite schießen, sonst nichts

Gegner öffnen keine Türen und sammeln keine Items ein.

### src/core/turn.ts
`advanceRound(state, content): GameEvent[]` nach SPEC 3.2 Schritt 2 bis 4.
Aktionspunkte werden im Zustand persistiert. Reihenfolge der Akteure ist die
Reihenfolge im `entities`-Array, damit der Ablauf deterministisch bleibt.

### src/core/commands.ts
`applyCommand(state, cmd, content): GameEvent[]` als einziger Mutationspunkt.

Verbindliche Regeln:
- `turn` kostet keine Runde und ruft `advanceRound` nicht auf
- Ein ungültiges Kommando liefert genau ein `invalid`-Event und lässt den Zustand unverändert
- `move` auf eine Kachel mit Item sammelt dieses automatisch ein und erzeugt ein `pickup`-Event
- `move` auf eine Ausgangskachel erzeugt ein `mapChange`-Event
- `interact` wirkt auf die Kachel direkt vor dem Spieler. Tür geschlossen wird geöffnet,
  Tür verriegelt prüft die Schlüsselfarbe in `player.keys`, sonst `doorChanged` mit `blocked`
- `attack` ohne `targetId` wählt den nächsten Gegner mit Sichtlinie innerhalb `maxRange`,
  bei Gleichstand den mit der kleineren Entity-Id
- `attack` ohne ausreichende Munition ist ungültig
- Trigger mit `on: 'enter'` feuern nach einer Bewegung, vor `advanceRound`
- Sinkt die Health des Spielers auf 0 oder darunter, wird ein `died`-Event erzeugt
  und `advanceRound` nicht mehr ausgeführt

### src/core/state.ts
- `createNewGame(seed, content, startMapId): GameState`
- `serialize(state): string` und `deserialize(json): GameState`
- `CURRENT_SAVE_VERSION` als Konstante
- `migrate(raw): GameState` als Kette, aktuell nur Durchreichen bei passender Version,
  bei unbekannter Version wird ein Fehler geworfen
- `log` wird bei über 100 Einträgen vorne gekürzt

## Tests

Für jede exportierte Funktion mindestens ein Test in `tests/`.
Zusätzlich diese Integrationstests:

1. Gleicher Seed und gleiche Kommandofolge ergeben identische `GameState`-Serialisierung
2. `serialize` gefolgt von `deserialize` liefert einen strukturell identischen Zustand
3. Drehen erhöht `turnCount` nicht, ein Schritt erhöht ihn um genau 1
4. Ein Gegner mit `speed` 2.0 handelt in einer Runde zweimal, einer mit 0.5 in jeder zweiten
5. Schritt gegen eine Wand liefert `invalid` und ändert den Zustand nicht
6. Verriegelte Tür ohne Schlüssel liefert `blocked`, mit Schlüssel öffnet sie
7. Ein Gegner außerhalb der `aggroRange` bleibt inaktiv und verbraucht keine Aktionspunkte

Testdaten als kleine Fixture-Karte von 8 x 8 Kacheln in `tests/fixtures/`, nicht in `content/`.

## Abschluss

`npm run typecheck` und `npm test` müssen grün sein.
Commit mit `feat(core): grid, combat, ai, turn scheduler, commands`.
Danach anhalten. Keine weitere Phase beginnen.
