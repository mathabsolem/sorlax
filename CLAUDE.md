# Scepter of Sorlax

Lies vor jeder Aufgabe docs/SPEC.md und docs/INTERFACES.md.

## Harte Regeln
- INTERFACES.md ist ein Vertrag. Aendere keine Signatur, keinen Typ, keinen Feldnamen.
  Wenn eine Schnittstelle nicht ausreicht, brich ab und melde das, statt sie anzupassen.
- src/core enthaelt keinen Zugriff auf DOM, Canvas, fetch, Date oder Math.random.
  Zufall kommt ausschliesslich aus dem seeded RNG in src/core/rng.ts.
- Jede Zahl in content/ muss aus einer Tabelle in docs/ stammen. Fehlt die Tabelle,
  brich ab und melde es. Erfinde keine Spielwerte.
- Keine neuen npm-Abhaengigkeiten ohne Rueckfrage.
- Kein Code auskommentieren und stehen lassen. Loeschen.
- Jede exportierte Funktion in src/core braucht einen Test in tests/.
- TypeScript strict, kein any, kein Non-Null-Assertion-Operator ausser mit Kommentar,
  der begruendet warum der Wert nicht null sein kann.

## Stil
- Deutsche Kommentare, englische Bezeichner.
- Kleine Dateien. Ueber 300 Zeilen aufteilen.
