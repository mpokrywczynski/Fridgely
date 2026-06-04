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

$url = $_POST['url'] ?? '';
if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
    http_response_code(400);
    die('Missing or invalid url');
}

header('Content-Type: text/plain');
set_time_limit(120);

// Download ZIP from the temporary URL
$zipPath = sys_get_temp_dir() . '/deploy_' . time() . '.zip';
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
$data = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$data || $httpCode !== 200) {
    http_response_code(500);
    die("Failed to download archive (HTTP $httpCode)");
}
file_put_contents($zipPath, $data);
echo "downloaded\n";

// Extract ZIP
$zip = new ZipArchive();
if ($zip->open($zipPath) !== true) {
    http_response_code(500);
    die('Cannot open ZIP archive');
}
$zip->extractTo($root);
$zip->close();
unlink($zipPath);
echo "extracted\n";
