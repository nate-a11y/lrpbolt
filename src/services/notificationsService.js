/* Proprietary and confidential. See LICENSE. */
/* LRP notification service for ride state changes. */
import logError from "@/utils/logError.js";

const DEFAULT_API_BASE = "https://lakeridepros.xyz";
const API_BASE =
  typeof import.meta !== "undefined" && import.meta?.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : DEFAULT_API_BASE;

const ENDPOINT_BY_TYPE = Object.freeze({
  claim: "/notifyClaim",
  live: "/notifyLive",
});

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  });

  if (!response.ok) {
    throw new Error(`Notification failed: ${response.status}`);
  }

  try {
    return await response.json();
  } catch (err) {
    logError(err, { where: "notifyRideEvent.parse", url });
    return null;
  }
}

export async function notifyRideEvent(type, payload = {}) {
  const endpoint = ENDPOINT_BY_TYPE[type];
  if (!endpoint) return null;

  const url = `${API_BASE.replace(/\/$/, "")}${endpoint}`;

  try {
    return await postJson(url, payload);
  } catch (error) {
    logError(error, { where: "notifyRideEvent", type, payload });
    return null;
  }
}

export function playFeedbackSound() {
  try {
    if (typeof window === "undefined") return;

    const audioPath = "/sounds/success.mp3";
    const audio = typeof Audio === "function" ? new Audio(audioPath) : null;

    if (audio) {
      audio.volume = 0.5;
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => {
          logError(err, { where: "playFeedbackSound.play", audioPath });
        });
      }
    }

    if (
      typeof navigator !== "undefined" &&
      typeof navigator.vibrate === "function"
    ) {
      navigator.vibrate(120);
    }
  } catch (error) {
    logError(error, { where: "playFeedbackSound" });
  }
}
