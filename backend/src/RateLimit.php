<?php

declare(strict_types=1);

namespace Sorlax;

/**
 * Ratenbegrenzung ueber die Tabelle `auth_attempts`, PHASE_7 Block 2 Regel 8.
 *
 * Gezaehlt wird je Eimer, also etwa "login:203.0.113.5" oder
 * "login:mail@example.org". Ein Eimer je IP allein reichte nicht: hinter einem
 * Anschluss sitzen viele Leute, und ein Angreifer wechselt die Adresse.
 */
final class RateLimit
{
    public const LOGIN_TRIES = 10;
    public const LOGIN_WINDOW = 900;
    public const REGISTER_TRIES = 5;
    public const REGISTER_WINDOW = 3600;

    public function __construct(private Db $db)
    {
    }

    /** Zahl der Versuche im Fenster. */
    public function count(string $bucket, int $windowSeconds): int
    {
        $row = $this->db->one(
            'SELECT COUNT(*) AS hits FROM auth_attempts WHERE bucket = ? AND created_at > ?',
            [$bucket, Db::at(-$windowSeconds)]
        );
        return (int) ($row['hits'] ?? 0);
    }

    public function hit(string $bucket): void
    {
        $this->db->run(
            'INSERT INTO auth_attempts (bucket, created_at) VALUES (?, ?)',
            [$bucket, Db::now()]
        );
    }

    /**
     * Prueft alle Eimer. Gibt die Zahl der Sekunden zurueck, die der Aufrufer
     * warten muss, oder 0, wenn er darf.
     *
     * @param list<string> $buckets
     */
    public function retryAfter(array $buckets, int $tries, int $windowSeconds): int
    {
        foreach ($buckets as $bucket) {
            if ($this->count($bucket, $windowSeconds) < $tries) {
                continue;
            }
            $row = $this->db->one(
                'SELECT created_at FROM auth_attempts WHERE bucket = ? AND created_at > ?'
                . ' ORDER BY created_at ASC LIMIT 1',
                [$bucket, Db::at(-$windowSeconds)]
            );
            $oldest = $row['created_at'] ?? Db::now();
            $free = strtotime($oldest . ' UTC') + $windowSeconds - time();
            return max(1, $free);
        }
        return 0;
    }

    /** Nach erfolgreicher Anmeldung sind die Fehlversuche gegenstandslos. */
    public function clear(string $bucket): void
    {
        $this->db->run('DELETE FROM auth_attempts WHERE bucket = ?', [$bucket]);
    }
}
