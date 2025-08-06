/* Shared error handling utilities */

export { logError } from "./logError";

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
