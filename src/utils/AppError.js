export default class AppError extends Error {
  constructor(message, code = "UNKNOWN", context = {}) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.context = context;
  }
}
