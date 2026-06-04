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

$ghToken = $_SERVER['HTTP_X_GH_TOKEN'] ?? '';
$repo    = trim($_POST['repo'] ?? '');
$tag     = trim($_POST['tag'] ?? '');

if (!$ghToken || !$repo || !$tag) {
    http_response_code(400);
    die('Missing parameters');
}

header('Content-Type: text/plain');
set_time_limit(120);

// ── Get release asset ID via GitHub API ───────────────────────
$ch = curl_init("https://api.github.com/repos/$repo/releases/tags/$tag");
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        "Authorization: Bearer $ghToken",
        "Accept: application/vnd.github+json",
        "User-Agent: deploy-receiver",
        "X-GitHub-Api-Version: 2022-11-28",
    ],
    CURLOPT_TIMEOUT => 15,
]);
$body    = curl_exec($ch);
$apiCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$release = json_decode($body, true);
$assetId = $release['assets'][0]['id'] ?? null;
if (!$assetId) {
    http_response_code(500);
    die("Release asset not found (API HTTP $apiCode)");
}
echo "asset_id: $assetId\n";

// ── Download asset ────────────────────────────────────────────
$zipPath = sys_get_temp_dir() . '/deploy_' . time() . '.zip';
$fh      = fopen($zipPath, 'wb');
$ch      = curl_init("https://api.github.com/repos/$repo/releases/assets/$assetId");
curl_setopt_array($ch, [
    CURLOPT_FILE           => $fh,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_HTTPHEADER     => [
        "Authorization: Bearer $ghToken",
        "Accept: application/octet-stream",
        "User-Agent: deploy-receiver",
    ],
    CURLOPT_TIMEOUT => 60,
]);
curl_exec($ch);
$dlCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
fclose($fh);

if ($dlCode !== 200) {
    http_response_code(500);
    die("Download failed (HTTP $dlCode)");
}
echo "downloaded\n";

// ── Extract ZIP ───────────────────────────────────────────────
$zip = new ZipArchive();
if ($zip->open($zipPath) !== true) {
    http_response_code(500);
    die('Cannot open ZIP archive');
}
$zip->extractTo($root);
$zip->close();
unlink($zipPath);
echo "extracted\n";
