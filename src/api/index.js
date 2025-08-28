/* Proprietary and confidential. See LICENSE. */
// src/api/index.js

import { httpsCallable } from "firebase/functions";

import { logRequest } from "../utils/apiMonitor";
import { functions } from "../utils/functions";
import logError from "../utils/logError.js";

/**
 * Fetch wrapper with timeout and optional retries.
 * @param {string} url
 * @param {object} opts
 * @param {number} opts.timeout - timeout in ms
 * @param {number} opts.retries - number of retry attempts
 * @param {'json'|'text'} opts.responseType - expected response type
 */
export async function apiFetch(
  url,
  { timeout = 10000, retries = 0, responseType = "json", ...options } = {},
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      logRequest(options.method || "GET", url);
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return responseType === "text" ? await res.text() : await res.json();
    } catch (err) {
      if (attempt === retries) {
        logError(err, "apiFetch");
        throw err;
      }
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Call a Firebase Cloud Function with standard error handling.
 * @param {string} name
 * @param {any} data
 */
export async function callFunction(name, data) {
  logRequest("POST", `function:${name}`);
  const callable = httpsCallable(functions, name);
  const result = await callable(data);
  return result.data;
}
