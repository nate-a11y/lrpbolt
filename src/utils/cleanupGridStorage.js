/* Proprietary and confidential. See LICENSE. */
/**
 * cleanupGridStorage.js
 *
 * Cleans up corrupted localStorage from MUI DataGrid v5→v8 migration.
 *
 * ROOT CAUSE: "R.ids is not iterable" error is caused by malformed
 * rowSelection state persisted from v5 that v8 can't handle.
 *
 * This utility runs on app start to prevent grid crashes.
 */

/**
 * Clean up all grid-related localStorage entries that might have
 * corrupted state from v5→v8 migration.
 *
 * Specifically targets:
 * - Malformed rowSelection state (causes "R.ids is not iterable")
 * - Invalid column state structures
 * - Corrupt filter models
 */
export function cleanupGridStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return { cleaned: 0, errors: [] };
  }

  let cleaned = 0;
  const errors = [];

  try {
    // Get all localStorage keys
    const keys = Object.keys(window.localStorage);

    // Find all grid-related keys (format: "lrp:grid:*")
    const gridKeys = keys.filter((key) => key.startsWith("lrp:grid:"));

    gridKeys.forEach((key) => {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return;

        const parsed = JSON.parse(raw);

        // Check for malformed state
        let needsCleanup = false;

        // 1. Check for rowSelection (v5 artifact, causes v8 crashes)
        if ("rowSelection" in parsed) {
          needsCleanup = true;
          delete parsed.rowSelection;
        }

        // 2. Check for malformed columnVisibilityModel
        if (parsed.columnVisibilityModel !== undefined) {
          if (
            typeof parsed.columnVisibilityModel !== "object" ||
            Array.isArray(parsed.columnVisibilityModel)
          ) {
            needsCleanup = true;
            parsed.columnVisibilityModel = {};
          }
        }

        // 3. Check for invalid density values
        if (parsed.density !== undefined) {
          if (typeof parsed.density === "object") {
            // Extract value if it's wrapped in an object
            parsed.density = parsed.density?.value || "compact";
            needsCleanup = true;
          }
          if (
            !["compact", "standard", "comfortable"].includes(parsed.density)
          ) {
            parsed.density = "compact";
            needsCleanup = true;
          }
        }

        // 4. If we found issues, either clean and save, or remove entirely
        if (needsCleanup) {
          // Check if the cleaned state is still valid
          const isValidState =
            parsed.density && typeof parsed.columnVisibilityModel === "object";

          if (isValidState) {
            // Save cleaned state
            window.localStorage.setItem(key, JSON.stringify(parsed));
          } else {
            // Remove corrupted entry entirely
            window.localStorage.removeItem(key);
          }
          cleaned++;
        }
      } catch {
        // If we can't parse/fix it, remove it
        try {
          window.localStorage.removeItem(key);
          cleaned++;
        } catch (removeError) {
          errors.push({
            key,
            error: removeError.message,
          });
        }
      }
    });

    return { cleaned, errors };
  } catch (error) {
    return {
      cleaned,
      errors: [{ key: "global", error: error.message }],
    };
  }
}

/**
 * Run cleanup and log results (dev mode only)
 */
export function cleanupGridStorageWithLogging() {
  const result = cleanupGridStorage();

  if (result.cleaned > 0 || result.errors.length > 0) {
    // eslint-disable-next-line no-console
    console.log("[GridStorage] Cleanup completed:", {
      cleaned: result.cleaned,
      errors: result.errors,
    });
  }

  return result;
}
