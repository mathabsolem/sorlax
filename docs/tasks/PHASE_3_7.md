# PHASE 3.7 — Fertigkeiten und Bossskripte

Vorbedingung: Phase 3.6 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/SPEC.md` v1.2, `docs/INTERFACES.md` v1.2.1, `docs/RPG.md`
Abschnitt 5, `docs/BESTIARY.md` Abschnitt 5.

INTERFACES wurde auf v1.2.1 gehoben. Neu ist `MapRuntimeState.tempWalls` und der Typ
`TempWall`. Lies die Datei neu ein.

INTERFACES bleibt ein Vertrag. Ändere dort nichts, melde Lücken.

---

## Umfang

`src/core/skills/`, `src/core/bosses/`, `content/`, `tests/`.
Keine UI, kein Renderer. Fertigkeiten werden in dieser Phase über Funktionsaufrufe
ausgelöst, nicht über Knöpfe.

## Block 1, temporäre Wände

Zuerst, weil das Bossverhalten darauf aufbaut.

- `isSolid` in `src/core/grid.ts` berücksichtigt `tempWalls` zusätzlich zu `walls` und
  Türen
- in `advanceRound` werden abgelaufene `tempWalls` entfernt, sobald
  `turnCount >= expiresAtTurn`
- eine temporäre Wand darf nie auf der Kachel des Spielers oder eines Gegners entstehen.
  Der Aufrufer prüft das, `addTempWall` gibt bei besetzter Kachel false zurück
- der Renderer liest `tempWalls` über dieselbe Kachelabfrage wie normale Wände, es ist
  keine Änderung in `src/render/` nötig, sofern dort bereits `isSolid` und die
  Kachelabfrage aus `grid.ts` verwendet werden. Falls dort direkt auf `mapDef.walls`
  zugegriffen wird, ist das jetzt zu korrigieren

## Block 2, Fertigkeitsdaten

`content/skills.json` nach RPG.md Abschnitt 5.

`tree_gear` vollständig:

| id | tier | reqLevel | reqPointsInTree | aktiv | cooldown | Wirkung pro Punkt |
|---|---|---|---|---|---|---|
| `precise_strike` | 1 | 1 | 0 | nein | 0 | accuracy flat +3 |
| `heavy_hand` | 1 | 1 | 0 | nein | 0 | meleeBonus percent +4 |
| `breach` | 2 | 6 | 2 | ja | 4 | ignoriert 40 + 8 je Punkt Prozent Rüstung |
| `steady_aim` | 2 | 6 | 2 | nein | 0 | critBonus flat +2 |
| `sweep` | 3 | 12 | 5 | ja | 6 | 70 + 6 je Punkt Prozent Waffenschaden auf alle in Distanz 1 |
| `execution` | 3 | 12 | 5 | nein | 0 | +20 + 5 je Punkt Prozent gegen Ziele unter 30 Prozent Leben |

`tree_reaction` und `tree_endure` bekommen je sechs Einträge mit `locked: true`, Namen und
Kurzbeschreibung, aber ohne `modifiers` und ohne Handler. Sie dienen als Platzhalter in
der Oberfläche.

`maxPoints` ist überall 5.

## Block 3, passive Fertigkeiten

`modifiers` aus `SkillDef` werden in `getDerivedStats` einbezogen, mit denselben Regeln wie
Ausrüstungsaffixe: flach aufsummieren, prozentual aufsummieren und einmal anwenden.

`execution` ist kein Wert in `DerivedStats`, sondern ein Zuschlag im Kampf. Er wird in
`combat.ts` nach dem Typbonus und vor dem kritischen Treffer angewendet, und nur wenn das
Ziel unter 30 Prozent seiner `maxHealth` liegt.

## Block 4, Punktevergabe

`spendSkillPoint` in `applyCommand`:
- prüft `unspentSkillPoints`, `reqLevel`, `reqPointsInTree`, `maxPoints` und `locked`
- bei Verstoß `invalid` mit sprechendem `reason`
- kostet keine Runde

`reqPointsInTree` zählt alle Punkte im selben Baum, einschließlich der Fertigkeit selbst
nicht.

## Block 5, aktive Fertigkeiten

`src/core/skills/registry.ts` mit `SKILL_REGISTRY: Record<string, SkillHandler>`.
Je eine Datei `src/core/skills/breach.ts` und `src/core/skills/sweep.ts`.

`useSkill` in `applyCommand`:
- prüft, dass die Fertigkeit gelernt und aktiv ist und `cooldowns[skillId]` auf 0 steht
- setzt danach `cooldowns[skillId]` auf `SkillDef.cooldown`
- kostet eine Runde wie ein Angriff
- erzeugt ein `skillUsed`-Ereignis vor den Schadensereignissen

Abklingzeiten werden in `advanceRound` um 1 gesenkt, Untergrenze 0.

`breach`: ein normaler Angriff auf ein Ziel, bei dem die Rüstung des Ziels vor der
Anwendung um den Prozentsatz reduziert wird. Resistenz bleibt unberührt.

`sweep`: trifft jeden Gegner in Chebyshev-Distanz 1, jeweils mit eigenem Trefferwurf.
Reihenfolge nach Entity-Id aufsteigend, damit der Ablauf deterministisch bleibt.

## Block 6, Bossgerüst

`src/core/bosses/registry.ts` mit `BOSS_REGISTRY: Record<string, BossHandler>`.
`takeEnemyTurn` verzweigt bei `behavior === 'scripted'` über `scriptId` in die Registry.
Fehlt ein Eintrag, wird ein `message`-Ereignis erzeugt und der Gegner handelt nicht.
Kein stiller Absturz.

Hilfsfunktionen in `src/core/spawn.ts`:
- `spawnEnemy(state, defId, pos, content): Entity | null`, null bei besetzter oder solider
  Kachel
- `freeTilesAround(state, center, radius): TileCoord[]`, sortiert nach Distanz, dann x,
  dann y, damit die Auswahl deterministisch ist

`entity.scriptState` hält alle Zähler. Es ist `Record<string, number>` und wird
serialisiert. Keine Zustände in Modulvariablen, sonst überlebt der Bosskampf kein Laden.

## Block 7, Bossmodule

Vier Dateien nach BESTIARY Abschnitt 5. Dazu die vier `EnemyDef`-Einträge in
`content/enemies.json` mit `behavior: 'scripted'` und passendem `scriptId`.

`halvern`
Phasenzähler in `scriptState.phase` und `scriptState.phaseTurns`.
Ansturm 3 Runden, zwei Schritte pro Aktion Richtung Spieler, Angriff bei Distanz 1 mit
`burn`. Flammenwand 2 Runden, ohne Bewegung, trifft alle Akteure auf den bis zu drei
Feldern in gerader Blickrichtung, blockiert durch solide Kacheln. Unter 40 Prozent Leben
dauert der Ansturm nur noch 2 Runden.

`sporemother`
Bewegt sich nie. Alle 4 Runden Flächenschaden mit Radius 3 um den Spieler und `toxin`.
Alle 6 Runden zwei `spore_poison` an den nächstgelegenen freien Feldern, höchstens sechs
gleichzeitig lebend. Solange mindestens ein Sporenträger lebt, halbiert sich der erlittene
Schaden. Diese Reduktion wird in `resolveAttack` über eine Prüfung auf `scriptState.guarded`
umgesetzt, das der Handler pro Runde setzt.

`rime`
Hält Distanz 5 bis 7, weicht aus, wenn der Spieler näher kommt. Fernangriff mit `chill`.
Bei Distanz unter 3 höchstens alle 8 Runden ein Versatz auf ein freies Feld in Distanz 6.
Unter 50 Prozent Leben alle 5 Runden vier `tempWalls` im Umkreis 4 mit
`expiresAtTurn = turnCount + 6`, nie auf besetzten Kacheln.

`sorlax`
Drei Phasen nach Anteil der Lebenspunkte, 66 und 33 Prozent als Grenzen.
Phase 1 Nahkampf mit `drain`. Phase 2 ohne Bewegung, alle 3 Runden zwei Gegner aus einer
festen Liste von Archetypen, höchstens acht gleichzeitig. Phase 3 Fernkampf, jede zweite
Runde eine gerade Linie über die volle Sichtweite, in der Runde davor ein
`message`-Ereignis als Warnung.

Ein Phasenwechsel darf pro Runde höchstens einmal stattfinden.

## Tests

1. `spendSkillPoint` auf `breach` ohne 2 Punkte in Stufe 1 liefert `invalid`
2. `spendSkillPoint` auf eine Fertigkeit mit `locked` liefert `invalid`
3. Ein sechster Punkt auf dieselbe Fertigkeit liefert `invalid`
4. 3 Punkte in `precise_strike` erhöhen `accuracy` um genau 9
5. 2 Punkte in `heavy_hand` ergeben `meleeBonus` 0.08
6. `execution` wirkt nur unter 30 Prozent Leben des Ziels und nicht darüber
7. `useSkill` mit `breach` setzt die Abklingzeit und kostet genau eine Runde
8. `useSkill` während laufender Abklingzeit liefert `invalid` und kostet keine Runde
9. `sweep` trifft drei Gegner in Distanz 1 und keinen in Distanz 2
10. `addTempWall` auf einer besetzten Kachel gibt false zurück
11. Eine temporäre Wand blockiert Bewegung und Sichtlinie und verschwindet nach Ablauf
12. `halvern` wechselt nach 3 Runden Ansturm in die Flammenwand und nach 2 Runden zurück
13. `sporemother` nimmt halben Schaden, solange ein Sporenträger lebt, danach vollen
14. `sporemother` erzeugt nie mehr als sechs lebende Sporenträger
15. `rime` setzt unter 50 Prozent Leben genau vier temporäre Wände und keine auf besetzte
    Kacheln
16. `sorlax` wechselt bei 66 und 33 Prozent die Phase, und pro Runde höchstens einmal
17. Ein Bosskampf über 40 Runden ist nach Serialisieren und Deserialisieren mitten im Kampf
    identisch reproduzierbar
18. Fehlender `scriptId`-Eintrag führt zu einem `message`-Ereignis, nicht zu einem Absturz
19. Der Determinismustest aus Phase 2 ist weiterhin grün

Test 17 ist der wichtigste. Er ist der einzige, der Zustände in Modulvariablen zuverlässig
aufdeckt.

## Abschluss

`npm run typecheck` und `npm test` grün.
Commit mit `feat(core): skill trees, active skills, boss scripts`.
Danach anhalten.
