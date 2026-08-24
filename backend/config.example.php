<?php

/**
 * Vorlage fuer backend/config.php. Die echte Datei liegt nicht im Repo.
 * Kopieren, Werte eintragen, Dateirechte auf 0640 setzen.
 */

return [
    // PDO-DSN. Fuer MySQL 8 mit utf8mb4.
    'dsn' => 'mysql:host=localhost;dbname=sorlax;charset=utf8mb4',
    'db_user' => 'sorlax',
    'db_password' => '',

    // Erlaubte Origins fuer CORS. Kein Platzhalter, jede Adresse einzeln.
    'origins' => [
        'capacitor://localhost',
        'http://localhost',
        'ionic://localhost',
        'https://sorlax.example.org',
    ],

    // Erzwingt HTTPS. Nur zum Entwickeln auf false setzen.
    'require_https' => true,
];
