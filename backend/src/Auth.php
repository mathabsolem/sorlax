<?php

declare(strict_types=1);

namespace Sorlax;

/**
 * Registrierung, Anmeldung und Sitzungen, PHASE_7 Block 2.
 *
 * Der Token steht nur einmal in der Antwort und danach nie wieder; in der
 * Datenbank liegt ausschliesslich sein SHA-256.
 */
final class Auth
{
    /** Mindestlaenge nach Regel 2. Keine Zeichenklassen, die helfen nicht. */
    public const MIN_PASSWORD = 10;

    /** Sitzungsdauer, gleitend verlaengert. */
    public const SESSION_SECONDS = 30 * 24 * 3600;

    /** Hoechstens einmal je Stunde wird `expires_at` neu geschrieben. */
    public const TOUCH_SECONDS = 3600;

    private const HASH_OPTIONS = ['memory_cost' => 65536, 'time_cost' => 4, 'threads' => 2];

    /**
     * Dummy-Hash gegen Zeitmessung, Regel 7. Er wird geprueft, wenn es die
     * E-Mail nicht gibt, damit die Antwortzeit nichts verraet.
     *
     * Der Wert ist ein echter Argon2id-Hash eines zufaelligen Passworts. Ein
     * erfundener Wert taugt nicht: `password_verify` erkennt ein kaputtes
     * Format sofort und kehrt nach einer Viertelmillisekunde zurueck, waehrend
     * ein echter Hash rund 180 Millisekunden braucht. Genau diesen Unterschied
     * soll die Pruefung verdecken.
     */
    private const DUMMY_HASH = '$argon2id$v=19$m=65536,t=4,p=2$V1JNY0JXMVM0bXBNYTRZRw$GYwejldtkw/FZzKHbfET1nY/snaXQ6iJj8Nrq9NxTag';

    public function __construct(private Db $db)
    {
    }

    public static function validEmail(string $email): bool
    {
        return strlen($email) <= 255 && filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Legt ein Konto an und gibt sofort eine Sitzung zurueck.
     *
     * @return array{userId: int, token: string, expiresAt: string}|null
     *         null, wenn es die E-Mail schon gibt.
     */
    public function register(string $email, string $password): ?array
    {
        $email = strtolower($email);
        if ($this->db->one('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
            return null;
        }

        $this->db->run(
            'INSERT INTO users (email, password_hash, created_at, status) VALUES (?, ?, ?, ?)',
            [$email, password_hash($password, PASSWORD_ARGON2ID, self::HASH_OPTIONS), Db::now(), 'active']
        );
        return $this->startSession($this->db->lastId());
    }

    /**
     * Meldet an. Gibt bei falschem Passwort, unbekannter E-Mail und gesperrtem
     * Konto dasselbe zurueck, damit sich Konten nicht aufzaehlen lassen.
     *
     * @return array{userId: int, token: string, expiresAt: string}|null
     */
    public function login(string $email, string $password): ?array
    {
        $user = $this->db->one(
            'SELECT id, password_hash, status FROM users WHERE email = ?',
            [strtolower($email)]
        );

        if ($user === null) {
            // Regel 7: trotzdem rechnen, sonst verraet die Zeit den Unterschied.
            password_verify($password, self::DUMMY_HASH);
            return null;
        }
        if (!password_verify($password, (string) $user['password_hash'])) {
            return null;
        }
        if (($user['status'] ?? 'active') !== 'active') {
            return null;
        }

        $userId = (int) $user['id'];
        $this->db->run('UPDATE users SET last_login_at = ? WHERE id = ?', [Db::now(), $userId]);
        return $this->startSession($userId);
    }

    /** @return array{userId: int, token: string, expiresAt: string} */
    private function startSession(int $userId): array
    {
        $token = bin2hex(random_bytes(32));
        $expires = Db::at(self::SESSION_SECONDS);
        $this->db->run(
            'INSERT INTO sessions (user_id, token_hash, created_at, expires_at, last_seen_at)'
            . ' VALUES (?, ?, ?, ?, ?)',
            [$userId, self::hashToken($token), Db::now(), $expires, Db::now()]
        );
        return ['userId' => $userId, 'token' => $token, 'expiresAt' => Db::iso($expires)];
    }

    /**
     * Loest einen Token auf und verlaengert die Sitzung gleitend. Gibt die
     * Nutzer-Id zurueck oder null.
     */
    public function userFor(string $token): ?int
    {
        $row = $this->db->one(
            'SELECT id, user_id, last_seen_at FROM sessions WHERE token_hash = ? AND expires_at > ?',
            [self::hashToken($token), Db::now()]
        );
        if ($row === null) {
            return null;
        }

        // Regel 4: hoechstens einmal je Stunde schreiben, sonst kostet jede
        // Anfrage einen Schreibzugriff.
        $seen = strtotime(((string) $row['last_seen_at']) . ' UTC');
        if (time() - $seen >= self::TOUCH_SECONDS) {
            $this->db->run(
                'UPDATE sessions SET last_seen_at = ?, expires_at = ? WHERE id = ?',
                [Db::now(), Db::at(self::SESSION_SECONDS), (int) $row['id']]
            );
        }
        return (int) $row['user_id'];
    }

    public function logout(string $token): void
    {
        $this->db->run('DELETE FROM sessions WHERE token_hash = ?', [self::hashToken($token)]);
    }
}
