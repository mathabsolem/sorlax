# Backend

PHP 8.2 oder neuer, MySQL 8, kein Framework und keine Composer-Abhängigkeiten.
Alles, was der Server tut, steht in `api/index.php` und `src/`.

## Einrichten

1. **Datenbank anlegen**

   ```sql
   CREATE DATABASE sorlax CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'sorlax'@'localhost' IDENTIFIED BY '…';
   GRANT SELECT, INSERT, UPDATE, DELETE ON sorlax.* TO 'sorlax'@'localhost';
   ```

   Der Benutzer braucht kein `DROP` und kein `CREATE`. Das Schema spielt man
   einmal von Hand ein.

2. **Schema einspielen**

   ```sh
   mysql -u root -p sorlax < backend/schema.sql
   ```

3. **`config.php` erstellen**

   ```sh
   cp backend/config.example.php backend/config.php
   chmod 640 backend/config.php
   ```

   Zugangsdaten eintragen, unter `origins` die eigene Domain ergänzen. Die
   Datei ist über `.gitignore` ausgeschlossen und darf nie im Repo landen.

4. **PHP-Version prüfen**

   ```sh
   php -v
   php -r 'var_dump(PASSWORD_ARGON2ID, extension_loaded("pdo_mysql"));'
   ```

   Argon2id muss vorhanden sein. Fehlt es, ist PHP ohne libargon2 gebaut, und
   der Hoster muss nachbessern; ein Ersatz über bcrypt wäre eine
   Verschlechterung und steht deshalb nicht im Code.

5. **HTTPS erzwingen**

   `require_https` bleibt auf `true`. Der Token wandert im
   `Authorization`-Header, über HTTP wäre er im Klartext unterwegs. Nur zum
   Entwickeln auf dem eigenen Rechner darf der Wert auf `false`.

6. **Cronjob einrichten**

   ```
   5 4 * * * /usr/bin/php /pfad/zu/backend/tools/prune.php >> /var/log/sorlax-prune.log 2>&1
   ```

## Endpunkte

| Methode | Pfad | Zweck |
|---|---|---|
| POST | `/auth/register` | Konto anlegen, gibt sofort eine Sitzung |
| POST | `/auth/login` | Anmelden |
| POST | `/auth/logout` | Sitzung beenden |
| GET | `/saves` | Liste aller `SaveMeta` |
| GET | `/saves/{difficulty}/{slot}` | einen Stand holen |
| PUT | `/saves/{difficulty}/{slot}` | einen Stand schreiben |

Fällt `mod_rewrite` auf dem Hosting aus, funktioniert derselbe Aufruf über
`index.php?path=/saves`. Beides ist geprüft.

Fehler kommen als `{ "error": { "code": "...", "message": "..." } }`. Der
`code` ist fest und wird vom Client ausgewertet, die `message` ist für
Menschen und darf sich ändern.

## Rauchprobe ohne MySQL

```sh
php backend/tools/selftest.php
```

Startet den eingebauten PHP-Server gegen eine SQLite-Datei und ruft alle
Endpunkte über echtes HTTP auf: Registrierung, Anmeldung, Sitzung,
Ratenbegrenzung, Prüfsumme, gzip, CORS, `?path=`, Abmelden. Danach räumt er
alles wieder weg.

Das prüft die Logik, nicht MySQL. SQLite kennt weder `ENUM` noch `LONGBLOB`
noch InnoDB-Sperren.

## Prüfliste für die erste Installation

Diese Punkte lassen sich nur auf dem Zielsystem prüfen. Sie sind gegen MySQL
noch offen.

- [ ] `schema.sql` läuft ohne Fehler durch, alle vier Tabellen stehen
- [ ] Registrierung legt eine Zeile in `users` an, `password_hash` beginnt mit
      `$argon2id$`
- [ ] `sessions.token_hash` ist 64 Zeichen lang und enthält nicht den Token,
      den der Client bekommen hat
- [ ] Ein Stand über `PUT /saves/normal/1` landet in `saves`, `payload` beginnt
      mit den gzip-Magicbytes `1f 8b`
- [ ] `REPLACE INTO` überschreibt denselben Platz, statt eine zweite Zeile
      anzulegen
- [ ] `checksum` in der Tabelle stimmt mit der aus `SaveMeta` im Client überein
- [ ] Ein Stand von 1,9 MB geht durch, einer von 2,1 MB wird mit 413 abgelehnt
- [ ] Elf falsche Anmeldeversuche in Folge liefern 429 mit `Retry-After`
- [ ] `DELETE FROM users WHERE id = …` löscht Sitzungen und Stände mit
      (`ON DELETE CASCADE`)
- [ ] `prune.php` löscht abgelaufene Sitzungen und meldet die Zahl
- [ ] Ein Aufruf über HTTP statt HTTPS wird mit 403 abgewiesen
- [ ] Ein Aufruf mit fremdem `Origin` wird mit 403 abgewiesen

## Was bewusst nicht abgesichert ist

Der Spielstand ist clientseitig erzeugt und damit manipulierbar. Für ein
Einzelspieler-Spiel ist das hinnehmbar. Der Server prüft Struktur, Größe und
Prüfsumme, aber keine Plausibilität: Wer sich Stufe 60 erschwindeln will, kann
das. Diese Entscheidung steht hier, damit sie später nicht für ein Versehen
gehalten wird.
