/* Proprietary and confidential. See LICENSE. */
import logError from "@/utils/logError.js";

const listeners = new Map();

export function on(event, fn) {
  const current = listeners.get(event) || [];
  if (!current.includes(fn)) {
    current.push(fn);
    listeners.set(event, current);
  }
  return () => {
    const next = (listeners.get(event) || []).filter((listener) => listener !== fn);
    listeners.set(event, next);
  };
}

export function emit(event, payload) {
  (listeners.get(event) || []).forEach((fn) => {
    try {
      fn(payload);
    } catch (error) {
      logError(error, { where: "uiBus", event });
    }
  });
}

export function openTimeClockModal() {
  emit("OPEN_TIME_CLOCK");
}

export function requestClockOut() {
  emit("CLOCK_OUT_REQUEST");
}
