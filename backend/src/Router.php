<?php

declare(strict_types=1);

namespace Sorlax;

/**
 * Wegweiser der sechs Endpunkte, PHASE_7 Block 2.
 *
 * Jede Antwort ist JSON, jeder Fehler traegt einen festen `code`. Die Logik
 * liegt in Auth und Saves, hier steht nur, wer wann was darf.
 */
final class Router
{
    private Auth $auth;
    private Saves $saves;
    private RateLimit $limit;

    /** @param list<string> $parts */
    public function __construct(
        Db $db,
        private array $parts,
        private string $method,
        private string $raw
    ) {
        $this->auth = new Auth($db);
        $this->saves = new Saves($db);
        $this->limit = new RateLimit($db);
    }

    public function dispatch(): void
    {
        $head = $this->parts[0] ?? '';
        $tail = $this->parts[1] ?? '';

        if ($head === 'auth' && $this->method === 'POST') {
            match ($tail) {
                'register' => $this->register(),
                'login' => $this->login(),
                'logout' => $this->logout(),
                default => Json::fail(404, Json::NOT_FOUND, 'Unbekannter Endpunkt'),
            };
            return;
        }

        if ($head === 'saves') {
            $this->saves();
            return;
        }

        Json::fail(404, Json::NOT_FOUND, 'Unbekannter Endpunkt');
    }

    /** Die anfragende Adresse, fuer die Ratenbegrenzung. */
    private function ip(): string
    {
        return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
    }

    private function bearer(): ?string
    {
        $header = (string) ($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if (!str_starts_with($header, 'Bearer ')) {
            return null;
        }
        $token = trim(substr($header, 7));
        return preg_match('/^[0-9a-f]{64}$/', $token) === 1 ? $token : null;
    }

    private function register(): void
    {
        $body = Json::body($this->raw);
        $email = Json::stringField($body, 'email');
        $password = Json::stringField($body, 'password');

        $wait = $this->limit->retryAfter(
            ['register:' . $this->ip()],
            RateLimit::REGISTER_TRIES,
            RateLimit::REGISTER_WINDOW
        );
        if ($wait > 0) {
            Json::fail(429, Json::RATE_LIMITED, 'Zu viele Versuche', ['Retry-After' => (string) $wait]);
            return;
        }
        $this->limit->hit('register:' . $this->ip());

        if ($email === null || !Auth::validEmail($email)) {
            Json::fail(400, Json::BAD_REQUEST, 'E-Mail-Adresse fehlt oder ist ungueltig');
            return;
        }
        if ($password === null || strlen($password) < Auth::MIN_PASSWORD) {
            Json::fail(
                400,
                Json::BAD_REQUEST,
                'Passwort braucht mindestens ' . Auth::MIN_PASSWORD . ' Zeichen'
            );
            return;
        }

        $result = $this->auth->register($email, $password);
        if ($result === null) {
            Json::fail(409, Json::CONFLICT, 'Diese Adresse ist schon vergeben');
            return;
        }
        Json::send($result, 201);
    }

    private function login(): void
    {
        $body = Json::body($this->raw);
        $email = Json::stringField($body, 'email');
        $password = Json::stringField($body, 'password');

        // Regel 8: je Adresse und je E-Mail zaehlen, nicht nur je Adresse.
        $buckets = ['login:' . $this->ip()];
        if ($email !== null) {
            $buckets[] = 'login:' . strtolower($email);
        }
        $wait = $this->limit->retryAfter($buckets, RateLimit::LOGIN_TRIES, RateLimit::LOGIN_WINDOW);
        if ($wait > 0) {
            Json::fail(429, Json::RATE_LIMITED, 'Zu viele Versuche', ['Retry-After' => (string) $wait]);
            return;
        }
        foreach ($buckets as $bucket) {
            $this->limit->hit($bucket);
        }

        $result = $email === null || $password === null ? null : $this->auth->login($email, $password);
        if ($result === null) {
            // Regel 6: immer dieselbe Antwort, sonst sind Konten aufzaehlbar.
            Json::fail(401, Json::UNAUTHORIZED, 'E-Mail oder Passwort stimmt nicht');
            return;
        }

        foreach ($buckets as $bucket) {
            $this->limit->clear($bucket);
        }
        Json::send($result);
    }

    private function logout(): void
    {
        $token = $this->bearer();
        if ($token !== null) {
            $this->auth->logout($token);
        }
        // Auch ohne gueltigen Token ist der Wunsch erfuellt: die Sitzung ist weg.
        Json::send(['ok' => true]);
    }

    private function saves(): void
    {
        $token = $this->bearer();
        $userId = $token === null ? null : $this->auth->userFor($token);
        if ($userId === null) {
            Json::fail(401, Json::UNAUTHORIZED, 'Anmeldung noetig');
            return;
        }

        if (count($this->parts) === 1) {
            if ($this->method !== 'GET') {
                Json::fail(404, Json::NOT_FOUND, 'Unbekannter Endpunkt');
                return;
            }
            Json::send(['saves' => $this->saves->list($userId)]);
            return;
        }

        $difficulty = $this->parts[1] ?? '';
        $slot = (int) ($this->parts[2] ?? '-1');
        if (!Saves::validDifficulty($difficulty) || !Saves::validSlot($slot)) {
            Json::fail(400, Json::BAD_REQUEST, 'Schwierigkeitsgrad oder Platz ungueltig');
            return;
        }

        match ($this->method) {
            'GET' => $this->pull($userId, $difficulty, $slot),
            'PUT' => $this->push($userId, $difficulty, $slot),
            default => Json::fail(404, Json::NOT_FOUND, 'Unbekannter Endpunkt'),
        };
    }

    private function pull(int $userId, string $difficulty, int $slot): void
    {
        $found = $this->saves->get($userId, $difficulty, $slot);
        if ($found === null) {
            Json::fail(404, Json::NOT_FOUND, 'Kein Stand auf diesem Platz');
            return;
        }

        $json = @gzdecode($found['payload']);
        if ($json === false) {
            $json = $found['payload'];
        }
        $state = json_decode($json, true);
        if (!is_array($state)) {
            Json::fail(500, Json::SERVER_ERROR, 'Gespeicherter Stand ist unlesbar');
            return;
        }
        Json::send(['meta' => $found['meta'], 'state' => $state]);
    }

    private function push(int $userId, string $difficulty, int $slot): void
    {
        $body = Json::body($this->raw);
        $json = $body['state'] ?? null;
        $checksum = Json::stringField($body, 'checksum');
        $mapName = Json::stringField($body, 'mapName') ?? '';

        // Der Stand kommt als Text herein, nicht als verschachteltes Objekt.
        // Wuerde der Server ihn neu kodieren, um die Pruefsumme zu bilden,
        // haengt sie an Zahlenformat und Escapes von PHP statt an dem, was der
        // Client gehasht hat.
        if (!is_string($json) || $checksum === null) {
            Json::fail(400, Json::BAD_REQUEST, 'Es fehlt der Stand oder die Pruefsumme');
            return;
        }
        if (strlen($json) > Saves::MAX_PAYLOAD) {
            Json::fail(413, Json::TOO_LARGE, 'Spielstand ueber zwei Megabyte');
            return;
        }
        if (!hash_equals(hash('sha256', $json), $checksum)) {
            Json::fail(422, Json::UNPROCESSABLE, 'Pruefsumme passt nicht zum Stand');
            return;
        }

        $state = json_decode($json, true);
        if (!is_array($state)) {
            Json::fail(422, Json::UNPROCESSABLE, 'Stand ist kein gueltiges JSON');
            return;
        }

        $meta = Saves::metaFromState($state, $mapName);
        if ($meta === null) {
            Json::fail(422, Json::UNPROCESSABLE, 'Stand hat nicht die erwarteten Felder');
            return;
        }
        if (($state['difficulty'] ?? $difficulty) !== $difficulty) {
            Json::fail(422, Json::UNPROCESSABLE, 'Schwierigkeitsgrad passt nicht zum Platz');
            return;
        }

        Json::send(['meta' => $this->saves->put($userId, $difficulty, $slot, $json, $meta)]);
    }
}
