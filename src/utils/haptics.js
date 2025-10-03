function vibrate(pattern) {
  try {
    if (
      typeof window === "undefined" ||
      !("navigator" in window) ||
      typeof window.navigator?.vibrate !== "function"
    ) {
      return;
    }
    window.navigator.vibrate(pattern);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("[haptics] vibrate failed", error);
    }
  }
}

export function vibrateOk() {
  vibrate(40);
}

export function vibrateWarn() {
  vibrate([60, 30, 60]);
}

export default {
  vibrateOk,
  vibrateWarn,
};
