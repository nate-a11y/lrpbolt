import { logEvent, setUserProperties } from "firebase/analytics";

import { initAnalyticsIfEnabled } from "@/utils/firebaseInit";
import { env } from "@/utils/env";

let analyticsInstance = null;
let initialized = false;

// Some sites include GTM/gtag. Prevent double "config" noise and GA /g/collect spam.
function configureGtagOnce() {
  if (typeof window === "undefined") return;
  if (!window.gtag) return;
  // Ensure we don't auto-send page_view twice if GTM also does it
  if (env.FIREBASE.MEASUREMENT_ID) {
    window.gtag("config", env.FIREBASE.MEASUREMENT_ID, {
      send_page_view: false,
    });
  }
  if (env.GA_MEASUREMENT_ID) {
    window.gtag("config", env.GA_MEASUREMENT_ID, { send_page_view: false });
  }
}

export async function initAnalytics() {
  if (initialized) return analyticsInstance;

  try {
    const analytics = await initAnalyticsIfEnabled?.();
    if (!analytics) return null;
    analyticsInstance = analytics;
    configureGtagOnce();
    initialized = true;
    return analyticsInstance;
  } catch (e) {
    // Soft-fail: do not spam console on adblock/network issues
    console.warn("[Analytics] init skipped:", e?.message || e);
    return null;
  }
}

// Call this on route change AFTER initAnalytics()
export async function trackPageView(path) {
  const a = await initAnalytics();
  if (!a) return;
  try {
    if (typeof window === "undefined") return;
    logEvent(a, "page_view", {
      page_location: window.location.origin + path,
      page_path: path,
    });
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[Analytics] page_view skipped", error?.message || error);
    }
  }
}

export async function setAnalyticsUser(props) {
  const a = await initAnalytics();
  if (!a) return;
  try {
    setUserProperties(a, props || {});
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(
        "[Analytics] setUserProperties skipped",
        error?.message || error,
      );
    }
  }
}
