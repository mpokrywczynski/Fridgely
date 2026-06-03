<?php
if (($_GET['token'] ?? '') !== '%%TOKEN%%') {
    http_response_code(403);
    die('Forbidden');
}

define('LARAVEL_START', microtime(true));
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$out = [];

\Artisan::call('migrate', ['--force' => true]);
$out[] = 'migrate: ' . trim(\Artisan::output());

\Artisan::call('config:cache');
$out[] = 'config:cache: OK';

\Artisan::call('route:cache');
$out[] = 'route:cache: OK';

\Artisan::call('view:cache');
$out[] = 'view:cache: OK';

@unlink(__FILE__);

header('Content-Type: text/plain');
echo implode("\n", $out) . "\n[setup.php deleted]";
