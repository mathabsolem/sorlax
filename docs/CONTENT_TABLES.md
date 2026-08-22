# Scepter of Sorlax — CONTENT_TABLES

Status: verbindlich. Anhang zu BESTIARY v3.
Schließt die vier Lücken aus der Rückmeldung nach Phase 4.5.

Alle Zahlen sind gesetzte Startwerte, keine Messwerte.

---

## 1. Verbrauchsgüter

Acht Stapelgüter, auf die BESTIARY Abschnitt 9 verweist, ohne sie zu definieren.

| id | Name | type | amount | Wirkung |
|---|---|---|---|---|
| `heal_small` | Notverband | heal | 1 | stellt 25 Lebenspunkte her |
| `heal_large` | Trauma-Kit | heal | 1 | stellt 60 Lebenspunkte her |
| `antitoxin` | Antitoxin | powerup | 1 | entfernt `toxin`, stellt 10 Leben her |
| `armor_plate` | Panzerplatte | powerup | 1 | Effekt `plating`, 20 Runden, Rüstung plus 10 |
| `ammo_pistol` | 9-mm-Magazin | ammo | 8 | Munition `pistol` |
| `ammo_rivet` | Bolzenstreifen | ammo | 6 | Munition `rivet` |
| `ammo_shell` | Setzpatronen | ammo | 4 | Munition `shell` |
| `ammo_charge` | Vortriebsladung | ammo | 2 | Munition `charge` |
| `scanner_charge` | Prüfzelle | powerup | 1 | identifiziert einen Gegenstand |

`amount` ist die Menge pro Aufnahme, sofern die Drop-Tabelle nichts anderes vorgibt.

### Positive Effekte

Bisher kennt SPEC 4.5 nur schädliche Effekte. Diese beiden kommen dazu und werden von
`getDerivedStats` gelesen, nicht von `tickEffects` abgearbeitet:

| id | Feld in DerivedStats | mode | Dauer aus |
|---|---|---|---|
| `plating` | armor | flat | ItemDef |

### Effekte entfernen

`antitoxin` braucht die Möglichkeit, einen Effekt zu löschen. Dafür gilt:
`ItemDef.effect.id` mit dem Präfix `cure_` entfernt den Effekt, dessen Id nach dem Präfix
steht. `cure_toxin` entfernt `toxin`. `turns` und `magnitude` sind dabei 0.

Für die Elementmunition der Bosswaffen gilt dieselbe Systematik. Die vier Sorten
`fuel`, `toxin_canister`, `coolant`, `cell` und `essence` bekommen je einen Eintrag:

| id | Name | type | amount | Munition |
|---|---|---|---|---|
| `ammo_fuel` | Brennstoffpatrone | ammo | 6 | `fuel` |
| `ammo_toxin_canister` | Toxinkanister | ammo | 5 | `toxin_canister` |
| `ammo_coolant` | Kühlmittelzelle | ammo | 4 | `coolant` |
| `ammo_cell` | Induktionszelle | ammo | 6 | `cell` |
| `ammo_essence` | Essenzsplitter | ammo | 3 | `essence` |

## 2. Einzigartige Gegenstände

Acht Einträge im Format `UniqueDef`. Affixwerte sind fest, nicht gewürfelt.
`minItemLevel` entspricht der `sohleBasis` des zugehörigen Fundorts.

| id | baseId | Name | minItemLevel | Affixe |
|---|---|---|---|---|
| `uq_halvern_visier` | `helmet_visor` | Halverns Brandvisier | 6 | `suf_of_embers` 35, `pre_plated` 5, `suf_of_the_lamp` 2 |
| `uq_sporenlunge` | `suit_overall` | Sporenlunge | 13 | `suf_of_spores` 35, `suf_of_vigor` 28, `pre_plated` 4 |
| `uq_frostkern` | `guard_deflector` | Frostkern | 19 | `suf_of_rime` 35, `pre_reinforced` 11, `suf_of_embers` 15 |
| `uq_sorlax_auge` | `amulet_sigil` | Das Auge von Sorlax | 26 | `suf_of_focus` 6, `pre_charged` 9, `suf_of_vigor` 30 |
| `uq_stollenschritt` | `boots_rubber` | Stollenschritt | 8 | `suf_of_evasion` 6, `suf_of_haste` 7 |
| `uq_greifer` | `gloves_grip` | Der Greifer | 10 | `pre_honed` 8, `suf_of_precision` 5 |
| `uq_pruefblei` | `gauge_pressure` | Prüfblei | 14 | `suf_of_might` 6, `pre_plated` 5 |
| `uq_wetterglas` | `gauge_seismic` | Wetterglas | 20 | `suf_of_focus` 6, `pre_honed` 7 |

Die ersten vier fallen ausschließlich beim jeweiligen Boss und sind dort garantiert. Damit
ist die Bedingung aus RPG.md Abschnitt 9 erfüllt, ohne dass ein Wurf danebengehen kann.
Die übrigen vier liegen im normalen Wurf von `boss_drop` und `common_drop`.

## 3. Bossfelder, ratifiziert

Die vier Felder, die BESTIARY Abschnitt 6 offen ließ. Die Umsetzung hat sie sinnvoll
abgeleitet, ich übernehme sie mit einer Korrektur.

| Boss | weaponId | aggroRange | preferredRange | spriteWidth |
|---|---|---|---|---|
| `boss_halvern` | `nw_slam_fire` | 12 | 1 | 1.3 |
| `boss_sporemother` | `nw_sporeburst` | 20 | 3 | 2.0 |
| `boss_rime` | `nw_boltpistol_ice` | 16 | 6 | 1.4 |
| `boss_sorlax` | `nw_slam_void` | 20 | 1 | 1.6 |

Korrektur gegenüber der Umsetzung: `boss_sporemother` bekommt `aggroRange` 20 statt eines
kleineren Werts, weil sie unbeweglich ist und ihre Sporenwolke den Spieler ohnehin über die
ganze Halle erreicht. Ein kleiner Aggroradius würde nur dazu führen, dass sie am Anfang
des Kampfes untätig bleibt.

Die Entscheidung, `boss_rime` nicht mit dem Frostbohrer auszustatten, war richtig. Eine
Waffe mit Reichweite 4 passt nicht zu einem Gegner, der Distanz 5 bis 7 hält. Der Fehler
lag in meiner Vorlage, nicht in der Umsetzung.

## 4. Korrekturen an bestehenden Dokumenten

**PHASE_3_6 Test 14 ist falsch.** Verbindlich sind 9 Prozent aus RPG.md Abschnitt 9. Bei
200 Gegnern ist der Erwartungswert 18. Der Test prüft künftig einen Bereich von 8 bis 32,
weil ein enger Bereich bei einem Zufallswurf gelegentlich grundlos fehlschlägt.

**SPEC Abschnitt 12, Tastenbelegung.** Ergänzt werden C für den Charakterbogen und L für
das vollständige Protokoll.

**PHASE_4 Block 3 und Block 5 widersprachen sich.** Der zweite Eingriff in `core` über
`src/core/knowledge.ts` war die richtige Auflösung und gilt rückwirkend als beauftragt.

**PHASE_4_5 Umfang.** Die Verdrahtung in `src/app/main.ts` gehörte selbstverständlich dazu.
Die Umfangsangabe war zu eng formuliert.

## 5. Was noch fehlt

`content/enemies.json` führt drei Varianten plus vier Bosse. Der Sohlenplan braucht 28.
Der Generator dafür ist Gegenstand von Phase 5, nicht von Phase 7. Die Nummerierung in
BESTIARY Abschnitt 10 ist überholt.
