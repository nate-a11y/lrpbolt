<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// CORS preflight handler
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
  header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
  header("Access-Control-Allow-Headers: Content-Type");
  exit(0);
}

$google_script_url = 'https://script.google.com/macros/s/AKfycbyWpVh4Sbt3qwsrsZHLnJADTwh71i18uoGBxP6jJqWhAIa7Y4iht0zsFALBeJV-s0Yz/exec';
$secure_key = 'a9eF12kQvB67xZsT30pL';

$ch = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  $input = file_get_contents('php://input');
  $decoded = json_decode($input, true);

  if (!isset($decoded['key']) || $decoded['key'] !== $secure_key) {
    http_response_code(403);
    echo json_encode(["success" => false, "message" => "Unauthorized proxy call"]);
    exit;
  }

  $ch = curl_init($google_script_url);
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_POST, true);
  curl_setopt($ch, CURLOPT_POSTFIELDS, $input);
  curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
  curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
} else {
  $query = $_SERVER['QUERY_STRING'] ?? '';
  $ch = curl_init("$google_script_url?$query");
  curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
  curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
}

$response = curl_exec($ch);
$httpcode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($response === false) {
  http_response_code(500);
  echo json_encode([
    "success" => false,
    "message" => "❌ Proxy CURL request failed",
    "curl_error" => $error
  ]);
  exit;
}

// Return Google Apps Script response as-is
http_response_code($httpcode);
header("Access-Control-Allow-Origin: *"); // Redundant but explicit
echo $response;
