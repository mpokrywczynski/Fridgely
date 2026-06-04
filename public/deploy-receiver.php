<?php
$root   = dirname(__DIR__);
$secret = '';
if (file_exists($root . '/.env')) {
    preg_match('/^DEPLOY_SECRET=(.+)$/m', file_get_contents($root . '/.env'), $m);
    $secret = trim($m[1] ?? '');
}
if (!$secret || ($_SERVER['HTTP_X_DEPLOY_TOKEN'] ?? '') !== $secret) {
    http_response_code(403);
    die('Forbidden');
}

header('Content-Type: text/plain');

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
echo "archive extracted\n";
