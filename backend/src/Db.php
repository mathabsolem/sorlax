<?php

declare(strict_types=1);

namespace Sorlax;

use PDO;
use PDOStatement;

/**
 * Datenbankzugriff. Ausschliesslich vorbereitete Anweisungen; keine
 * Zeichenkette wird jemals in SQL eingesetzt.
 */
final class Db
{
    private PDO $pdo;

    public function __construct(string $dsn, string $user, string $password)
    {
        $this->pdo = new PDO($dsn, $user, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }

    /** @param list<mixed> $params */
    public function run(string $sql, array $params = []): PDOStatement
    {
        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);
        return $statement;
    }

    /** @param list<mixed> $params */
    public function one(string $sql, array $params = []): ?array
    {
        $row = $this->run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    /** @param list<mixed> $params @return list<array> */
    public function all(string $sql, array $params = []): array
    {
        return $this->run($sql, $params)->fetchAll();
    }

    public function lastId(): int
    {
        return (int) $this->pdo->lastInsertId();
    }

    /** Zeitstempel in UTC, so wie ihn die Tabellen erwarten. */
    public static function now(): string
    {
        return gmdate('Y-m-d H:i:s');
    }

    /** Zeitstempel in UTC, um `$seconds` verschoben. */
    public static function at(int $seconds): string
    {
        return gmdate('Y-m-d H:i:s', time() + $seconds);
    }

    /** ISO-8601 fuer die Antwort an den Client. */
    public static function iso(string $sqlDate): string
    {
        return str_replace(' ', 'T', $sqlDate) . 'Z';
    }
}
