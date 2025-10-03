/* LRP Portal enhancement: AppError + logger, 2025-10-03. */
export class AppError extends Error {
  constructor(message, { code, cause, context } = {}) {
    super(message);
    this.name = "AppError";
    this.code = code || "unknown";
    this.cause = cause;
    this.context = context || {};
  }
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
    };
  }
}
export function logError(err, context = {}) {
  // Structured logging; don’t swallow
  console.error("[LRP]", { err, context });
}
