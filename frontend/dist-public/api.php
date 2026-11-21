<?php

/**
 * reports.namotech.in -> the NCRC Laravel app, for the public report API only.
 * Any path other than /api/public/... is refused here, so this domain exposes nothing else.
 */
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET' || ! preg_match('#^/api/public/reports/[A-Za-z0-9]{16,40}/?$#', $path)) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo '{"message":"Not found"}';
    exit;
}

// Both subdomains sit side by side in the cPanel home folder
require dirname(__DIR__) . '/ncrc.namotech.in/backend/public/index.php';
