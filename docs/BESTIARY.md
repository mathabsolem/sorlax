# Scepter of Sorlax — Bestiarium v3

Status: Entwurf zur Abnahme. Ersetzt v2 vollständig.
Grundlage: SPEC v1.2, INTERFACES v1.2.1, RPG.md.

Änderungen gegenüber v2: Tier-Tabelle entfällt zugunsten von `monsterLevel`, Ids ohne
`_t`-Suffix, Resistenzen als ausformulierte Objekte, Ausrüstungs-Grundtypen ergänzt,
Bosse mit `scriptId`, Drop-Tabellen für getragene Ausrüstung.

Alle Zahlen sind gesetzte Startwerte, keine Messwerte.

---

## 0. Ein Widerspruch, den ich klären muss

`PlayerState` hat drei Dinge, die dieselbe Frage beantworten: `weapons: string[]`,
`equippedWeaponId: string` und den Ausrüstungsplatz `weapon` mit einer `ItemInstance`.
Das ist mein Fehler aus INTERFACES v1.2. Zwei Quellen für dieselbe Wahrheit führen
zwangsläufig zu Abweichungen.

Vorschlag zur Auflösung, umzusetzen als v1.3:
- der Ausrüstungsplatz `weapon` ist die Wahrheit, er hält eine `ItemInstance`, deren
  `baseId` auf einen `WeaponDef` verweist
- `equippedWeaponId` entfällt, die Waffe wird über `equipment.weapon.baseId` gelesen
- `weapons: string[]` bleibt als Liste gefundener Grundtypen für die Waffenleiste

Damit tragen auch Waffen Affixe, was für ein Diablo-artiges System ohnehin erwartet wird.
Solange das nicht entschieden ist, bleiben die Waffen unten reine `WeaponDef`-Einträge.

Zweiter Punkt: In Phase 3.6 hat Claude Code bereits `content/items.json` mit selbst
gewählten Namen für Ausrüstungs-Grundtypen angelegt. Abschnitt 8 dieser Datei legt die
verbindlichen Ids fest. Wenn die vorhandenen abweichen, werden sie in einem Durchgang
umbenannt, bevor Inhalte darauf aufbauen.

## 1. Elemente

| Typ | Farbe | Effekt | Wirkung |
|---|---|---|---|
| `physical` | grau | keiner | — |
| `fire` | rot | `burn` | 4 Schaden pro Runde, 3 Runden, ignoriert Rüstung |
| `poison` | grün | `toxin` | 2 Schaden pro Runde, 6 Runden, ignoriert Rüstung |
| `ice` | blau | `chill` | 4 Runden, Gegner erhalten doppelte Aktionspunkte |
| `shock` | gelb | `jolt` | 3 Runden, Genauigkeit minus 8 |
| `void` | violett | `drain` | 5 Runden, maxHealth minus 15 Prozent, Rüstung minus 3 |

Gegenpaare: `fire` gegen `ice`, `poison` gegen `shock`. `void` steht allein.

## 2. Resistenzprofile

Ausformuliert, damit das Content-Skript nichts ableiten muss.

```
physical: { physical: 0,  fire: 0,   poison: 0,   ice: 0,   shock: 0,   void: 0 }
fire:     { physical: 0,  fire: 80,  poison: 0,   ice: -50, shock: 0,   void: 0 }
poison:   { physical: 0,  fire: 0,   poison: 80,  ice: 0,   shock: -50, void: 0 }
ice:      { physical: 0,  fire: -50, poison: 0,   ice: 80,  shock: 0,   void: 0 }
shock:    { physical: 0,  fire: 0,   poison: -50, ice: 0,   shock: 80,  void: 0 }
void:     { physical: 40, fire: 0,   poison: 0,   ice: 0,   shock: 0,   void: 80 }
```

Auf `hard` werden 25, auf `nightmare` 50 auf alle Werte aufgeschlagen, nach SPEC
Abschnitt 8. Die Obergrenze von 90 aus INTERFACES gilt.

Ein Statuseffekt wird nicht ausgelöst, wenn die Zielresistenz gegen sein Element 50 oder
höher ist.

## 3. Skalierung

Die Tier-Tabelle aus v2 entfällt ersatzlos. Es gilt ausschließlich die
`monsterLevel`-Formel aus SPEC Abschnitt 8.

Elementmodifikator auf die Basiswerte, vor der Skalierung angewendet:

| Element | health | accuracy | evasion |
|---|---|---|---|
| physical | x1.00 | +0 | +0 |
| fire | x0.90 | +1 | +1 |
| poison | x1.15 | +0 | -1 |
| ice | x1.10 | -1 | -1 |
| shock | x0.85 | +3 | +2 |
| void | x1.25 | +2 | +0 |

Id-Schema: `<archetyp>_<element>`, zum Beispiel `rat_fire` oder `warden_physical`.
Kein Stufensuffix mehr.

## 4. Archetypen

Neun Grundformen. Jede ist eine eigene Zeichnung, Varianten sind Farbumsetzungen derselben
Frames.

| archetype | Name | behavior | baseHealth | baseArmor | baseAcc | baseEva | speed | aggro | pref | baseXp | Breite |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `rat` | Grubenratte | charger | 12 | 0 | 8 | 10 | 2.0 | 6 | — | 8 | 0.5 |
| `crawler` | Deckenkriecher | charger | 18 | 0 | 11 | 14 | 2.0 | 7 | — | 14 | 0.6 |
| `miner` | Verschütteter | melee | 26 | 1 | 10 | 4 | 1.0 | 8 | — | 15 | 0.8 |
| `drone` | Schürfdrohne SK-3 | turret | 20 | 3 | 14 | 0 | 1.0 | 8 | 5 | 18 | 0.6 |
| `spore` | Sporenträger | ranged | 32 | 2 | 11 | 3 | 1.0 | 9 | 4 | 30 | 0.9 |
| `chainrunner` | Kettenläufer | charger | 44 | 2 | 12 | 6 | 1.0 | 8 | — | 40 | 1.0 |
| `cultist` | Tiefenkultist | ranged | 30 | 1 | 15 | 7 | 1.0 | 12 | 6 | 35 | 0.8 |
| `hauler` | Lastenläufer | melee | 55 | 4 | 11 | 1 | 1.0 | 7 | — | 55 | 1.1 |
| `warden` | Grabungswächter | melee | 95 | 7 | 13 | 0 | 0.5 | 7 | — | 90 | 1.4 |

**Grubenratte** Aufgedunsenes Nagetier von Hundegröße, halb verwest, schnell und dumm.
**Deckenkriecher** Vielbeinig, hängt an der Decke, lässt sich fallen. Schwer zu treffen.
**Verschütteter** Bergmann in zerrissener Schutzkleidung, Helmlampe noch an.
**Schürfdrohne SK-3** Wartungsdrohne an der Decke, Zielerfassung defekt, Schneidlaser intakt.
**Sporenträger** Aufgeplatzter Torso, aus dem Brustkorb wächst ein Pilzkörper.
**Kettenläufer** Vierbeinig, aus Fördergerät und Gewebe verwachsen, schleift Ketten hinter sich.
**Tiefenkultist** Ehemaliger Vermessungstrupp, Kutten aus Förderband, Atemmasken.
**Lastenläufer** Exoskelett eines Transportarbeiters, der Träger darin ist längst tot.
**Grabungswächter** Drei Meter, Panzerung aus verschmolzenem Gestein und Stahlträgern.

Frames je Archetyp: `<archetype>_idle_0` bis `_3`, `_attack_0` bis `_2`, `_pain_0`,
`_death_0` bis `_3`. Varianten nutzen dieselben Dateinamen mit Farbfilter zur Ladezeit,
es entstehen keine zusätzlichen Dateien.

## 5. Gegnerwaffen

Basiswerte vor Skalierung.

| id | Träger | dmgMin | dmgMax | crit | optimal | max | damageType |
|---|---|---|---|---|---|---|---|
| `nw_bite` | rat | 2 | 5 | 0.05 | 1 | 1 | physical |
| `nw_claw` | crawler | 3 | 7 | 0.12 | 1 | 1 | physical |
| `nw_pickaxe` | miner | 4 | 9 | 0.08 | 1 | 1 | physical |
| `nw_cutter` | drone | 5 | 8 | 0.05 | 5 | 7 | physical |
| `nw_sporeburst` | spore | 6 | 11 | 0.05 | 4 | 7 | poison |
| `nw_chainlash` | chainrunner | 7 | 13 | 0.10 | 1 | 1 | physical |
| `nw_boltpistol` | cultist | 6 | 10 | 0.10 | 6 | 10 | physical |
| `nw_crush` | hauler | 9 | 16 | 0.05 | 1 | 1 | physical |
| `nw_slam` | warden | 14 | 22 | 0.05 | 1 | 1 | physical |

Bei einer Elementvariante wird die Waffe geklont und ihr `damageType` sowie
`appliesEffect` auf das Element gesetzt. Id-Schema `<waffe>_<element>`, etwa
`nw_pickaxe_fire`. Die physische Grundform des Sporenträgers bleibt `poison`.

## 6. Bosse

| id | scriptId | Sohle | HP | armor | acc | eva | speed | baseXp | dropTableId |
|---|---|---|---|---|---|---|---|---|---|
| `boss_halvern` | `halvern` | 4 | 180 | 4 | 16 | 3 | 1.0 | 400 | `boss_drop` |
| `boss_sporemother` | `sporemother` | 8 | 260 | 3 | 14 | 0 | 1.0 | 900 | `boss_drop` |
| `boss_rime` | `rime` | 12 | 300 | 6 | 18 | 8 | 1.0 | 1600 | `boss_drop` |
| `boss_sorlax` | `sorlax` | 16 | 420 | 10 | 20 | 5 | 1.0 | 5000 | `boss_drop` |

Resistenzen:
```
boss_halvern:     { physical: 0,  fire: 90,  poison: 0,  ice: -60, shock: 0,   void: 0  }
boss_sporemother: { physical: 25, fire: 0,   poison: 90, ice: 0,   shock: -60, void: 0  }
boss_rime:        { physical: 20, fire: -60, poison: 0,  ice: 90,  shock: 0,   void: 0  }
boss_sorlax:      { physical: 40, fire: 25,  poison: 25, ice: 25,  shock: 25,  void: 90 }
```

**Steiger Halvern**, Sohle 4. Ehemaliger Schichtleiter, mit seinem Schweißbrenner
verwachsen, die Gasflasche im Rücken. Ansturm und Flammenwand im Wechsel.
Belohnung: **Brennlanze** `w_lance`.

**Mutter der Sporen**, Sohle 8. Unbeweglicher Pilzkörper, der einen ganzen
Stollenabschnitt ausfüllt. Sporenwolken und nachwachsende Träger.
Belohnung: **Toxinsprüher** `w_sprayer`.

**Der Erkaltete**, Sohle 12. Was vom ersten Vermessungstrupp übrig ist, in einer Eisschicht,
die von innen wächst. Hält Abstand, friert Fluchtwege zu.
Belohnung: **Frostbohrer** `w_drill`.

**Sorlax, der Angeschnittene**, Sohle 16. Gliedmaßen um einen schwebenden Kern. Drei
Phasen: Nahkampf, Beschwörung, Strahl über die volle Sichtweite.
Belohnung: **Zepter von Sorlax** `w_scepter`.

Verhaltensdetails stehen verbindlich in `docs/tasks/PHASE_3_7.md` Block 7 und sind dort
bereits umgesetzt.

## 7. Spielerwaffen

| id | Name | dmgMin | dmgMax | crit | optimal | max | Munition | damageType | Fundort |
|---|---|---|---|---|---|---|---|---|---|
| `w_prybar` | Brechstange | 4 | 9 | 0.12 | 1 | 1 | keine | physical | Start |
| `w_pistol` | Grubenpistole 9 mm | 6 | 11 | 0.10 | 5 | 9 | `pistol` | physical | Sohle 2 |
| `w_shotgun` | Bolzensetzflinte | 12 | 24 | 0.08 | 2 | 4 | `shell` | physical | Sohle 5 |
| `w_riveter` | Bolzenkarabiner | 9 | 15 | 0.18 | 8 | 14 | `rivet` | physical | Sohle 7 |
| `w_rod` | Induktionsstab | 13 | 20 | 0.20 | 6 | 10 | `cell` | shock | Sohle 10 |
| `w_charger` | Sprengladungswerfer | 8 | 14 | 0.05 | 6 | 10 | `charge` | physical | Sohle 14 |
| `w_lance` | Brennlanze | 14 | 22 | 0.08 | 3 | 5 | `fuel` | fire | Boss 4 |
| `w_sprayer` | Toxinsprüher | 10 | 16 | 0.05 | 4 | 7 | `toxin_canister` | poison | Boss 8 |
| `w_drill` | Frostbohrer | 18 | 28 | 0.10 | 2 | 4 | `coolant` | ice | Boss 12 |
| `w_scepter` | Zepter von Sorlax | 26 | 42 | 0.25 | 7 | 12 | `essence` | void | Boss 16 |

`w_charger` hat zusätzlich `splash: { radius: 2.5, baseDamage: 30 }`.
Elementwaffen setzen `appliesEffect` auf den Effekt ihres Typs.

`essence` fällt ausschließlich von Gegnern nach dem Sieg über Sorlax. Das Zepter ist eine
Belohnung für den nächsten Schwierigkeitsgrad, nicht für die letzten zehn Meter.

Munitionsarten: `pistol`, `shell`, `rivet`, `charge`, `cell`, `fuel`, `toxin_canister`,
`coolant`, `essence`.

## 8. Ausrüstungs-Grundtypen

Zwei pro Steckplatz, ein leichter und ein schwerer. Diese Ids sind verbindlich.

| Steckplatz | leicht | schwer |
|---|---|---|
| `suit` | `suit_overall` Arbeitsoverall | `suit_plated` Panzeranzug |
| `helmet` | `helmet_hardhat` Schutzhelm | `helmet_visor` Vollvisierhelm |
| `belt` | `belt_tool` Werkzeuggürtel | `belt_harness` Traggeschirr |
| `boots` | `boots_rubber` Gummistiefel | `boots_steel` Stahlkappenstiefel |
| `gloves` | `gloves_grip` Griffhandschuhe | `gloves_armored` Panzerhandschuhe |
| `guard` | `guard_deflector` Ablenkmodul | `guard_plate` Schulterpanzer |
| `amulet` | `amulet_tag` Erkennungsmarke | `amulet_sigil` Fundsiegel |
| `gauge_left` | `gauge_pressure` Druckmesser | `gauge_seismic` Seismograf |
| `gauge_right` | dieselben wie links | dieselben wie links |

Der Platz `weapon` wird durch die Waffen aus Abschnitt 7 belegt, sobald der Widerspruch
aus Abschnitt 0 aufgelöst ist.

Voraussetzungen, Startwerte:

| Typ | reqLevel | reqStrength | reqAgility | baseModifiers |
|---|---|---|---|---|
| leicht | 1 | 10 | 14 | armor 2, evasion 1 |
| schwer | 8 | 22 | 10 | armor 6, evasion -1 |

Die Werte skalieren nicht mit dem Fundort. Der Unterschied zwischen einem Fund auf Sohle 2
und einem auf Sohle 14 entsteht ausschließlich über `itemLevel` und die daraus möglichen
Affixstufen. Das ist bewusst so, weil es die Zahl der Grundtypen klein hält.

## 9. Loot

Stapelware aus `drops`, unabhängig von getragener Ausrüstung.

| archetype | Drop | Menge | Chance |
|---|---|---|---|
| rat | `heal_small` | 1 | 0.10 |
| crawler | `heal_small` | 1 | 0.20 |
| miner | `ammo_pistol` | 8 | 0.45 |
| drone | `ammo_rivet` | 6 | 0.50, dazu `armor_plate` 1 zu 0.15 |
| spore | `antitoxin` | 1 | 0.35 |
| chainrunner | `ammo_shell` | 4 | 0.40 |
| cultist | `ammo_rivet` | 6 | 0.35, dazu `ammo_pistol` 10 zu 0.30 |
| hauler | `armor_plate` | 1 | 0.30 |
| warden | `ammo_charge` | 2 | 0.50, dazu `heal_large` 1 zu 0.30 |

Elementvarianten ersetzen ihre Munitionsdrops durch die passende Elementmunition, sofern
der Spieler die zugehörige Waffe besitzt. Andernfalls bleibt es bei der Standardmunition.

`dropTableId` ist bei allen regulären Archetypen `common_drop`, bei Bossen `boss_drop`.
Getragene Ausrüstung fällt zusätzlich und zu 100 Prozent, nach RPG.md Abschnitt 9.

## 10. Sohlenplan

| Sohle | Gegner | Besonderheit |
|---|---|---|
| 1 | `rat_physical`, `miner_physical` | Einführung, keine Elemente |
| 2 | `rat_physical`, `miner_physical`, `drone_physical` | `w_pistol` |
| 3 | `miner_physical`, `drone_physical`, `rat_fire` | erstes Element |
| 4 | `miner_fire`, `rat_fire` | **Steiger Halvern**, roter Schlüssel |
| 5 | `crawler_physical`, `spore_physical`, `miner_poison` | `w_shotgun` |
| 6 | `spore_poison`, `cultist_physical`, `crawler_physical` | grüne Zone |
| 7 | `cultist_physical`, `chainrunner_physical`, `spore_poison` | `w_riveter` |
| 8 | `spore_poison`, `cultist_poison` | **Mutter der Sporen**, grüner Schlüssel |
| 9 | `chainrunner_ice`, `hauler_physical`, `drone_ice` | blaue Zone |
| 10 | `hauler_ice`, `cultist_shock`, `crawler_ice` | `w_rod` |
| 11 | `warden_physical`, `chainrunner_ice`, `drone_shock` | erster Grabungswächter |
| 12 | `warden_ice`, `hauler_ice` | **Der Erkaltete**, blauer Schlüssel |
| 13 | `cultist_void`, `warden_physical`, `crawler_void` | violette Zone |
| 14 | `hauler_void`, `drone_void`, `chainrunner_shock` | `w_charger` |
| 15 | `warden_void`, `cultist_void`, `spore_void` | letzte reguläre Sohle |
| 16 | Beschwörungen aus Phase 2 | **Sorlax**, violetter Schlüssel |

Daraus ergeben sich 28 benötigte Gegner-Definitionen plus 4 Bosse. Sie werden vom Skript
aus Phase 7 erzeugt, nicht von Hand geschrieben.

## 11. Offene Balancepunkte

**`chill` dauert weiterhin 4 Runden.** Die Frage aus v2 ist nie entschieden worden, und in
Phase 3.5 wurde der Wert aus SPEC übernommen. In einem Raum mit fünf Gegnern ist das
rechnerisch tödlich. Ich würde es nach dem ersten spielbaren Durchlauf auf 2 senken, nicht
vorher, weil die Zahl ohne Spielgefühl nicht beurteilbar ist.

**Der Waffenschaden steigt langsamer als die Gegnerleben.** Mit Faktor 0.045 pro Stufe hat
ein Gegner auf Stufe 40 rund das Dreifache an Leben, während der Spieler nur zehn Waffen
zur Auswahl hat, von denen die stärkste 42 Schaden würfelt. Der Ausgleich muss über Affixe
und Fertigkeiten kommen. Ob er reicht, ist offen.

**Neun Archetypen über 16 Sohlen bleiben Wiederholung.** Farbvarianten kaschieren das.
Wenn es ab Sohle 10 langweilt, liegt die Antwort in der Levelgestaltung und nicht in einem
zehnten Gegner.
