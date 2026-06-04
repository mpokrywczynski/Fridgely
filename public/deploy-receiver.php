<?php
if (($_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? '') !== '%%TOKEN%%') {
    http_response_code(403);
    die('Forbidden');
}

set_time_limit(300);
ini_set('memory_limit', '256M');
header('Content-Type: text/plain');

$root = dirname(__DIR__);
$out  = [];

// ── Extract ZIP ───────────────────────────────────────────────
$upload = $_FILES['archive'] ?? null;
if (!$upload || $upload['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    die('Upload error: ' . ($upload['error'] ?? 'no file'));
}

$zipPath = sys_get_temp_dir() . '/deploy_' . time() . '.zip';
if (!move_uploaded_file($upload['tmp_name'], $zipPath)) {
    http_response_code(500);
    die('Cannot save uploaded file');
}

$zip = new ZipArchive();
if ($zip->open($zipPath) !== true) {
    http_response_code(500);
    die('Cannot open ZIP archive');
}
$zip->extractTo($root);
$zip->close();
unlink($zipPath);
$out[] = 'archive extracted';

// ── Bootstrap Laravel ─────────────────────────────────────────
define('LARAVEL_START', microtime(true));
require $root . '/vendor/autoload.php';
$app    = require_once $root . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// ── Artisan commands ──────────────────────────────────────────
\Artisan::call('migrate', ['--force' => true]);
$out[] = 'migrate: ' . trim(\Artisan::output());

\Artisan::call('config:cache');
$out[] = 'config:cache: OK';

\Artisan::call('route:cache');
$out[] = 'route:cache: OK';

\Artisan::call('view:cache');
$out[] = 'view:cache: OK';

$out[] = 'Deploy complete.';

echo implode("\n", $out) . "\n";
