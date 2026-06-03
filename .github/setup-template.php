<?php
if (($_GET['token'] ?? '') !== '%%TOKEN%%') {
    http_response_code(403);
    die('Forbidden');
}

header('Content-Type: text/plain');
$root = dirname(__DIR__);
$out  = [];

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
