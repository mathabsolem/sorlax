# PHASE 8 — Assetpipeline, echter Loader, Capacitor

Vorbedingung: Phase 7 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/INTERFACES.md` v1.9, `docs/CONTENT_TABLES.md` v1.3,
`docs/ART_PROMPTS.md`, `docs/SETUP.md` Abschnitt 10.

**Prüfe zuerst, ob alle vier Dateien vorhanden sind und ob INTERFACES auf v1.9 und
CONTENT_TABLES auf v1.3 stehen.** Fehlt eine oder ist die Version niedriger, brich sofort
ab und melde es.

INTERFACES bleibt ein Vertrag. Ändere dort nichts, melde Lücken.

Diese Phase erzeugt keine Grafiken. Sie baut die Werkzeuge, mit denen extern erzeugte
Bilder verwendbar werden, und verpackt das Spiel für Mobilgeräte.

---

## Block 0, Vertragsnachzug aus v1.9

1. `pullSave(difficulty, slot)`. Der optionale zweite Parameter mit Vorgabe `'normal'`
   entfällt, alle Aufrufer übergeben den Grad ausdrücklich.
2. `pushSave(slot, state, mapName)`. Der Client löst `mapName` über die `ContentDb` auf.
   Das bisherige dritte Feld im Anfragekörper bleibt inhaltlich gleich.
3. Übertragungsformat: Die Festlegung in INTERFACES Abschnitt 13 beschreibt, was Phase 7
   bereits umgesetzt hat. Prüfe, dass `localStore` genauso arbeitet, also die Zeichenkette
   hasht, die es speichert, und nicht ein neu kodiertes Objekt. Falls dort noch neu
   kodiert wird, korrigieren.
4. Grenzen für `RoomDef.dark` stehen jetzt in CONTENT_TABLES Abschnitt 7 und gelten
   dauerhaft. Der Test aus Phase 7 bleibt, bekommt aber die Tabelle als Quelle.

## Block 1, Aufbereitungswerkzeug

`scripts/prepAsset.ts`, npm-Skript `prep:asset`.

Aufruf: `npm run prep:asset -- <eingabe.png> <ziel-id-oder-name> <typ>`
Typen: `texture`, `sprite`, `boss`, `weapon`, `icon`.

Schritte:
1. Bild laden. Zulässig sind beliebige Eingangsgrößen.
2. Auf das Zielformat bringen: `texture` und `sprite` 64 x 64, `boss` 96 x 96,
   `weapon` 160 x 100, `icon` 32 x 32. Nicht quadratische Eingaben werden mittig
   beschnitten, außer bei `weapon`, dort wird das Seitenverhältnis erhalten und der Rest
   transparent aufgefüllt.
3. Herunterrechnen mit Flächenmittelung, danach **kein** Weichzeichnen.
4. Farbreduktion auf höchstens 64 Farben, Medianschnitt, ohne Dithering. Dithering
   zerstört bei 64 x 64 mehr, als es hilft.
5. Alphakanal hart schwellen: unter 128 wird 0, ab 128 wird 255. Zwischenwerte gibt es im
   Renderer nicht, siehe INTERFACES Abschnitt 11.
6. Bei `texture` zusätzlich: Kantenprüfung. Die linke Spalte wird mit der rechten
   verglichen, die obere Zeile mit der unteren. Die mittlere absolute Abweichung je Kanal
   wird ausgegeben. Über 12 gibt es eine Warnung, keinen Abbruch.
7. Ausgabe an den Pfad nach INTERFACES Abschnitt 11, also
   `public/assets/textures/<id>.png` und so weiter.
8. Zusätzlich eine Vorschau `tmp/preview_<name>.png` mit einer 2x2-Kachelung bei Texturen
   und mit kariertem Hintergrund bei Sprites, damit Ränder sichtbar werden.

Keine neue Abhängigkeit ohne Rückfrage. Prüfe, ob sich Schritt 1 bis 5 mit `sharp` oder
mit bordeigenen Mitteln lösen lässt, und melde, welche Bibliothek nötig wäre, bevor du
sie hinzufügst.

## Block 2, echter Loader

`src/render/assetLoader.ts` aus Phase 3 vervollständigen.

- lädt PNG über `fetch` und `createImageBitmap`, zeichnet sie in ein `OffscreenCanvas` und
  liest `ImageData` aus, Ergebnis als `PixelSurface` nach INTERFACES Abschnitt 11
- lädt parallel, höchstens 8 gleichzeitig
- fehlende Datei ist kein Absturz: es wird die Platzhaltertextur derselben Id verwendet und
  eine Warnung gesammelt
- am Ende wird einmal ausgegeben, wie viele echte und wie viele Platzhalter geladen wurden

**Mischbetrieb ist ausdrücklich gewollt.** Solange nur Zone 1 fertig ist, muss das Spiel
mit echten Texturen für Zone 1 und Platzhaltern für alles andere laufen. Das ist die
Voraussetzung dafür, dass die Grafik schrittweise entstehen kann.

`USE_PLACEHOLDERS` bekommt einen dritten Zustand: `auto`, und das wird die Voreinstellung.
`auto` lädt echte Dateien, wo sie existieren, und füllt den Rest mit Platzhaltern.

## Block 3, Manifest und Prüfung

`scripts/checkAssets.ts`, npm-Skript `check:assets`.

Erzeugt aus `content/` und CONTENT_TABLES Abschnitt 6 die vollständige Liste aller
benötigten Dateien und vergleicht sie mit `public/assets/`. Ausgabe als Tabelle:
je Kategorie vorhanden, fehlend, überzählig.

Zusätzlich wird `public/assets/manifest.json` geschrieben, das der Loader liest, damit er
nicht auf 404 laufen muss, um Fehlen festzustellen.

Ein Test prüft, dass das Manifest zum Inhalt von `public/assets/` passt. Er prüft nicht,
dass alle Dateien vorhanden sind, denn das wird lange nicht der Fall sein.

## Block 4, Tonausgabe

Bisher gibt es keinen Ton. `WeaponDef.sound` und `AssetBundle.sounds` stehen im Vertrag,
werden aber nirgends benutzt.

- `src/render/audio.ts` mit einem schlanken Abspieler über die Web Audio API
- Lautstärke aus den Einstellungen, getrennt für Effekte und Umgebung
- fehlende Datei ist kein Absturz, es wird nichts abgespielt
- ausgelöst über `GameEvent`: `attack`, `died`, `pickup`, `doorChanged`, `levelUp`,
  `skillUsed`
- höchstens acht gleichzeitige Stimmen, älteste wird verdrängt

Tondateien werden in dieser Phase nicht erstellt. Das Gerüst muss ohne sie laufen.

## Block 5, Capacitor

Nach `docs/SETUP.md` Abschnitt 10.

```
npm i @capacitor/core && npm i -D @capacitor/cli
npx cap init "Scepter of Sorlax" tld.deinedomain.sorlax --web-dir=dist
npm i @capacitor/android && npx cap add android
```

Zusätzlich einrichten:
- `@capacitor/status-bar` und Vollbild ohne Statusleiste
- Bildschirmausrichtung fest auf Querformat
- Bildschirmsperre verhindern, solange das Spiel läuft
- Zurück-Taste auf Android: schließt eine offene Ansicht, sonst öffnet sie das Menü,
  beendet die App nie direkt
- `VITE_API_BASE` muss im Build gesetzt sein, sonst läuft die App offline

**iOS wird nicht eingerichtet**, solange kein Mac verfügbar ist. Lege die Anleitung dafür
in `docs/BUILD.md` ab, aber führe nichts aus.

`docs/BUILD.md` beschreibt außerdem: Web-Build, Android-Build als Debug und als signiertes
Release, wo der Schlüsselspeicher hingehört und dass er nicht ins Repo darf.

## Tests

1. `prepAsset` erzeugt aus einem 1024 x 1024 Testbild eine 64 x 64 Datei mit höchstens
   64 Farben und ohne Alphawerte zwischen 1 und 254
2. `prepAsset` meldet bei einer absichtlich nicht kachelbaren Testtextur eine
   Kantenabweichung über 12
3. `prepAsset` erhält bei `weapon` das Seitenverhältnis und füllt transparent auf
4. Der Loader liefert bei fehlender Datei die Platzhalterfläche derselben Id und keine
   Ausnahme
5. Der Loader lädt im Zustand `auto` eine vorhandene Datei und ergänzt eine fehlende
6. `checkAssets` erkennt eine überzählige und eine fehlende Datei
7. Das Manifest passt zum Inhalt von `public/assets/`
8. Der Abspieler verwirft die neunte gleichzeitige Stimme und stürzt nicht ab
9. `pullSave` ohne ausdrücklichen Grad ist kein gültiger Aufruf mehr, geprüft über den
   Typecheck
10. `localStore` hasht die gespeicherte Zeichenkette, geprüft über einen Stand mit dem
    Wert 0.55 in `ambientLight`
11. Der Determinismustest aus Phase 2 ist weiterhin grün

Test 10 hält den Fund aus Phase 7 fest. Er ist der einzige, der die Ursache abdeckt und
nicht nur das Symptom.

## Abnahmekriterium

`npm run check:assets` läuft und zeigt eine vollständige Liste mit lauter fehlenden
Dateien. `npm run dev` läuft weiterhin mit Platzhaltern. Wird eine echte Textur nach
`public/assets/textures/10.png` gelegt, erscheint sie nach einem Neuladen im Spiel, und
alles andere bleibt Platzhalter.

Ein Android-Debug-Build lässt sich erzeugen und startet auf einem Gerät oder im Emulator.

`npm run typecheck`, `npm test`, `npm run gen:enemies`, `npm run gen:maps` und
`npm run check:assets` grün.
Commit mit `feat(assets): pipeline, real loader, audio scaffold, capacitor`.

Melde abschließend:
- welche Bibliothek für die Bildaufbereitung nötig war und warum
- ob der Android-Build tatsächlich lief oder nur vorbereitet ist
- wie viele Assets `check:assets` insgesamt erwartet, aufgeschlüsselt nach Kategorie

Danach anhalten.
