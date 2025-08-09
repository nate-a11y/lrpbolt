export function logError(err, context = "") {
  let msg;
  try {
    msg = err?.message ?? JSON.stringify(err) ?? "Unknown error";
  } catch (e) {
    msg = "Error serializing error object";
    console.error("[logError] serialization error:", e);
  }
  console.error(`[${context}]`, msg);
}
