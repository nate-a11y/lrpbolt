<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// --- CORS preflight ---
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
  header("Access-Control-Allow-Headers: Content-Type");
  exit(0);
}

// --- CONFIG ---
$secure_key = 'a9eF12kQvB67xZsT30pL'; // same as before
$firebase_base = 'https://us-central1-lrp---claim-portal.cloudfunctions.net'; // your Cloud Function base

// --- Determine endpoint ---
$type = $_GET['type'] ?? '';
if (!$type && !empty($_SERVER['PATH_INFO'])) {
  $type = trim($_SERVER['PATH_INFO'], '/'); // allow /claim-proxy.php/apiCalendarFetch
}

if (!$type) {
  http_response_code(400);
  echo json_encode(["success" => false, "message" => "Unknown or missing type"]);
  exit;
}

// --- Build target URL ---
parse_str($_SERVER['QUERY_STRING'] ?? '', $params);
unset($params['type']); // clean up query
$qs = http_build_query($params);
$target_url = rtrim($firebase_base, '/') . '/' . $type . ($qs ? ('?' . $qs) : '');

// --- Execute request ---
$ch = curl_init($target_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// --- Handle errors ---
if ($response === false) {
  http_response_code(500);
  echo json_encode([
    "success" => false,
    "message" => "❌ Proxy CURL request failed",
    "curl_error" => $error
  ]);
  exit;
}

// --- Pass through response ---
http_response_code($httpcode);
header("Access-Control-Allow-Origin: *");
echo $response;
