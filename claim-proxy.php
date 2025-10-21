<?php
// claim-proxy.php

// --- CORS ---
header("Access-Control-Allow-Origin: *");
header("Vary: Origin");
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
  header("Access-Control-Allow-Headers: Content-Type, Authorization, X-LRP-Key");
  http_response_code(204);
  exit;
}

// --- CONFIG ---
$secure_key     = 'a9eF12kQvB67xZsT30pL'; // keep in env in production
$firebase_base  = 'https://us-central1-lrp---claim-portal.cloudfunctions.net';

// --- Resolve action/type (support both + PATH_INFO) ---
$action = $_GET['type'] ?? $_GET['action'] ?? '';
if (!$action && !empty($_SERVER['PATH_INFO'])) {
  $action = trim($_SERVER['PATH_INFO'], '/'); // e.g. /notifyLive
}
if (!$action) {
  http_response_code(400);
  header("Content-Type: application/json");
  echo json_encode(["success" => false, "message" => "Missing 'action' (or 'type')"]);
  exit;
}

// --- Request metadata (content-type + body) ---
$contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
$body        = file_get_contents('php://input'); // raw body (JSON, form, etc.)

// --- Auth: require secure key (Header, query, or JSON body) ---
$provided_key = $_GET['key'] ?? ($_SERVER['HTTP_X_LRP_KEY'] ?? '');
if (!$provided_key && $body !== '') {
  $payload = json_decode($body, true);
  if (json_last_error() === JSON_ERROR_NONE && isset($payload['key']) && is_string($payload['key'])) {
    $provided_key = $payload['key'];
  }
}

if (!$provided_key || !hash_equals($secure_key, $provided_key)) {
  http_response_code(401);
  header("Content-Type: application/json");
  echo json_encode(["success" => false, "message" => "Unauthorized"]);
  exit;
}

// --- Build target URL (preserve other query params) ---
parse_str($_SERVER['QUERY_STRING'] ?? '', $params);
unset($params['type'], $params['action'], $params['key']);
$qs = http_build_query($params);
$target = rtrim($firebase_base, '/') . '/' . $action . ($qs ? ('?' . $qs) : '');

// --- Prepare method, body, headers ---
$method = $_SERVER['REQUEST_METHOD'];

$headers = [];
if ($contentType)     $headers[] = 'Content-Type: ' . $contentType;
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if ($auth)            $headers[] = 'Authorization: ' . $auth;
// forward our key upstream too, if CF expects it
$headers[] = 'X-LRP-Key: ' . $secure_key;
$headers[] = 'Accept: application/json';
$headers[] = 'Expect:'; // disable 100-continue stalls

// --- Execute request with cURL ---
$ch = curl_init($target);
curl_setopt_array($ch, [
  CURLOPT_CUSTOMREQUEST  => $method,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT        => 15,
  CURLOPT_CONNECTTIMEOUT => 8,
  CURLOPT_HTTPHEADER     => $headers,
  CURLOPT_ENCODING       => '', // allow gzip
  CURLOPT_SSL_VERIFYPEER => true,
  CURLOPT_SSL_VERIFYHOST => 2,
]);

// only attach body for methods that have one
if (in_array($method, ['POST','PUT','PATCH','DELETE'], true)) {
  curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response  = curl_exec($ch);
$httpcode  = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$ctypeUp   = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$curlErr   = curl_error($ch);
curl_close($ch);

// --- Return ---
if ($response === false) {
  http_response_code(502);
  header("Content-Type: application/json");
  echo json_encode([
    "success"    => false,
    "message"    => "Proxy request failed",
    "target"     => $target,
    "curl_error" => $curlErr
  ]);
  exit;
}

http_response_code($httpcode);
header("Access-Control-Allow-Origin: *");
header("Content-Type: " . ($ctypeUp ?: "application/json"));
echo $response;
