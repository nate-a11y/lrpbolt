/* Proprietary and confidential. See LICENSE. */
import logError from "./logError.js";

const STORAGE_KEY = "lrp:debug:eruda";
const QUERY_KEY = "eruda";
const INIT_FLAG = "__LRP_ERUDA__";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function parseBooleanFlag(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return undefined;
}

function readEnvFlag() {
  return parseBooleanFlag(import.meta?.env?.VITE_ENABLE_ERUDA);
}

function readStoredFlag() {
  try {
    return parseBooleanFlag(window.localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    logError(error, { scope: "initEruda:storage-read" });
    return undefined;
  }
}

function writeStoredFlag(value) {
  try {
    if (value === undefined) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch (error) {
    logError(error, { scope: "initEruda:storage-write" });
  }
}

function readQueryFlag() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get(QUERY_KEY);
    const parsed = parseBooleanFlag(raw);
    if (parsed !== undefined) {
      writeStoredFlag(parsed);
    }
    return parsed;
  } catch (error) {
    logError(error, { scope: "initEruda:query" });
    return undefined;
  }
}

function shouldEnableEruda() {
  if (typeof window === "undefined") return false;

  const envFlag = readEnvFlag();
  if (envFlag !== undefined) return envFlag;

  const queryFlag = readQueryFlag();
  if (queryFlag !== undefined) return queryFlag;

  const storedFlag = readStoredFlag();
  if (storedFlag !== undefined) return storedFlag;

  return Boolean(import.meta?.env?.DEV);
}

export default function initEruda() {
  if (typeof window === "undefined") return;
  if (window[INIT_FLAG]) return;

  const enable = shouldEnableEruda();
  if (!enable) return;

  window[INIT_FLAG] = true;

  import("eruda")
    .then((module) => {
      const eruda = module?.default || module;
      if (!eruda) {
        throw new Error("Failed to load eruda");
      }
      eruda.init({
        defaults: {
          displaySize: 60,
          transparency: 0.92,
          theme: "Monokai",
        },
      });
    })
    .catch((error) => {
      window[INIT_FLAG] = false;
      logError(error, { scope: "initEruda:init" });
    });
}
