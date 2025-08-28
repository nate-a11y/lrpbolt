/* Proprietary and confidential. See LICENSE. */
import {
  getAnalytics,
  isSupported,
  logEvent,
  setAnalyticsCollectionEnabled,
} from "firebase/analytics";

import { app } from "./firebaseInit";

// Global guard (survives module HMR; avoids StrictMode double-mount)
const GA_KEY = "__LRP_GA_INIT__";
const LAST_PV_KEY = "__LRP_LAST_PV__";

let analyticsInstance = null;

export async function initAnalytics() {
  if (import.meta.env.DEV) {
    // Disable in dev to prevent noise
    window[GA_KEY] = "dev-disabled";
    return null;
  }
  if (window[GA_KEY]) return analyticsInstance;

  try {
    if (!(await isSupported())) return null;
    analyticsInstance = getAnalytics(app);
    setAnalyticsCollectionEnabled(analyticsInstance, true);
    window[GA_KEY] = "ok";
    return analyticsInstance;
  } catch {
    window[GA_KEY] = "failed";
    return null;
  }
}

/**
 * Log a page_view ONLY when route actually changes.
 * Debounced: min 1s between page_views to avoid rapid loops.
 */
export function trackPageView(path, title = document.title) {
  try {
    if (!analyticsInstance || window[GA_KEY] === "dev-disabled") return;
    const now = Date.now();
    const last = window[LAST_PV_KEY] || { path: "", t: 0 };
    const minInterval = 1000; // 1s debounce

    if (last.path === path && now - last.t < minInterval) return;

    logEvent(analyticsInstance, "page_view", {
      page_location: window.location.href,
      page_path: path,
      page_title: title,
    });

    window[LAST_PV_KEY] = { path, t: now };
  } catch {
    // no-op
  }
}

/** Safe event logger with optional sampling to avoid floods */
export function trackEvent(name, params = {}, sample = 1.0) {
  try {
    if (!analyticsInstance || window[GA_KEY] === "dev-disabled") return;
    if (sample < 1 && Math.random() > sample) return;
    logEvent(analyticsInstance, name, params);
  } catch {
    // no-op
  }
}
