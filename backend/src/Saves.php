<?php

declare(strict_types=1);

namespace Sorlax;

/**
 * Spielstaende, PHASE_7 Block 2.
 *
 * Der Stand ist clientseitig erzeugt und damit manipulierbar. Fuer ein
 * Einzelspieler-Spiel ist das hinnehmbar, siehe PHASE_7. Geprueft werden nur
 * Struktur, Groesse und Pruefsumme, nicht Plausibilitaet.
 */
final class Saves
{
    /** Grenze aus SPEC Abschnitt 11, auf den entpackten Text bezogen. */
    public const MAX_PAYLOAD = 2 * 1024 * 1024;

    public const DIFFICULTIES = ['normal', 'hard', 'nightmare'];
    public const MAX_SLOT = 3;

    public function __construct(private Db $db)
    {
    }

    public static function validDifficulty(string $value): bool
    {
        return in_array($value, self::DIFFICULTIES, true);
    }

    public static function validSlot(int $slot): bool
    {
        return $slot >= 0 && $slot <= self::MAX_SLOT;
    }

    /** Alle Staende eines Nutzers als SaveMeta, ohne die Nutzdaten. */
    public function list(int $userId): array
    {
        $rows = $this->db->all(
            'SELECT difficulty, slot, checksum, turn_count, level, map_id, map_name,'
            . ' play_time_ms, updated_at FROM saves WHERE user_id = ?'
            . ' ORDER BY difficulty ASC, slot ASC',
            [$userId]
        );
        return array_map(static fn (array $row): array => self::meta($row), $rows);
    }

    /** Ein Stand mit Nutzdaten, oder null. */
    public function get(int $userId, string $difficulty, int $slot): ?array
    {
        $row = $this->db->one(
            'SELECT difficulty, slot, payload, checksum, turn_count, level, map_id, map_name,'
            . ' play_time_ms, updated_at FROM saves WHERE user_id = ? AND difficulty = ? AND slot = ?',
            [$userId, $difficulty, $slot]
        );
        if ($row === null) {
            return null;
        }

        $payload = $row['payload'];
        if (is_resource($payload)) {
            $payload = stream_get_contents($payload);
        }
        return ['meta' => self::meta($row), 'payload' => (string) $payload];
    }

    /**
     * Schreibt einen Stand. `$json` ist der unkomprimierte Text, gespeichert
     * wird er gzip-komprimiert.
     */
    public function put(int $userId, string $difficulty, int $slot, string $json, array $meta): array
    {
        $packed = gzencode($json, 6);
        if ($packed === false) {
            $packed = $json;
        }

        $now = Db::now();
        $this->db->run(
            'REPLACE INTO saves (user_id, difficulty, slot, payload, checksum, turn_count,'
            . ' level, map_id, map_name, play_time_ms, updated_at)'
            . ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $userId,
                $difficulty,
                $slot,
                $packed,
                hash('sha256', $json),
                $meta['turnCount'],
                $meta['level'],
                $meta['mapId'],
                $meta['mapName'],
                $meta['playTimeMs'],
                $now,
            ]
        );

        return self::meta([
            'difficulty' => $difficulty,
            'slot' => $slot,
            'checksum' => hash('sha256', $json),
            'turn_count' => $meta['turnCount'],
            'level' => $meta['level'],
            'map_id' => $meta['mapId'],
            'map_name' => $meta['mapName'],
            'play_time_ms' => $meta['playTimeMs'],
            'updated_at' => $now,
        ]);
    }

    /**
     * Liest die Kopfdaten aus dem Spielstand. Fehlt eines der Felder oder hat
     * es den falschen Typ, ist der Stand nicht brauchbar.
     */
    public static function metaFromState(array $state, string $mapName): ?array
    {
        $player = $state['player'] ?? null;
        if (!is_array($player)) {
            return null;
        }
        $turn = $state['turnCount'] ?? null;
        $level = $player['level'] ?? null;
        $mapId = $state['currentMapId'] ?? null;
        $playTime = $state['playTimeMs'] ?? 0;
        if (!is_int($turn) || !is_int($level) || !is_string($mapId)) {
            return null;
        }

        return [
            'turnCount' => $turn,
            'level' => $level,
            'mapId' => substr($mapId, 0, 64),
            'mapName' => substr($mapName === '' ? $mapId : $mapName, 0, 128),
            'playTimeMs' => is_int($playTime) ? $playTime : 0,
        ];
    }

    private static function meta(array $row): array
    {
        return [
            'slot' => (int) $row['slot'],
            'turnCount' => (int) $row['turn_count'],
            'level' => (int) $row['level'],
            'difficulty' => (string) $row['difficulty'],
            'mapId' => (string) $row['map_id'],
            'mapName' => (string) $row['map_name'],
            'playTimeMs' => (int) $row['play_time_ms'],
            'updatedAt' => Db::iso((string) $row['updated_at']),
            'checksum' => (string) $row['checksum'],
        ];
    }
}
