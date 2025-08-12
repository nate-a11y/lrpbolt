export function logError(err, ctx = '') {
  // Never throw here; always console.error with context
  const payload = err && err.message ? err.message : String(err);
  console.error(`[LRP] ${ctx}`, payload, err);
}
