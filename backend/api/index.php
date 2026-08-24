<?php

declare(strict_types=1);

/**
 * Einziger Einstiegspunkt des Backends, PHASE_7 Block 2.
 *
 * Der Pfad kommt entweder aus dem Rewrite in .htaccess oder aus `?path=`.
 * Beides muss gehen: faellt mod_rewrite auf dem Hosting aus, funktioniert
 * derselbe Aufruf ueber den Parameter weiter.
 */

namespace Sorlax;

require __DIR__ . '/../src/Json.php';
require __DIR__ . '/../src/Db.php';
require __DIR__ . '/../src/Auth.php';
require __DIR__ . '/../src/Saves.php';
require __DIR__ . '/../src/RateLimit.php';
require __DIR__ . '/../src/Router.php';

/** Regel 9: mehr als drei Megabyte werden gar nicht erst gelesen. */
const MAX_BODY = 3 * 1024 * 1024;

$config = require __DIR__ . '/../config.php';

// --- Regel 11, CORS. Kein Platzhalter, nur die eingetragenen Origins. -------
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = in_array($origin, $config['origins'] ?? [], true);
if ($allowed) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, Content-Encoding');
    header('Access-Control-Allow-Methods: GET, POST, PUT, OPTIONS');
    header('Access-Control-Max-Age: 600');
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    http_response_code($allowed ? 204 : 403);
    exit;
}
if ($origin !== '' && !$allowed) {
    Json::fail(403, Json::FORBIDDEN, 'Origin nicht erlaubt');
    exit;
}

// --- HTTPS erzwingen --------------------------------------------------------
$secure = ($_SERVER['HTTPS'] ?? '') !== '' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
if (($config['require_https'] ?? true) && !$secure) {
    Json::fail(403, Json::FORBIDDEN, 'Nur ueber HTTPS erreichbar');
    exit;
}

// --- Pfad und Koerper -------------------------------------------------------
$path = (string) ($_GET['path'] ?? '');
if ($path === '') {
    $uri = (string) parse_url((string) ($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH);
    $base = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? ''))), '/');
    $path = $base !== '' && str_starts_with($uri, $base) ? substr($uri, strlen($base)) : $uri;
}
$parts = array_values(array_filter(explode('/', trim($path, '/')), static fn (string $p): bool => $p !== ''));

$length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($length > MAX_BODY) {
    Json::fail(413, Json::TOO_LARGE, 'Anfrage zu gross');
    exit;
}

$needsBody = $method === 'POST' || $method === 'PUT';
$type = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
if ($needsBody && !str_starts_with($type, 'application/json')) {
    Json::fail(415, Json::UNSUPPORTED_MEDIA, 'Content-Type muss application/json sein');
    exit;
}

$raw = $needsBody ? (string) file_get_contents('php://input', false, null, 0, MAX_BODY + 1) : '';
if (strlen($raw) > MAX_BODY) {
    Json::fail(413, Json::TOO_LARGE, 'Anfrage zu gross');
    exit;
}

// Der Client packt den Spielstand, wenn der Browser CompressionStream kennt.
if ($raw !== '' && strtolower((string) ($_SERVER['HTTP_CONTENT_ENCODING'] ?? '')) === 'gzip') {
    $plain = @gzdecode($raw);
    if ($plain === false) {
        Json::fail(400, Json::BAD_REQUEST, 'Koerper ist kein gzip');
        exit;
    }
    if (strlen($plain) > Saves::MAX_PAYLOAD) {
        Json::fail(413, Json::TOO_LARGE, 'Spielstand ueber zwei Megabyte');
        exit;
    }
    $raw = $plain;
}

try {
    $db = new Db((string) $config['dsn'], (string) $config['db_user'], (string) $config['db_password']);
} catch (\Throwable) {
    // Die Ausnahme selbst enthaelt Zugangsdaten und darf nie nach draussen.
    Json::fail(500, Json::SERVER_ERROR, 'Datenbank nicht erreichbar');
    exit;
}

$router = new Router($db, $parts, $method, $raw);
try {
    $router->dispatch();
} catch (\Throwable) {
    Json::fail(500, Json::SERVER_ERROR, 'Unerwarteter Fehler');
}
