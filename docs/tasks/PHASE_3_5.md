# PHASE 3.5 — Umbau von core auf v1.2, Teil 1

Vorbedingung: Phase 3 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/SPEC.md` v1.2, `docs/INTERFACES.md` v1.2, `docs/RPG.md`.

SPEC und INTERFACES wurden auf v1.2 gehoben. Lies beide vollständig neu ein.
INTERFACES bleibt ein Vertrag. Ändere dort nichts, melde Lücken.

Das ist der größte Umbau im Projekt. Er ist bewusst in zwei Task-Files geteilt.
Diese Datei behandelt Typen, abgeleitete Werte, Schadensarten und Statuseffekte.
Ausrüstung, Affixe, Fertigkeiten und Bossskripte kommen in Phase 3.6, nicht hier.

---

## Umfang

Nur `src/core/` und `tests/`. Kein Renderer, keine UI, kein Netz.
`src/render/` darf ausschließlich dort angepasst werden, wo geänderte Typen es erzwingen.

Verbotene Aufrufe in `src/core/`: `Math.random`, `Date`, `document`, `window`, `fetch`,
`localStorage`, `console`.

## Reihenfolge

Arbeite in dieser Reihenfolge und committe nach jedem Block. Der Umbau bricht zwischendurch
alle Tests, das ist erwartet.

### Block 1, Typen

`src/core/types.ts` vollständig auf INTERFACES v1.2 Abschnitte 2 bis 9 bringen.
`PlayerState.stats` entfällt. Neue Typen ergänzen, auch die, die erst in Phase 3.6
implementiert werden. Typen ohne Implementierung sind in dieser Phase erlaubt und gewollt,
damit die Schnittstelle einmal steht.

Nach diesem Block läuft `npm run typecheck` nicht. Das ist in Ordnung.

### Block 2, abgeleitete Werte

`src/core/derived.ts`:
```ts
export function getDerivedStats(actor, content, difficulty): DerivedStats
```

Formeln aus RPG.md Abschnitt 2 für den Spieler, aus SPEC Abschnitt 8 für Gegner.
In dieser Phase ohne Ausrüstung und ohne Fertigkeiten, die Beiträge werden als Null
eingesetzt und in Phase 3.6 nachgezogen. Die Funktionssignatur ist final.

Wichtig: reine Funktion, keine Mutation. Ein einfacher Cache pro Runde liegt in `turn.ts`,
nicht in `derived.ts`.

Spielerresistenzen: Gradstrafe aus SPEC Abschnitt 8 aufschlagen, danach auf 75 deckeln.

### Block 3, Schadensarten

`src/core/combat.ts` auf die Reihenfolge aus SPEC 4.2 umstellen:
Wurf, Typbonus, Kritischer Treffer, Resistenz, Rüstung. Nicht umsortieren.

`resolveAttack` bekommt den `damageType` der Waffe und gibt ihn im `attack`-Ereignis mit
zurück. Flächenschaden nach SPEC 4.3.

### Block 4, Statuseffekte

`src/core/effects.ts`:
- `applyEffect(target, effectId, sourceType, magnitude, content): GameEvent[]`
- `tickEffects(state, content): GameEvent[]`

Regeln aus SPEC 4.5. Kein Stapeln, Dauer wird erneuert. Feste Abarbeitungsreihenfolge
`burn`, `toxin`, `drain`, `chill`, `jolt`. Kein Auslösen, wenn die Zielresistenz gegen das
Element 50 oder höher ist.

`burn` und `toxin` ignorieren Rüstung. `drain` senkt `maxHealth` über `getDerivedStats`,
nicht durch direkte Mutation. Sinkt `maxHealth` unter die aktuelle `health`, wird `health`
mitgesenkt.

`tickEffects` wird in `advanceRound` als Schritt 4 aufgerufen.

### Block 5, Gegnerlevel und Skalierung

`src/core/scaling.ts` mit den Formeln aus SPEC Abschnitt 8.
`monsterLevel` wird beim ersten Betreten der Sohle berechnet und in `Entity.monsterLevel`
festgeschrieben. Es ändert sich danach nicht mehr, auch nicht wenn der Spieler aufsteigt.

Begründung für die Festschreibung: Sonst würden Gegner mitten im Kampf stärker, sobald der
Spieler ein Level aufsteigt.

### Block 6, Kommandos und Runde

`applyCommand` um die neuen Kommandos erweitern, soweit sie ohne Ausrüstung und
Fertigkeiten umsetzbar sind: `spendAttribute`, `useConsumable`, `wait`.
`equip`, `unequip`, `dropItem`, `useSkill`, `spendSkillPoint` geben vorläufig
`{ type: 'invalid', reason: 'not implemented' }` zurück. Nicht weglassen, nicht raten.

`freeActionChance` in `advanceRound` nach SPEC 3.2 einbauen, Wert ist vorerst immer 0.

`grantXp` auf 60 Level umstellen. `content/progression.json` mit 60 Schwellen anlegen,
Kurve `xpThreshold(n) = round(80 * n^2.1)`, gerundet auf volle 10.

### Block 7, Migration

`CURRENT_SAVE_VERSION` erhöhen. `migrate` bekommt einen Schritt, der einen alten Stand mit
`stats` in Attribute umrechnet:
```
vitality = round((stats.maxHealth - 20) / 3)
agility  = round((stats.accuracy - 4) / 0.6)
strength = 10
focus    = 10
```
Bei unbekannter Version weiterhin Fehler werfen.

## Tests

Bestehende Tests aus Phase 2 anpassen, nicht löschen. Wo ein Test nur wegen geänderter
Typen bricht, wird der Test angepasst, nicht die Logik.

Neue Tests:

1. Startattribute von je 10 ergeben maxHealth 50, accuracy 10, evasion 5
2. `getDerivedStats` ist rein: zweimaliger Aufruf liefert gleiche Werte und mutiert nichts
3. Ein Angriff mit `fire` gegen ein Ziel mit 80 Resistenz richtet deutlich weniger Schaden
   an als gegen ein Ziel mit 0, und immer mindestens 1
4. Ein Angriff mit `fire` gegen ein Ziel mit minus 50 Resistenz richtet mehr Schaden an als
   gegen 0
5. Reihenfolge: bei Resistenz 50 und Rüstung 10 ergibt ein Wurf von 20 den Wert 5,
   nicht 8. Damit ist die Reihenfolge festgenagelt
6. Spielerresistenz wird auf 75 gedeckelt, auch bei höherem Beitrag
7. Auf `nightmare` liegt die Spielerresistenz ohne Ausrüstung bei minus 100
8. `burn` fügt über drei Runden dreimal Schaden zu und läuft dann ab, `effectExpired` wird
   genau einmal erzeugt
9. Erneutes Auslösen von `burn` setzt die Dauer zurück, stapelt aber nicht
10. Ein Ziel mit 60 Feuerresistenz erhält kein `burn`
11. `chill` beim Spieler führt dazu, dass ein Gegner mit speed 1.0 in einer Runde zweimal
    handelt
12. `monsterLevel` ändert sich nicht, wenn der Spieler nach dem Betreten der Sohle
    aufsteigt
13. Migration eines v1.1-Standes ergibt die erwarteten Attribute
14. Der Determinismustest aus Phase 2 ist weiterhin grün

## Abschluss

`npm run typecheck` und `npm test` grün.
Commit mit `feat(core): attributes, derived stats, damage types, status effects`.
Danach anhalten. Phase 3.6 nicht beginnen.
