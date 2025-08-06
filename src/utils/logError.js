export function logError(err, context = "") {
  let safeMessage;
  try {
    safeMessage = err?.message || JSON.stringify(err) || "Unknown error";
  } catch {
    safeMessage = "Unknown error (circular)";
  }
  console.error(`[Error] ${context}:`, safeMessage);
}
