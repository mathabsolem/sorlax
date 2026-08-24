<?php

declare(strict_types=1);

namespace Sorlax;

/**
 * Antworten und Fehler. Jede Antwort ist JSON, jeder Fehler traegt einen
 * festen `code`, den der Client auswertet, und eine `message` fuer Menschen.
 */
final class Json
{
    /** Fehler, die der Client kennt. Die Zeichenketten sind Teil des Vertrags. */
    public const BAD_REQUEST = 'bad_request';
    public const UNAUTHORIZED = 'unauthorized';
    public const FORBIDDEN = 'forbidden';
    public const NOT_FOUND = 'not_found';
    public const CONFLICT = 'conflict';
    public const TOO_LARGE = 'too_large';
    public const UNSUPPORTED_MEDIA = 'unsupported_media_type';
    public const UNPROCESSABLE = 'unprocessable';
    public const RATE_LIMITED = 'rate_limited';
    public const SERVER_ERROR = 'server_error';

    /** @param array<string, mixed>|list<mixed> $data */
    public static function send(array $data, int $status = 200, array $headers = []): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: no-store');
        header_remove('X-Powered-By');
        foreach ($headers as $name => $value) {
            header($name . ': ' . $value);
        }
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    /**
     * Fehlerantwort. `message` darf sich aendern, `code` nie.
     *
     * @param array<string, string> $headers
     */
    public static function fail(int $status, string $code, string $message, array $headers = []): void
    {
        self::send(['error' => ['code' => $code, 'message' => $message]], $status, $headers);
    }

    /** Liest den Anfragekoerper als JSON. Gibt bei Unsinn null zurueck. */
    public static function body(string $raw): ?array
    {
        $data = json_decode($raw, true);
        return is_array($data) ? $data : null;
    }

    /** Feld als Zeichenkette, sonst null. Leere Zeichenketten gelten als fehlend. */
    public static function stringField(?array $body, string $name): ?string
    {
        $value = $body[$name] ?? null;
        if (!is_string($value)) {
            return null;
        }
        $value = trim($value);
        return $value === '' ? null : $value;
    }
}
