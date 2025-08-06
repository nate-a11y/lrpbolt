import { logRequest } from "./apiMonitor";
import { logError } from "./logError";

export async function fetchWithRetry(
  url,
  options = {},
  retries = 3,
  retryDelay = 1000,
) {
  let attempt = 0;
  let lastError;
  while (attempt <= retries) {
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await waitForOnline();
      }
      logRequest(options?.method || "GET", url);
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      lastError = err;
      logError(err, "fetchWithRetry");
      attempt += 1;
      if (attempt > retries) break;
      await waitForOnline();
      await new Promise((r) => setTimeout(r, retryDelay));
    }
  }
  throw lastError;
}

function waitForOnline() {
  if (typeof navigator === "undefined" || navigator.onLine)
    return Promise.resolve();
  return new Promise((resolve) => {
    const handler = () => {
      window.removeEventListener("online", handler);
      resolve();
    };
    window.addEventListener("online", handler);
  });
}
