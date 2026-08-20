# PHASE 3.6 — Gegenstände, Affixe, Ausrüstung

Vorbedingung: Phase 3.5 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/SPEC.md` v1.2, `docs/INTERFACES.md` v1.2, `docs/RPG.md` Abschnitte
2 bis 4 und 9.

INTERFACES bleibt ein Vertrag. Ändere dort nichts, melde Lücken.

Fertigkeiten und Bossskripte gehören nicht in diese Phase. Sie kommen in 3.7.
Die zugehörigen Kommandos geben weiterhin `invalid` zurück.

---

## Umfang

Nur `src/core/`, `content/` und `tests/`. Keine UI, kein Renderer, kein Netz.
Das Inventar wird in dieser Phase ausschließlich über Funktionsaufrufe bedient.

## Block 1, Gegenstandsinstanzen

`src/core/items.ts`:
- `createInstance(state, baseId, itemLevel, rarity, affixes): ItemInstance`
  vergibt `uid` aus `state.nextItemUid` und erhöht diesen
- `addToInventory(state, item): boolean`, false bei vollem Inventar, Grenze 40
- `removeFromInventory(state, uid): ItemInstance | null`
- `findItem(state, uid): ItemInstance | null` sucht in Inventar und Ausrüstung

`uid` ist projektweit eindeutig und wird nie wiederverwendet, auch nicht nach dem Ablegen.

## Block 2, Affixe

`src/core/affixes.ts`:
- `eligibleAffixes(slot, itemLevel, forEnemy, content): AffixDef[]`
- `rollItem(rng, baseId, itemLevel, table, content, forEnemy): ItemInstance`

Regeln:
- Rarität wird aus `table.rarityWeights` gezogen
- normal 0 Affixe, magisch 1 bis 2, selten 3 bis 5, einzigartig feste Liste aus `uniques`
- höchstens 3 Präfixe und 3 Suffixe, jeder Affix höchstens einmal
- nur Affixe, deren `slots` den Steckplatz enthalten und deren `minItemLevel` erreicht ist
- bei `forEnemy` nur Affixe mit `appliesTo` gleich `'enemy'` oder `'both'`
- der Wert wird als `randInt(min, max)` gezogen
- bei einzigartigen Gegenständen wird der Grundtyp durch `UniqueDef.baseId` ersetzt

Determinismus: ausschließlich der übergebene `rng`. Kein eigener Generator, keine Zeit,
keine Iterationsreihenfolge von `Object.keys` als Zufallsquelle. Wo über Kataloge iteriert
wird, vorher nach `id` sortieren.

## Block 3, Startkatalog

`content/affixes.json` mit genau diesen Einträgen. Werte sind Startwerte.

| id | kind | stat | mode | min | max | tier | minItemLevel | slots | appliesTo |
|---|---|---|---|---|---|---|---|---|---|
| `pre_sturdy` | prefix | maxHealth | flat | 6 | 14 | 1 | 1 | suit, helmet, belt | both |
| `pre_plated` | prefix | armor | flat | 2 | 5 | 1 | 1 | suit, helmet, guard | both |
| `pre_honed` | prefix | accuracy | flat | 3 | 8 | 1 | 1 | gloves, weapon, gauge_left, gauge_right | both |
| `pre_brutal` | prefix | meleeBonus | percent | 4 | 9 | 2 | 8 | weapon, gloves | both |
| `pre_charged` | prefix | elemBonus | percent | 4 | 9 | 2 | 8 | weapon, amulet | both |
| `pre_reinforced` | prefix | armor | flat | 6 | 12 | 3 | 16 | suit, guard | both |
| `suf_of_vigor` | suffix | maxHealth | flat | 15 | 30 | 2 | 10 | suit, amulet, belt | both |
| `suf_of_evasion` | suffix | evasion | flat | 2 | 6 | 1 | 1 | boots, gauge_left, gauge_right | both |
| `suf_of_embers` | suffix | res_fire | flat | 8 | 20 | 1 | 1 | suit, guard, amulet | both |
| `suf_of_spores` | suffix | res_poison | flat | 8 | 20 | 1 | 1 | suit, guard, amulet | both |
| `suf_of_rime` | suffix | res_ice | flat | 8 | 20 | 1 | 1 | suit, guard, amulet | both |
| `suf_of_current` | suffix | res_shock | flat | 8 | 20 | 1 | 1 | suit, guard, amulet | both |
| `suf_of_precision` | suffix | critBonus | flat | 2 | 5 | 2 | 12 | gloves, weapon | both |
| `suf_of_the_lamp` | suffix | lightRadius | flat | 1 | 3 | 1 | 1 | helmet, amulet | player |
| `suf_of_haste` | suffix | freeActionChance | flat | 3 | 8 | 3 | 18 | boots | player |
| `suf_of_thrift` | suffix | ammoSaveChance | flat | 5 | 12 | 2 | 10 | belt, gloves | player |
| `suf_of_might` | suffix | strength | flat | 2 | 6 | 2 | 10 | gloves, amulet | player |
| `suf_of_focus` | suffix | focus | flat | 2 | 6 | 2 | 10 | helmet, amulet | player |

`critBonus`, `freeActionChance` und `ammoSaveChance` werden in Prozentpunkten gespeichert
und bei der Anwendung durch 100 geteilt. Das vermeidet Fließkommawerte in JSON.

`suf_of_the_lamp` wird bei Gegnern nicht gewürfelt. Falls doch ein Gegner ihn tragen
sollte, wirkt er auf `aggroRange` statt auf `lightRadius`.

Dazu `content/items.json` mit je zwei Grundtypen pro Steckplatz, einem einfachen und einem
schweren mit höheren Voraussetzungen, und `content/dropTables.json` mit zwei Tabellen:
`common_drop` nach RPG.md Abschnitt 4 und `boss_drop` mit 20 Prozent selten und 8 Prozent
einzigartig.

## Block 4, Ausrüstung anlegen

In `applyCommand`:
- `equip` prüft `reqLevel`, `reqStrength`, `reqAgility` gegen die aktuellen Werte des
  Spielers. Bei Verstoß `invalid` mit sprechendem `reason`
- ein bereits belegter Steckplatz wandert zurück ins Inventar, ist es voll, ist das
  Kommando ungültig
- `unequip` und `dropItem` analog, `dropItem` erzeugt einen `GroundItem` auf der Kachel
  des Spielers und ein `itemDropped`-Ereignis
- alle vier Kommandos kosten keine Runde

Beim Betreten einer Kachel mit `GroundItem` wird dieses aufgenommen, sofern Platz ist,
und ein `itemPickedUp`-Ereignis erzeugt. Ist das Inventar voll, bleibt der Gegenstand
liegen und es wird eine Meldung erzeugt.

Sinkt `maxHealth` durch das Ablegen unter die aktuelle `health`, wird `health` mitgesenkt.

## Block 5, Beiträge in getDerivedStats

Die in Phase 3.5 auf Null gesetzten Ausrüstungsbeiträge werden jetzt berechnet.

Reihenfolge:
1. Basis aus Attributen
2. flache Beiträge aus `baseModifiers` und Affixen aufsummieren
3. prozentuale Beiträge aufsummieren und danach als ein Faktor anwenden
4. Resistenzen: Gradstrafe aufschlagen, dann auf 75 deckeln
5. Attributsaffixe wie `suf_of_might` wirken auf die Attribute und damit auf Schritt 1

Schritt 5 bedeutet, dass die Berechnung in zwei Durchgängen läuft: erst Attributsaffixe
sammeln, dann die abgeleiteten Werte bilden. Kein Rekursionsproblem, weil Attributsaffixe
selbst nicht von abgeleiteten Werten abhängen.

Prozentuale Beiträge werden addiert, nicht multipliziert. Zwei Teile mit je 8 Prozent
ergeben 16 Prozent, nicht 16.64.

## Block 6, Ausgerüstete Gegner

`src/core/spawn.ts`:
`rollMapLoot(state, mapDef, content): void`

- läuft genau einmal beim ersten Betreten, setzt danach `MapRuntimeState.rolled`
- weist jedem Gegner einen `rank` zu: 90 Prozent `common`, 9 Prozent `equipped`,
  Bosse fest `boss`, Anteil steigt pro Schwierigkeitsgrad um 4 Prozentpunkte
- `forceRank` aus `MapEntityDef` hat Vorrang
- höchstens 60 ausgerüstete Gegner pro Sohle, danach fällt alles auf `common`
- `equipped` bekommt 1 bis 2 Teile, `boss` 2 bis 4 mit mindestens einem einzigartigen
- `itemLevel` ist `monsterLevel` des Gegners

Beim Tod eines Gegners fällt jedes getragene Teil zu 100 Prozent als `GroundItem` auf
seiner Kachel, zusätzlich zu den Einträgen aus `drops`.

Liegen mehrere Gegenstände auf einer Kachel, werden sie beim Betreten nacheinander
aufgenommen, bis das Inventar voll ist.

## Tests

1. `uid` ist eindeutig über 1000 erzeugte Gegenstände, auch nach Ablegen und Aufnehmen
2. `rollItem` liefert bei gleichem RNG-Zustand und gleichen Argumenten exakt dasselbe
   Ergebnis, zweimal hintereinander mit zurückgesetztem RNG geprüft
3. Ein Gegenstand mit `itemLevel` 1 erhält nie einen Affix mit `minItemLevel` 16
4. Ein Gegenstand hat nie zwei Affixe mit derselben `affixId`
5. Ein Gegenstand hat höchstens 3 Präfixe und höchstens 3 Suffixe
6. `forEnemy` schließt `suf_of_the_lamp` aus
7. `equip` mit zu niedriger Kraft liefert `invalid` und ändert nichts
8. Zwei Teile mit je 8 Prozent `meleeBonus` ergeben 0.16, nicht 0.1664
9. `suf_of_might` mit Wert 4 erhöht `strength` und dadurch `meleeBonus` messbar
10. Ablegen eines Teils mit `+30 maxHealth` bei voller Gesundheit senkt `health` mit
11. Resistenz aus zwei Teilen mit je 20 wird auf `normal` zu 40, auf `nightmare` zu minus 60
12. Ein Deckelungstest: fünf Teile mit je 20 Feuerresistenz ergeben 75, nicht 100
13. `rollMapLoot` läuft nur einmal, ein zweiter Aufruf ändert nichts
14. Bei 200 Gegnern auf einer Testkarte liegt die Zahl der `equipped` zwischen 40 und 80
15. Ein getöteter ausgerüsteter Gegner hinterlässt genau die Teile, die er trug
16. Serialisieren und Deserialisieren eines Standes mit vollem Inventar und Ausrüstung
    liefert einen strukturell identischen Zustand
17. Der Determinismustest aus Phase 2 ist weiterhin grün

## Abschluss

`npm run typecheck` und `npm test` grün.
Commit mit `feat(core): item instances, affixes, equipment, enemy loadouts`.
Danach anhalten. Phase 3.7 nicht beginnen.
