<?php
if (($_GET['token'] ?? '') !== '%%TOKEN%%') {
    http_response_code(403);
    die('Forbidden');
}

header('Content-Type: text/plain');
$root = dirname(__DIR__);
$out  = [];

// ── Composer install ──────────────────────────────────────
if (!function_exists('exec')) {
    echo "ERROR: exec() is disabled on this server. Run composer manually.\n";
    exit(1);
}

exec("cd $root && composer install --no-dev --optimize-autoloader --no-interaction 2>&1", $composerOut, $composerCode);
$out[] = 'composer: ' . ($composerCode === 0 ? 'OK' : 'FAILED');
if ($composerCode !== 0) {
    echo implode("\n", $out) . "\n" . implode("\n", $composerOut);
    exit(1);
}

// ── Bootstrap Laravel ─────────────────────────────────────
define('LARAVEL_START', microtime(true));
require $root . '/vendor/autoload.php';
$app    = require_once $root . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// ── Artisan commands ──────────────────────────────────────
\Artisan::call('migrate', ['--force' => true]);
$out[] = 'migrate: ' . trim(\Artisan::output());

\Artisan::call('config:cache');
$out[] = 'config:cache: OK';

\Artisan::call('route:cache');
$out[] = 'route:cache: OK';

\Artisan::call('view:cache');
$out[] = 'view:cache: OK';

@unlink(__FILE__);
$out[] = '[setup.php deleted]';

echo implode("\n", $out);
