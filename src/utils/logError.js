export function logError(err, context = "") {
  let msg;
  try {
    msg = err?.message ?? JSON.stringify(err) ?? "Unknown error";
  } catch {
    msg = "Error serializing error object";
  }
  console.error(`[${context}]`, msg);
}
