/* Proprietary and confidential. See LICENSE. */
import logError from "@/utils/logError.js";

let pipWindow = null;

const DEFAULT_LABEL = "On the clock";
const TICK_INTERVAL_MS = 1000;

function hasDocumentPiP() {
  return (
    typeof window !== "undefined" && Boolean(window.documentPictureInPicture)
  );
}

function ensureDocument() {
  if (typeof document === "undefined") {
    throw new Error("document is not available");
  }
  return document;
}

function resolveLabel(value) {
  return typeof value === "string" && value.length ? value : DEFAULT_LABEL;
}

function resolveStart(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Date.now();
}

export function isPiPSupported() {
  try {
    if (hasDocumentPiP()) return true;
    const doc = ensureDocument();
    return Boolean(doc.pictureInPictureEnabled);
  } catch (error) {
    logError(error, { where: "pipTicker", action: "isSupported" });
    return false;
  }
}

export function isPiPActive() {
  try {
    if (hasDocumentPiP() && pipWindow && !pipWindow.closed) return true;
    const doc = ensureDocument();
    return Boolean(doc.pictureInPictureElement);
  } catch (error) {
    logError(error, { where: "pipTicker", action: "isActive" });
    return false;
  }
}

export async function startClockPiP(labelText, startMs) {
  try {
    if (!isPiPSupported()) return false;
    if (hasDocumentPiP()) {
      if (!pipWindow || pipWindow.closed) {
        pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 260,
          height: 68,
        });
        renderDocPiP(pipWindow.document, labelText, startMs);
      }
      updateDocPiP(pipWindow.document, labelText, startMs);
      return true;
    }
    await ensureVideoPiP(labelText, startMs);
    return isPiPActive();
  } catch (error) {
    logError(error, { where: "pipTicker", action: "start" });
    return false;
  }
}

export async function updateClockPiP(labelText, startMs) {
  try {
    if (!isPiPActive()) return false;
    if (hasDocumentPiP() && pipWindow && !pipWindow.closed) {
      updateDocPiP(pipWindow.document, labelText, startMs);
      return true;
    }
    await ensureVideoPiP(labelText, startMs);
    return isPiPActive();
  } catch (error) {
    logError(error, { where: "pipTicker", action: "update" });
    return false;
  }
}

export function stopClockPiP() {
  try {
    if (pipWindow && !pipWindow.closed) {
      try {
        if (typeof pipWindow.__lrpStop === "function") {
          pipWindow.__lrpStop();
        }
      } catch (error) {
        logError(error, { where: "pipTicker", action: "docStop" });
      }
    }
    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
    }
    pipWindow = null;
    const doc = ensureDocument();
    const video = doc.getElementById("lrp-clock-pip-video");
    if (video && video.__lrpTimer) {
      clearInterval(video.__lrpTimer);
      video.__lrpTimer = null;
    }
    if (video && doc.pictureInPictureElement === video) {
      doc.exitPictureInPicture().catch((error) => {
        logError(error, { where: "pipTicker", action: "exitPiP" });
      });
    }
  } catch (error) {
    logError(error, { where: "pipTicker", action: "stop" });
  }
}

function renderDocPiP(doc, labelText, startMs) {
  if (!doc) return;
  doc.body.style.margin = "0";
  doc.body.style.background = "#0b0b0b";
  const wrapper = doc.createElement("div");
  wrapper.style.cssText =
    "display:flex;align-items:center;gap:8px;padding:10px 12px;font-family:system-ui,Segoe UI,Roboto,Arial";
  const dot = doc.createElement("div");
  dot.style.cssText =
    "width:14px;height:14px;border-radius:50%;background:#4cbb17;flex:0 0 auto;";
  const text = doc.createElement("div");
  text.id = "lrp-pip-text";
  text.style.cssText =
    "color:#fff;font-weight:700;font-size:13px;white-space:nowrap;";
  text.textContent = "On the clock…";
  wrapper.appendChild(dot);
  wrapper.appendChild(text);
  doc.body.appendChild(wrapper);

  const win = doc.defaultView;
  if (!win) return;
  win.__lrpLabel = resolveLabel(labelText);
  win.__lrpStartAt = resolveStart(startMs);

  const formatElapsed = (ms) => {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const tick = () => {
    try {
      const label = resolveLabel(win.__lrpLabel);
      const startValue = resolveStart(win.__lrpStartAt);
      const elapsed = Date.now() - startValue;
      const el = doc.getElementById("lrp-pip-text");
      if (el) {
        el.textContent = `${label} • ${formatElapsed(elapsed)}`;
      }
    } catch (error) {
      logError(error, { where: "pipTicker", action: "docTick" });
    }
  };

  if (typeof win.__lrpTimer === "number") {
    if (typeof win.clearInterval === "function") {
      win.clearInterval(win.__lrpTimer);
    } else {
      clearInterval(win.__lrpTimer);
    }
  }

  tick();
  if (typeof win.setInterval === "function") {
    win.__lrpTimer = win.setInterval(tick, TICK_INTERVAL_MS);
  } else {
    win.__lrpTimer = setInterval(tick, TICK_INTERVAL_MS);
  }
  win.__lrpTick = tick;
  win.__lrpStop = () => {
    try {
      if (typeof win.__lrpTimer === "number") {
        if (typeof win.clearInterval === "function") {
          win.clearInterval(win.__lrpTimer);
        } else {
          clearInterval(win.__lrpTimer);
        }
      }
    } catch (error) {
      logError(error, { where: "pipTicker", action: "docTimerClear" });
    } finally {
      win.__lrpTimer = null;
    }
  };
}

function updateDocPiP(doc, labelText, startMs) {
  if (!doc) return;
  try {
    const win = doc.defaultView;
    if (!win) return;
    if (typeof labelText === "string" && labelText.length) {
      win.__lrpLabel = labelText;
    }
    if (startMs !== undefined && startMs !== null) {
      const numeric = Number(startMs);
      if (Number.isFinite(numeric)) {
        win.__lrpStartAt = numeric;
      }
    }
    if (typeof win.__lrpTick === "function") {
      win.__lrpTick();
    }
  } catch (error) {
    logError(error, { where: "pipTicker", action: "docUpdate" });
  }
}

async function ensureVideoPiP(labelText, startMs) {
  const doc = ensureDocument();
  let video = doc.getElementById("lrp-clock-pip-video");
  if (!video) {
    video = doc.createElement("video");
    video.id = "lrp-clock-pip-video";
    video.muted = true;
    video.playsInline = true;
    video.style.display = "none";
    doc.body.appendChild(video);
  }

  video.__lrpLabel = resolveLabel(labelText);
  video.__lrpStartAt = resolveStart(startMs);

  const draw = () => {
    try {
      const ctx = video.__lrpCtx;
      if (!ctx) return;
      const canvas = ctx.canvas;
      const now = Date.now();
      const elapsed = Math.max(0, now - resolveStart(video.__lrpStartAt));
      const seconds = Math.floor(elapsed / 1000);
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = seconds % 60;
      const formatted =
        hours > 0
          ? `${hours}h ${minutes}m`
          : minutes > 0
            ? `${minutes}m ${secs}s`
            : `${secs}s`;
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#4cbb17";
      ctx.beginPath();
      ctx.arc(28, 50, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 28px system-ui,Segoe UI,Roboto,Arial";
      ctx.fillText(`${resolveLabel(video.__lrpLabel)} • ${formatted}`, 56, 58);
    } catch (error) {
      logError(error, { where: "pipTicker", action: "videoDraw" });
    }
  };

  if (!video.srcObject) {
    const canvas = doc.createElement("canvas");
    canvas.width = 640;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    video.__lrpCtx = ctx;
    draw();
    if (video.__lrpTimer) {
      clearInterval(video.__lrpTimer);
    }
    video.__lrpTimer = setInterval(draw, TICK_INTERVAL_MS);
    const stream = canvas.captureStream();
    video.srcObject = stream;
    try {
      await video.play();
    } catch (error) {
      logError(error, { where: "pipTicker", action: "videoPlay" });
    }
  } else {
    if (!video.__lrpTimer) {
      video.__lrpTimer = setInterval(draw, TICK_INTERVAL_MS);
    }
    draw();
  }

  if (doc.pictureInPictureEnabled && video.requestPictureInPicture) {
    if (doc.pictureInPictureElement !== video) {
      await video.requestPictureInPicture();
    }
  }
}
