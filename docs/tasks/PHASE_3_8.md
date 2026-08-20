# PHASE 3.8 — Waffenplatz vereinheitlichen und Inhalte abgleichen

Vorbedingung: Phase 3.7 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/INTERFACES.md` v1.3, `docs/BESTIARY.md` v3, `docs/SPEC.md` v1.2.

**Prüfe zuerst, ob alle drei Dateien vorhanden sind.** Fehlt eine, brich sofort ab und
melde welche. Erfinde unter keinen Umständen Werte, die dort stehen sollten. In Phase 3.7
fehlte `docs/BESTIARY.md`, und die Bosswerte wurden geraten. Genau das korrigiert Block 1.

INTERFACES bleibt ein Vertrag. Ändere dort nichts, melde Lücken.

---

## Block 1, Bosswerte abgleichen

`content/enemies.json` enthält vier Bosseinträge aus Phase 3.7, deren Zahlen ohne
Vorlage entstanden sind.

Gleiche sie gegen BESTIARY v3 Abschnitt 6 ab: `baseHealth`, `baseArmor`, `baseAccuracy`,
`baseEvasion`, `speed`, `baseXp`, `resistances`, `dropTableId`, `scriptId`.
Das Bestiarium gewinnt bei jeder Abweichung.

Melde am Ende, welche Werte abwichen. Das ist keine Formalie, sondern die Prüfung, wie weit
frei erfundene Zahlen vom Entwurf entfernt lagen.

Prüfe außerdem, ob das implementierte Bossverhalten aus Phase 3.7 zu den Beschreibungen in
BESTIARY Abschnitt 6 passt. Bei Widerspruch gilt `docs/tasks/PHASE_3_7.md` Block 7, weil
dort die verbindliche Detailfassung steht.

## Block 2, Ausrüstungs-Ids abgleichen

`content/items.json` aus Phase 3.6 nutzt selbst gewählte Ids.
Benenne sie auf die verbindliche Liste in BESTIARY v3 Abschnitt 8 um, einschließlich der
Voraussetzungen und `baseModifiers` aus der Tabelle darunter.

Alle Verweise mitziehen, auch in Tests und Fixtures. Keine Aliase, keine Kompatibilitäts-
schicht. Nach diesem Block darf keine alte Id mehr im Repo vorkommen, geprüft per Suche.

## Block 3, Waffenplatz vereinheitlichen

INTERFACES ist auf v1.3, `PlayerState.equippedWeaponId` entfällt.

1. Feld aus `PlayerState` entfernen.
2. `content/items.json` um zehn Einträge mit `type: 'weapon'`, `slot: 'weapon'` und
   `weaponId` auf die Waffen aus BESTIARY Abschnitt 7 erweitern. Ids nach dem Muster
   `item_w_pistol`, damit `ItemDef` und `WeaponDef` unterscheidbar bleiben.
   Voraussetzungen: Nahkampf `reqStrength` 12, Fernkampf `reqAgility` 14, Bosswaffen
   zusätzlich `reqLevel` gleich der Sohle des Bosses.
3. `equippedWeapon(state, content): WeaponDef | null` in `src/core/items.ts` anlegen.
   Leerer Platz bedeutet unbewaffneter Angriff mit dmg 1 bis 3, crit 0, Reichweite 1,
   `physical`.
4. Alle Stellen, die bisher `equippedWeaponId` lasen, auf diese Funktion umstellen.
   Betroffen sind mindestens `commands.ts`, `combat.ts` und die Fertigkeiten aus
   `src/core/skills/`.
5. `switchWeapon` bekommt eine neue Bedeutung: Es sucht in `inventory` die erste
   `ItemInstance` mit passendem `weaponId` und legt sie in den Platz `weapon`. Ist keine
   vorhanden, `invalid`. Das Kommando kostet weiterhin keine Runde.
6. `weapons: string[]` bleibt und führt die gefundenen Grundtypen für die Waffenleiste.
   Es wird beim Aufnehmen einer Waffe ergänzt, nie entfernt.
7. Affixe auf Waffen: `pre_honed`, `pre_brutal`, `pre_charged` und `suf_of_precision`
   haben `weapon` bereits in ihren `slots` und wirken damit ohne weitere Änderung.
8. Startausrüstung: Der Spieler beginnt mit einer `ItemInstance` von `item_w_prybar`,
   Rarität normal, ohne Affixe, im Platz `weapon`.

## Block 4, Migration

`CURRENT_SAVE_VERSION` erhöhen. Migrationsschritt: Ein alter Stand mit
`equippedWeaponId` erzeugt eine normale `ItemInstance` dieser Waffe im Platz `weapon` und
entfernt das Feld. Ist es leer oder unbekannt, wird `item_w_prybar` eingesetzt.

## Tests

1. Alle Bosswerte in `content/enemies.json` entsprechen BESTIARY Abschnitt 6. Der Test
   liest beide Quellen nicht, sondern prüft die Werte gegen fest hinterlegte Erwartungen
   aus dem Bestiarium
2. Keine der alten Ausrüstungs-Ids kommt im Repo noch vor
3. `equippedWeapon` liefert bei leerem Platz null, und ein Angriff funktioniert trotzdem
   mit den unbewaffneten Werten
4. `switchWeapon` auf eine nicht besessene Waffe liefert `invalid`
5. `switchWeapon` legt die Waffe in den Platz und die vorherige zurück ins Inventar
6. Eine Waffe mit `pre_brutal` 8 Prozent erhöht den physischen Nahkampfschaden messbar
7. Migration eines Standes mit `equippedWeaponId` ergibt die passende Instanz im Platz
8. Ein neuer Spielstand startet mit der Brechstange im Waffenplatz
9. Der Determinismustest aus Phase 2 ist weiterhin grün
10. Serialisieren und Deserialisieren mit voller Ausrüstung bleibt strukturgleich

## Abschluss

`npm run typecheck` und `npm test` grün.
Commit mit `refactor(core): single weapon slot + content reconciliation`.

Melde abschließend in Stichpunkten:
- welche Bosswerte von BESTIARY abwichen und wie stark
- welche Ausrüstungs-Ids umbenannt wurden
- ob beim Bossverhalten Widersprüche zum Bestiarium auffielen

Danach anhalten. Phase 4 nicht beginnen.
