# Scepter of Sorlax — RPG-System

Status: Entwurf zur Abnahme. Grundlage für SPEC und INTERFACES v1.2.
Klassenlos, alle Skillbäume stehen jedem Spieler offen.

Alle Zahlen sind gesetzte Startwerte, keine Messwerte.

---

## 1. Attribute

Vier Attribute, Startwert je 10, fünf Punkte pro Levelaufstieg frei verteilbar.
Maximum 300 pro Attribut. Kein Zurücksetzen, ausgenommen ein einmaliger Reset pro
Schwierigkeitsgrad über ein Questitem.

| Attribut | id | Wirkung |
|---|---|---|
| Kraft | `strength` | physischer Nahkampfschaden, Voraussetzung für schwere Ausrüstung |
| Geschick | `agility` | Genauigkeit und Ausweichen, Voraussetzung für Fernkampfwaffen |
| Konstitution | `vitality` | Lebenspunkte |
| Fokus | `focus` | Elementarschaden, kritische Trefferchance, Wirkung von Statuseffekten |

## 2. Abgeleitete Werte

Das ist die zentrale Änderung an `core`. Bisher ist `PlayerState.stats` die Wahrheit.
Künftig ist nur `health` gespeichert, alles andere wird berechnet.

```
maxHealth   = 20 + 3 * vitality           + flach(Ausruestung, Skills)
accuracy    = floor(4 + 0.6 * agility)    + flach(Ausruestung, Skills)
evasion     = floor(1 + 0.4 * agility)    + flach(Ausruestung, Skills)
armor       = 0                           + flach(Ausruestung, Skills)
meleeBonus  = 0.010 * (strength - 10)     + prozent(Ausruestung, Skills)
elemBonus   = 0.010 * (focus - 10)        + prozent(Ausruestung, Skills)
critBonus   = 0.002 * (focus - 10)        + flach(Ausruestung, Skills)
resistances = 0 je Typ                    + flach(Ausruestung, Skills) + Gradstrafe
lightRadius = 4                           + flach(Ausruestung, Skills)
```

Mit Startattributen von je 10 ergibt das maxHealth 50, accuracy 10, evasion 5.
Das entspricht exakt den bisherigen Startwerten aus SPEC 5.1, es ändert sich also
rückwirkend nichts.

Reihenfolge der Anwendung im Kampf, verbindlich:
```
roll        = randInt(dmgMin, dmgMax)
typBonus    = physisch und Nahkampf ? meleeBonus : (elementar ? elemBonus : 0)
raw         = round(roll * (1 + typBonus))
raw         = isCrit ? raw * 2 : raw
afterResist = max(1, floor(raw * (1 - resist / 100)))
final       = max(1, afterResist - floor(armor * 0.5))
```

`getDerivedStats(player, content)` ist eine reine Funktion ohne Seiteneffekte. Sie wird
pro Runde einmal berechnet und zwischengespeichert, nicht pro Angriff. Sonst wird sie zur
teuersten Funktion im Spiel.

Sinkt `maxHealth` durch Ablegen von Ausrüstung unter die aktuelle `health`, wird `health`
mitgesenkt. Steigt sie, bleibt `health` unverändert.

Maximales Spielerlevel: 60.

## 3. Ausrüstung

Zehn Steckplätze.

| id | Bezeichnung | typische Affixe |
|---|---|---|
| `suit` | Schutzanzug | Rüstung, Leben, Resistenzen |
| `helmet` | Helm | Rüstung, Sichtweite, Genauigkeit |
| `belt` | Gürtel | Tragkraft für Verbrauchsgüter, Leben |
| `boots` | Schuhe | Ausweichen, Chance auf freie Aktion |
| `gloves` | Handschuhe | Genauigkeit, kritische Trefferchance, Nachladen |
| `weapon` | Hauptwaffe | Schaden, Schadenstyp, Kritchance |
| `guard` | Zusatzschutz | Rüstung, Schadensreduktion, Resistenz |
| `amulet` | Amulett | Attribute, Skillpunkte, Elementarschaden |
| `gauge_left` | Messgerät links | gemischt |
| `gauge_right` | Messgerät rechts | gemischt |

Die beiden Messgeräte teilen sich einen Affixpool, dürfen aber nicht denselben
einzigartigen Gegenstand doppelt tragen.

Jeder Gegenstand hat Voraussetzungen: `reqLevel`, `reqStrength`, `reqAgility`.
Nicht erfüllte Voraussetzungen verhindern das Anlegen, nicht das Aufheben.

## 4. Gegenstände als Instanzen

`items: Record<string, number>` bleibt für Stapelware, also Munition und Verbrauchsgüter.
Ausrüstung wird zu Instanzen mit eigener Identität.

```ts
export type ItemInstance = {
  uid: number;              // fortlaufend, im GameState verwaltet
  baseId: string;           // verweist auf ItemDef
  slot: EquipSlot;
  rarity: 'normal' | 'magic' | 'rare' | 'unique';
  itemLevel: number;
  affixes: RolledAffix[];
  identified: boolean;
};

export type RolledAffix = {
  affixId: string;
  value: number;
};
```

Inventar: 40 Plätze, kein Rastersystem mit Größen. Ein Gegenstand belegt einen Platz.
Begründung: Rasterinventare kosten viel Bedienungsarbeit auf Touchgeräten und bringen
spielerisch wenig.

### Raritäten

| Rarität | Affixe | Grundchance beim Drop |
|---|---|---|
| normal | 0 | 62 Prozent |
| magisch | 1 bis 2 | 28 Prozent |
| selten | 3 bis 5 | 9 Prozent |
| einzigartig | fest definiert | 1 Prozent |

Bosse würfeln auf einer eigenen Tabelle mit 20 Prozent selten und 8 Prozent einzigartig.

### Affixe

Jeder Affix hat eine Stufe, die an `itemLevel` gebunden ist. Höhere Stufen erscheinen erst
tiefer im Schacht.

```ts
export type AffixDef = {
  id: string;
  kind: 'prefix' | 'suffix';
  stat: string;              // z.B. 'maxHealth', 'armor', 'res_fire'
  mode: 'flat' | 'percent';
  min: number;
  max: number;
  tier: number;              // 1 bis 6
  minItemLevel: number;
  slots: EquipSlot[];
};
```

Ein Gegenstand trägt höchstens drei Präfixe und drei Suffixe, jeden Affix nur einmal.

Beispielaffixe, gekürzt:
`+X Leben`, `+X Rüstung`, `+X Genauigkeit`, `+X Ausweichen`, `+X Prozent Feuerresistenz`,
`+X Prozent Schaden`, `+X Kraft`, `+X Fokus`, `+X Skillpunkte auf einen Baum`,
`+X Sichtweite`, `X Prozent Chance auf eine freie Aktion`, `X Prozent weniger
Munitionsverbrauch`.

`+X Sichtweite` wirkt direkt auf `playerLight` aus SPEC Abschnitt 7 und ist im Dunkeln
spürbarer als jeder Schadensaffix. Das ist beabsichtigt.

### Erzeugung

`rollItem(rng, baseId, itemLevel, dropTable): ItemInstance` ist deterministisch und nutzt
ausschließlich den Seeded RNG aus `core`. Damit liefert derselbe Spielstand nach dem Laden
dieselben Drops.

Nicht identifizierte Gegenstände zeigen nur Grundwerte. Identifiziert wird über das
Verbrauchsgut `scanner_charge` oder ab Fertigkeitsstufe 3 in `field_analysis`.

## 5. Skilltree

Drei Bäume, klassenlos, alle offen. Ein Skillpunkt pro Level, Maximum 5 Punkte pro
Fertigkeit. Voraussetzung für eine Stufe ist die Summe der Punkte im selben Baum.

| Baum | id | Ausrichtung |
|---|---|---|
| Gerät und Gewalt | `tree_gear` | Waffen, physischer Schaden, Präzision |
| Reaktion | `tree_reaction` | Elementarschaden, Statuseffekte |
| Beharrlichkeit | `tree_endure` | Leben, Rüstung, Resistenzen, Bergung |

In dieser Ausbaustufe wird nur `tree_gear` vollständig umgesetzt. Die beiden anderen
existieren als Datenstruktur mit gesperrten Einträgen und einem Hinweis in der
Oberfläche. Grund: Ein Skilltree lässt sich erst sinnvoll entwerfen, wenn feststeht, wie
sich der Kampf anfühlt.

### tree_gear

**Stufe 1, ab Spielerlevel 1**

`precise_strike` Zielschlag, passiv
Genauigkeit plus 3 pro Punkt.

`heavy_hand` Schwere Hand, passiv
Physischer Schaden plus 4 Prozent pro Punkt.

**Stufe 2, ab Spielerlevel 6, mindestens 2 Punkte in Stufe 1**

`breach` Durchbruch, aktiv, Abklingzeit 4 Runden
Ein Angriff, der 40 Prozent plus 8 Prozent pro Punkt der gegnerischen Rüstung ignoriert.

`steady_aim` Ruhige Hand, passiv
Kritische Trefferchance plus 2 Prozentpunkte pro Punkt.

**Stufe 3, ab Spielerlevel 12, mindestens 5 Punkte in Stufe 2**

`sweep` Rundschlag, aktiv, Abklingzeit 6 Runden
Trifft alle Gegner in Distanz 1 mit 70 Prozent plus 6 Prozent pro Punkt des Waffenschadens.

`execution` Abbruch, passiv
Plus 20 Prozent plus 5 Prozent pro Punkt Schaden gegen Gegner unter 30 Prozent Leben.

Aktive Fertigkeiten brauchen ein neues Kommando und eine Abklingzeitverwaltung im
Spielzustand. Sie kosten eine Runde wie ein normaler Angriff.

## 6. Schwierigkeitsgrade

Drei Grade nacheinander, jeder wird durch das Besiegen von Sorlax im vorherigen
freigeschaltet. Der Spielstand behält Level, Attribute, Fertigkeiten und Ausrüstung.

| Grad | id | Stufenversatz | Resistenzstrafe Spieler | Gegner-HP | Gegner-Schaden | XP | Gegnerresistenz |
|---|---|---|---|---|---|---|---|
| Normal | `normal` | 0 | 0 | x1.0 | x1.0 | x1.0 | +0 |
| Schwer | `hard` | plus 18 | minus 40 | x1.9 | x1.6 | x2.0 | +25 |
| Alptraum | `nightmare` | plus 36 | minus 100 | x3.2 | x2.4 | x3.0 | +50 |

Die Resistenzstrafe wird auf die Spielerresistenzen aufgeschlagen und kann sie negativ
machen. Resistenzausrüstung wird damit ab dem zweiten Grad zur Pflicht, nicht zur Zierde.
Obergrenze der Spielerresistenz: 75 Prozent.

Höhere Grade schalten zusätzlich Affixstufen 5 und 6 frei.

## 7. Gegnerlevel

```
sohleBasis(sohle, grad) = round(sohle * 1.6) + gradVersatz
monsterLevel            = clamp(sohleBasis, sohleBasis + 6, spielerLevel)
```

Der Gegner wächst also mit dem Spieler, aber höchstens sechs Stufen über die Basis der
Sohle hinaus. Wer weit überlevelt zurückkehrt, merkt es. Wer unterlevelt vorstößt, findet
die Sohle nie leichter als vorgesehen.

Die Stufenskalierung aus BESTIARY Abschnitt 3 wird von `tier` auf `monsterLevel` umgestellt:

```
faktor     = 1 + 0.045 * (monsterLevel - 1)
health     = round(baseHealth * faktor * gradFaktorHP)
dmgMin/Max = round(base * (1 + 0.030 * (monsterLevel - 1)) * gradFaktorDmg)
armor      = baseArmor    + floor(monsterLevel / 6)
accuracy   = baseAccuracy + floor(monsterLevel * 0.8)
evasion    = baseEvasion  + floor(monsterLevel / 3)
xpReward   = round(baseXp * (1 + 0.10 * (monsterLevel - 1)) * gradFaktorXP)
```

Das ersetzt die vierstufige Tier-Tabelle. Die Elementmodifikatoren aus BESTIARY
Abschnitt 3 bleiben unverändert.

## 8. Was in INTERFACES v1.2 aufgeht

Diese Punkte brechen den bisherigen Vertrag und werden dort nachgezogen:

- `PlayerState.stats` entfällt, ersetzt durch `attributes`, `health`, `equipment`,
  `inventory`, `skills`, `cooldowns`
- neue Typen `DamageType`, `EquipSlot`, `ItemInstance`, `RolledAffix`, `AffixDef`,
  `SkillDef`, `DerivedStats`, `Difficulty`
- `WeaponDef` bekommt `damageType`
- `EnemyDef` bekommt `resistances` und `archetype`
- `behavior` wird um `'scripted'` erweitert, dazu `scriptId`
- `Command` bekommt `{ type: 'useSkill'; skillId: string; targetId?: EntityId }` und
  `{ type: 'equip'; uid: number }` sowie `{ type: 'unequip'; slot: EquipSlot }`
- `GameEvent` bekommt `effectApplied`, `effectExpired`, `itemDropped`, `skillUsed`
- `GameState` bekommt `difficulty`, `nextItemUid`, `unlockedDifficulties`
- `ContentDb` bekommt `affixes`, `skills`, `uniques`, `dropTables`

## 9. Was mir daran nicht gefällt

**Der Grafikbedarf explodiert.** Zehn Steckplätze mal vier Raritäten mal mehrere
Grundtypen ergibt schnell dreistellige Symbolzahlen. Mein Vorschlag: ein Symbol pro
Grundtyp, die Rarität wird über einen farbigen Rahmen und die Namensfarbe gezeigt, nicht
über eine eigene Zeichnung. Das ist auch in Diablo 2 so gelöst.

**Der Spielstand wird groß.** Vierzig Inventarplätze mit je bis zu sechs Affixen plus
Truhe plus Ausrüstung ergeben schnell mehrere hundert Kilobyte JSON. Für die Übertragung
an den PHP-Endpunkt heißt das: Größenlimit im Backend, Kompression im Client, und eine
harte Obergrenze für die Inventargröße. Das gehört in BACKEND.md.

**Aktive Fertigkeiten kosten jeweils Renderer-Arbeit.** `sweep` braucht eine eigene
Animation, sonst sieht ein Rundschlag aus wie ein normaler Schlag. Bei sechs Fertigkeiten
pro Baum und drei Bäumen wird das der größte Einzelposten im Projekt.

**Die Zahlen in Abschnitt 7 sind geraten.** Faktor 0.045 pro Stufe bedeutet, dass ein
Gegner auf Stufe 40 rund das Dreifache an Leben hat. Ob das zum Waffen- und
Ausrüstungsfortschritt passt, weiß niemand, bevor es einmal gespielt wurde. Rechne damit,
dass genau diese Zeile mehrfach geändert wird.
