<?php

declare(strict_types=1);

/**
 * Rauchprobe fuer das Backend, ohne MySQL.
 *
 * Startet den eingebauten PHP-Server gegen eine SQLite-Datei und ruft die
 * Endpunkte ueber echtes HTTP auf. Damit sind Routing, Anmeldung, Sitzung,
 * Ratenbegrenzung, Pruefsumme, gzip und die Fehlercodes wirklich gelaufen und
 * nicht nur behauptet.
 *
 * Was das nicht prueft: MySQL-Eigenheiten wie ENUM, LONGBLOB und
 * REPLACE INTO unter InnoDB. Dafuer ist die Prueflistein backend/README.md da.
 *
 * Aufruf: php backend/tools/selftest.php
 */

$root = dirname(__DIR__);
$dbFile = sys_get_temp_dir() . '/sorlax-selftest-' . bin2hex(random_bytes(4)) . '.sqlite';
$configFile = $root . '/config.php';
$hadConfig = file_exists($configFile);
$backup = $hadConfig ? (string) file_get_contents($configFile) : null;

$pdo = new PDO('sqlite:' . $dbFile);
$pdo->exec((string) file_get_contents(__DIR__ . '/schema.sqlite.sql'));
unset($pdo);

file_put_contents($configFile, "<?php\n\nreturn " . var_export([
    'dsn' => 'sqlite:' . $dbFile,
    'db_user' => '',
    'db_password' => '',
    'origins' => ['http://localhost'],
    'require_https' => false,
], true) . ";\n");

$port = 8787;
$server = proc_open(
    [PHP_BINARY, '-S', '127.0.0.1:' . $port, '-t', $root . '/api'],
    [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']],
    $pipes
);
usleep(400000);

$passed = 0;
$failed = 0;

function check(string $name, bool $ok, string $detail = ''): void
{
    global $passed, $failed;
    if ($ok) {
        $passed++;
        echo "  ok   $name\n";
        return;
    }
    $failed++;
    echo "  FEHL $name" . ($detail === '' ? '' : ": $detail") . "\n";
}

/** @return array{status: int, body: array, headers: array<string, string>} */
function call(string $method, string $path, ?array $body = null, ?string $token = null, array $extra = []): array
{
    global $port;
    $headers = ['Origin: http://localhost'];
    // Ein eigener Content-Type in $extra ersetzt den Vorgabewert, sonst
    // schickte curl beide Kopfzeilen und der Test prueft nichts.
    if ($body !== null && !isset($extra['Content-Type'])) {
        $headers[] = 'Content-Type: application/json';
    }
    if ($token !== null) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }
    foreach ($extra as $name => $value) {
        $headers[] = $name . ': ' . $value;
    }

    $ch = curl_init('http://127.0.0.1:' . $port . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_HEADER => true,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, is_string($body['__raw'] ?? null)
            ? $body['__raw']
            : json_encode($body));
    }
    $raw = (string) curl_exec($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);

    $head = substr($raw, 0, $headerSize);
    $parsed = [];
    foreach (explode("\r\n", $head) as $line) {
        $colon = strpos($line, ':');
        if ($colon !== false) {
            $parsed[strtolower(substr($line, 0, $colon))] = trim(substr($line, $colon + 1));
        }
    }
    $decoded = json_decode(substr($raw, $headerSize), true);
    return ['status' => $status, 'body' => is_array($decoded) ? $decoded : [], 'headers' => $parsed];
}

function state(int $turns, int $level = 3): array
{
    return [
        'version' => 4,
        'turnCount' => $turns,
        'playTimeMs' => 1000 * $turns,
        'difficulty' => 'normal',
        'currentMapId' => 'sohle_01',
        'player' => ['level' => $level],
    ];
}

echo "Rauchprobe gegen SQLite auf Port $port\n";

// --- Registrierung ----------------------------------------------------------
$mail = 'spieler' . bin2hex(random_bytes(3)) . '@example.org';
$res = call('POST', '/auth/register', ['email' => $mail, 'password' => 'geheimnis123']);
check('register gibt 201 und einen Token', $res['status'] === 201 && isset($res['body']['token']), (string) $res['status']);
$token = (string) ($res['body']['token'] ?? '');
check('Token ist 64 Zeichen hex', preg_match('/^[0-9a-f]{64}$/', $token) === 1);

$res = call('POST', '/auth/register', ['email' => $mail, 'password' => 'geheimnis123']);
check('zweite Registrierung derselben Adresse gibt 409', $res['status'] === 409 && ($res['body']['error']['code'] ?? '') === 'conflict');

$res = call('POST', '/auth/register', ['email' => 'neu@example.org', 'password' => 'kurz']);
check('zu kurzes Passwort gibt 400', $res['status'] === 400);

// --- Anmeldung --------------------------------------------------------------
$res = call('POST', '/auth/login', ['email' => $mail, 'password' => 'falschfalsch']);
$wrongPassword = $res;
check('falsches Passwort gibt 401', $res['status'] === 401);

$res = call('POST', '/auth/login', ['email' => 'gibtsnicht@example.org', 'password' => 'falschfalsch']);
check(
    'unbekannte Adresse gibt dieselbe Antwort wie falsches Passwort',
    $res['status'] === $wrongPassword['status']
        && ($res['body']['error']['code'] ?? '') === ($wrongPassword['body']['error']['code'] ?? 'x')
);

$res = call('POST', '/auth/login', ['email' => $mail, 'password' => 'geheimnis123']);
check('richtige Anmeldung gibt 200 und Token', $res['status'] === 200 && isset($res['body']['token']));
$token = (string) ($res['body']['token'] ?? $token);

// --- Sitzung ----------------------------------------------------------------
$res = call('GET', '/saves');
check('ohne Token gibt 401', $res['status'] === 401 && ($res['body']['error']['code'] ?? '') === 'unauthorized');

$res = call('GET', '/saves', null, str_repeat('a', 64));
check('erfundener Token gibt 401', $res['status'] === 401);

$res = call('GET', '/saves', null, $token);
check('mit Token gibt 200 und leere Liste', $res['status'] === 200 && ($res['body']['saves'] ?? null) === []);

// --- Speichern --------------------------------------------------------------
$payload = state(900);
$json = (string) json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
$sum = hash('sha256', $json);
$res = call('PUT', '/saves/normal/1', ['state' => $json, 'checksum' => $sum, 'mapName' => 'Sohle 1, Industrie'], $token);
check('Stand schreiben gibt 200', $res['status'] === 200, json_encode($res['body']));
check('Antwort traegt die Kopfdaten', ($res['body']['meta']['turnCount'] ?? 0) === 900 && ($res['body']['meta']['checksum'] ?? '') === $sum);

$res = call('PUT', '/saves/normal/1', ['state' => $json, 'checksum' => str_repeat('0', 64)], $token);
check('falsche Pruefsumme gibt 422', $res['status'] === 422 && ($res['body']['error']['code'] ?? '') === 'unprocessable');

$res = call('PUT', '/saves/traumhaft/1', ['state' => $json, 'checksum' => $sum], $token);
check('unbekannter Schwierigkeitsgrad gibt 400', $res['status'] === 400);

$res = call('PUT', '/saves/normal/9', ['state' => $json, 'checksum' => $sum], $token);
check('Platz 9 gibt 400', $res['status'] === 400);

$res = call('GET', '/saves/normal/1', null, $token);
check('Stand lesen gibt 200 und denselben turnCount', $res['status'] === 200 && ($res['body']['state']['turnCount'] ?? 0) === 900);

$res = call('GET', '/saves/normal/2', null, $token);
check('leerer Platz gibt 404', $res['status'] === 404 && ($res['body']['error']['code'] ?? '') === 'not_found');

// Zweites Schreiben auf denselben Platz ersetzt den Stand.
$second = state(1200);
$json2 = (string) json_encode($second, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
call('PUT', '/saves/normal/1', ['state' => $json2, 'checksum' => hash('sha256', $json2)], $token);
$res = call('GET', '/saves', null, $token);
check('Liste zeigt genau einen Stand mit 1200 Runden', count($res['body']['saves'] ?? []) === 1 && ($res['body']['saves'][0]['turnCount'] ?? 0) === 1200);

// --- Formate und Kopfzeilen -------------------------------------------------
$res = call('PUT', '/saves/normal/1', ['__raw' => 'kein json'], $token, ['Content-Type' => 'text/plain']);
check('falscher Content-Type gibt 415', $res['status'] === 415 && ($res['body']['error']['code'] ?? '') === 'unsupported_media_type');

$packed = gzencode((string) json_encode(['state' => $json2, 'checksum' => hash('sha256', $json2)]));
$res = call('PUT', '/saves/normal/2', ['__raw' => $packed], $token, ['Content-Encoding' => 'gzip']);
check('gzip-Koerper wird angenommen', $res['status'] === 200, json_encode($res['body']));

$res = call('GET', '/saves', null, $token);
check('nosniff-Kopfzeile ist gesetzt', ($res['headers']['x-content-type-options'] ?? '') === 'nosniff');
check('CORS erlaubt den eingetragenen Origin', ($res['headers']['access-control-allow-origin'] ?? '') === 'http://localhost');

$ch = curl_init('http://127.0.0.1:' . $port . '/saves');
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Origin: https://boese.example'], CURLOPT_HEADER => true]);
$raw = (string) curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
check('fremder Origin wird mit 403 abgewiesen', $status === 403);

// --- Der Aufruf ueber ?path= muss genauso gehen -----------------------------
$res = call('GET', '/index.php?path=/saves', null, $token);
check('?path= funktioniert ohne Rewrite', $res['status'] === 200 && isset($res['body']['saves']));

// --- Ratenbegrenzung --------------------------------------------------------
$limited = false;
for ($i = 0; $i < 14; $i++) {
    $res = call('POST', '/auth/login', ['email' => $mail, 'password' => 'immerfalsch']);
    if ($res['status'] === 429) {
        $limited = true;
        check('429 traegt Retry-After', ($res['headers']['retry-after'] ?? '') !== '');
        break;
    }
}
check('zu viele Anmeldeversuche werden begrenzt', $limited);

// --- Abmelden ---------------------------------------------------------------
$res = call('POST', '/auth/logout', [], $token);
check('logout gibt 200', $res['status'] === 200);
$res = call('GET', '/saves', null, $token);
check('nach dem Abmelden ist der Token wertlos', $res['status'] === 401);

// --- Aufraeumen -------------------------------------------------------------
if (is_resource($server)) {
    proc_terminate($server);
    proc_close($server);
}
if ($backup === null) {
    @unlink($configFile);
} else {
    file_put_contents($configFile, $backup);
}
@unlink($dbFile);

echo "\n$passed bestanden, $failed fehlgeschlagen\n";
exit($failed === 0 ? 0 : 1);
