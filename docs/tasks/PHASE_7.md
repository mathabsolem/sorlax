# PHASE 7 — Backend, Anmeldung und Spielstandabgleich

Vorbedingung: Phase 6.5 abgeschlossen, `npm test` und `npm run typecheck` grün.
Pflichtlektüre: `docs/INTERFACES.md` v1.8, `docs/SPEC.md` v1.2 Abschnitt 11.

**Prüfe zuerst, ob beide Dateien vorhanden sind und ob INTERFACES auf v1.8 steht.**
Fehlt eine oder ist die Version niedriger, brich sofort ab und melde es.

INTERFACES bleibt ein Vertrag. Ändere dort nichts, melde Lücken.

---

## Block 0, dunkle Räume

`RoomDef.dark` aus INTERFACES v1.8 umsetzen.

Beim Ausdünnen ab Zone 3 werden wieder auch einzige Raumlampen entfernt, die betroffenen
Räume bekommen `dark: true`. Validatorregel 10 lautet künftig: Jeder Raum mit `kind`
ungleich `corridor` hat mindestens eine Lampe oder `dark: true`.

Grenze: Höchstens 25 Prozent der Räume einer Karte dürfen `dark` sein, und Start-, Ausgangs-
und Arenaräume nie. Ein Test prüft beides. Ohne diese Grenze wird Zone 4 unspielbar dunkel.

`gen:maps` neu laufen lassen, die Karten ändern sich dadurch.

## Block 1, Datenbank

`backend/schema.sql`, MySQL 8, utf8mb4.

```
users
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  email          VARCHAR(255) NOT NULL UNIQUE
  password_hash  VARCHAR(255) NOT NULL
  created_at     DATETIME NOT NULL
  last_login_at  DATETIME NULL
  status         ENUM('active','locked') NOT NULL DEFAULT 'active'

sessions
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  user_id        BIGINT UNSIGNED NOT NULL, FOREIGN KEY auf users, ON DELETE CASCADE
  token_hash     CHAR(64) NOT NULL UNIQUE
  created_at     DATETIME NOT NULL
  expires_at     DATETIME NOT NULL
  last_seen_at   DATETIME NOT NULL
  INDEX (user_id), INDEX (expires_at)

saves
  user_id        BIGINT UNSIGNED NOT NULL
  difficulty     ENUM('normal','hard','nightmare') NOT NULL
  slot           TINYINT UNSIGNED NOT NULL
  payload        LONGBLOB NOT NULL
  checksum       CHAR(64) NOT NULL
  turn_count     INT UNSIGNED NOT NULL
  level          SMALLINT UNSIGNED NOT NULL
  map_id         VARCHAR(64) NOT NULL
  map_name       VARCHAR(128) NOT NULL
  play_time_ms   BIGINT UNSIGNED NOT NULL
  updated_at     DATETIME NOT NULL
  PRIMARY KEY (user_id, difficulty, slot)

auth_attempts
  id             BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  bucket         VARCHAR(190) NOT NULL      -- z.B. "login:203.0.113.5"
  created_at     DATETIME NOT NULL
  INDEX (bucket, created_at)
```

`payload` ist der mit gzip komprimierte JSON-Text, nicht Klartext. `checksum` ist SHA-256
über den **unkomprimierten** Text, damit sie zum Wert aus `SaveMeta` passt.

Der Token steht nie im Klartext in der Datenbank. Gespeichert wird SHA-256 des Tokens.
Wird die Datenbank kopiert, sind damit keine Sitzungen übernehmbar.

## Block 2, PHP-Endpunkte

`backend/api/index.php` als einziger Einstiegspunkt, dazu `backend/api/.htaccess` mit
Rewrite auf diese Datei. Fällt der Rewrite auf dem Hosting aus, funktioniert derselbe
Aufruf über `?path=`. Beides muss gehen.

Struktur: `index.php` routet, die Logik liegt in `backend/src/` mit je einer Datei für
Auth, Saves, Db, RateLimit und Json. Keine Frameworks, keine Composer-Abhängigkeiten.

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/auth/register` | Konto anlegen, gibt sofort eine Sitzung zurück |
| POST | `/auth/login` | Anmelden |
| POST | `/auth/logout` | Sitzung beenden |
| GET | `/saves` | Liste aller `SaveMeta` des Nutzers |
| GET | `/saves/{difficulty}/{slot}` | einen Stand holen |
| PUT | `/saves/{difficulty}/{slot}` | einen Stand schreiben |

Antwortformat durchgehend JSON. Fehler als
`{ "error": { "code": "...", "message": "..." } }` mit passendem HTTP-Status.
Der `code` ist eine feste Zeichenkette, die der Client auswertet, `message` ist für
Menschen und darf sich ändern.

### Sicherheitsregeln, verbindlich

1. Passwörter mit `password_hash($pw, PASSWORD_ARGON2ID, ['memory_cost' => 65536,
   'time_cost' => 4, 'threads' => 2])`. Kein eigener Hash, kein MD5, kein SHA für
   Passwörter.
2. Mindestlänge 10 Zeichen, keine weiteren Regeln. Zeichenklassen-Zwang erhöht die
   Sicherheit nicht messbar und verschlechtert die Bedienbarkeit.
3. Token aus `random_bytes(32)`, hex kodiert. Übergabe im Header
   `Authorization: Bearer <token>`. Keine Cookies, weil Capacitor einen eigenen Origin hat
   und Cookies dort unzuverlässig sind.
4. Sitzungsdauer 30 Tage, gleitend. Jede erfolgreiche Anfrage setzt `last_seen_at` und
   verlängert `expires_at`, höchstens einmal pro Stunde geschrieben.
5. Ausschließlich vorbereitete Anweisungen. Keine Zeichenkette wird in SQL eingesetzt.
6. Bei Anmeldefehlern immer dieselbe Meldung und derselbe Code, unabhängig davon, ob die
   E-Mail existiert. Sonst ist das Konto aufzählbar.
7. Bei nicht existierender E-Mail trotzdem ein Dummy-Hash prüfen, damit die Antwortzeit
   keinen Rückschluss zulässt.
8. Ratenbegrenzung über `auth_attempts`: Anmeldung 10 Versuche je 15 Minuten je IP,
   zusätzlich 10 je 15 Minuten je E-Mail. Registrierung 5 je Stunde je IP. Bei
   Überschreitung HTTP 429 mit `Retry-After`.
9. Anfragekörper über 3 MB werden mit HTTP 413 abgelehnt, bevor sie gelesen werden.
   Nach dem Entpacken über 2 MB ebenfalls, das ist die Grenze aus SPEC Abschnitt 11.
10. `Content-Type: application/json` wird erzwungen, sonst HTTP 415.
11. CORS: erlaubt sind die Origins aus einer Konfigurationsdatei, voreingestellt
    `capacitor://localhost`, `http://localhost`, `ionic://localhost` und die eigene Domain.
    Kein Platzhalter.
12. Zugangsdaten zur Datenbank in `backend/config.php`, die per `.gitignore` ausgeschlossen
    ist. Im Repo liegt `backend/config.example.php`.
13. Alle Antworten mit `X-Content-Type-Options: nosniff` und ohne Server-Signatur.

### Was bewusst nicht abgesichert wird

Der Spielstand ist clientseitig erzeugt und damit manipulierbar. Für ein Einzelspieler-Spiel
ist das hinnehmbar. Der Server prüft nur Struktur und Größe, nicht Plausibilität. Diese
Entscheidung steht hier, damit sie nicht später für ein Versehen gehalten wird.

Serverseitig geprüft wird trotzdem: `difficulty` ist einer der drei erlaubten Werte, `slot`
liegt zwischen 0 und 3, der entpackte Text ist gültiges JSON, und die mitgelieferte
`checksum` stimmt mit dem berechneten SHA-256 überein. Bei Abweichung HTTP 422.

## Block 3, Client

`src/net/apiClient.ts` implementiert `ApiClient` aus INTERFACES Abschnitt 13.

- Basis-URL aus `import.meta.env.VITE_API_BASE`
- Token in IndexedDB, nicht in `localStorage`
- bei HTTP 401 wird der Token verworfen und ein Ereignis für die Oberfläche erzeugt
- jeder Fehler wird als `ApiError` mit `code` und `message` geworfen
- Zeitüberschreitung nach 15 Sekunden über `AbortController`
- der Spielstand wird vor dem Senden mit `CompressionStream('gzip')` komprimiert. Fehlt
  die API, wird unkomprimiert gesendet und der Server erkennt das am fehlenden Header
  `Content-Encoding: gzip`

`src/net/sync.ts` regelt den Abgleich nach SPEC Abschnitt 11:

- nach jedem Autosave wird ein Push angestoßen, aber höchstens alle 60 Sekunden
- schlägt er fehl, wandert er in eine Warteschlange in IndexedDB und wird beim nächsten
  erfolgreichen Aufruf nachgeholt
- beim Start wird `listSaves` geholt und mit den lokalen Ständen verglichen
- Konflikt: höherer `turnCount` gewinnt. Bei Gleichstand fragt die Oberfläche
- **ein Netzfehler darf das Spiel nie blockieren.** Lokales Speichern läuft immer zuerst
  und unabhängig

## Block 4, Oberfläche

Zwei neue Ansichten in `src/ui/`:

- Anmeldung mit Registrieren, Anmelden und einem Punkt "Ohne Konto spielen". Der dritte
  Weg ist gleichwertig, nicht versteckt. Wer offline spielen will, soll das können
- im Menü ein Abschnitt "Konto" mit angemeldeter E-Mail, Abmelden und dem Zustand der
  Warteschlange, also wie viele Stände noch nicht übertragen sind

Im Speicherplatz-Dialog zeigt jeder Platz zusätzlich, ob er lokal, entfernt oder beides ist,
und bei Abweichung beide Zeitstempel.

## Block 5, Werkzeuge

- `backend/README.md` mit Einrichtung: Datenbank anlegen, `schema.sql` einspielen,
  `config.php` erstellen, PHP-Version prüfen, HTTPS erzwingen
- ein Skript `backend/tools/prune.php`, das abgelaufene Sitzungen und `auth_attempts`
  älter als 24 Stunden löscht, gedacht für einen täglichen Cronjob
- `.env.example` im Projektwurzelverzeichnis mit `VITE_API_BASE`

## Tests

Der PHP-Teil lässt sich in Vitest nicht prüfen. **Erfinde keine Testergebnisse für das
Backend.** Wenn in der Umgebung kein PHP verfügbar ist, melde das und liefere stattdessen
die Prüfliste aus `backend/README.md`.

TypeScript-Seite, gegen eine Attrappe von `fetch`:

1. `login` speichert den Token und setzt ihn bei der nächsten Anfrage in den Header
2. HTTP 401 verwirft den Token und wirft `ApiError` mit dem erwarteten `code`
3. Zeitüberschreitung nach 15 Sekunden wirft `ApiError`, nicht eine unbehandelte Ausnahme
4. Ein fehlgeschlagener Push landet in der Warteschlange und wird beim nächsten Versuch
   nachgeholt, in der ursprünglichen Reihenfolge
5. Zwei Stände mit `turnCount` 900 lokal und 1200 entfernt lösen den entfernten aus
6. Bei gleichem `turnCount` wird kein Stand automatisch überschrieben, sondern ein
   Konflikt gemeldet
7. Ein Netzfehler während des Spielens führt nicht dazu, dass `applyCommand` fehlschlägt
   oder eine Ausnahme bis in die Renderschleife durchschlägt
8. Die Prüfsumme, die der Client sendet, entspricht der aus `localStore`
9. Ein Stand über 2 MB wird gar nicht erst gesendet
10. Der Determinismustest aus Phase 2 ist weiterhin grün

Kartenseite nach Block 0:

11. Höchstens 25 Prozent der Räume einer Karte tragen `dark`
12. Start-, Ausgangs- und Arenaräume tragen nie `dark`
13. Jeder Raum ohne `dark` und ohne `kind: 'corridor'` hat mindestens eine Lampe
14. Zweimaliger Lauf von `gen:maps` erzeugt weiterhin byteweise identische Dateien

## Abschluss

`npm run typecheck`, `npm test`, `npm run gen:enemies` und `npm run gen:maps` grün.
Commit mit `feat(net): php backend, auth, save sync`.

Melde abschließend:
- ob PHP in der Umgebung verfügbar war und das Backend tatsächlich lief
- welche Punkte der Sicherheitsliste nicht umsetzbar waren und warum
- neue Widersprüche zwischen Dokumenten

Danach anhalten. Grafik und Capacitor-Build sind Phase 8.
