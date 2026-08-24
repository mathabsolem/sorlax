<?php

declare(strict_types=1);

/**
 * Raeumt abgelaufene Sitzungen und alte Anmeldeversuche weg.
 * Gedacht fuer einen taeglichen Cronjob:
 *
 *   5 4 * * * /usr/bin/php /pfad/zu/backend/tools/prune.php >> /var/log/sorlax-prune.log 2>&1
 */

namespace Sorlax;

require __DIR__ . '/../src/Db.php';

$config = require __DIR__ . '/../config.php';
$db = new Db((string) $config['dsn'], (string) $config['db_user'], (string) $config['db_password']);

$sessions = $db->run('DELETE FROM sessions WHERE expires_at < ?', [Db::now()])->rowCount();
$attempts = $db->run('DELETE FROM auth_attempts WHERE created_at < ?', [Db::at(-24 * 3600)])->rowCount();

printf(
    "%s: %d abgelaufene Sitzungen, %d alte Anmeldeversuche geloescht\n",
    Db::now(),
    $sessions,
    $attempts
);
