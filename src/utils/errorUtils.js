/* Shared error handling utilities */

/**
 * Log an error with optional context.
 * @param {unknown} error
 * @param {string} [context]
 */
export function logError(error, context) {
  if (context) {
    console.error(context, error);
  } else {
    console.error(error);
  }
}

/**
 * Convert Firebase auth error codes to human friendly messages.
 * @param {{ code?: string }} error
 * @returns {string}
 */
export function formatAuthError(error) {
  switch (error?.code) {
    case "auth/wrong-password":
      return "Incorrect password.";
    case "auth/user-not-found":
      return "No user found with this email.";
    case "auth/email-already-in-use":
      return "Email is already in use.";
    default:
      return "Authentication error occurred.";
  }
}
