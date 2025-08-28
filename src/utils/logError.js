function logError(err, context = {}) {
  // Never throw here; always console.error with context
  console.error("[LRP]", context, err);
}

export default logError;
export { logError };
