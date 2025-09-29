/* Proprietary and confidential. See LICENSE. */
import logError from "@/utils/logError.js";

let pipWindow = null;

function hasDocumentPiP() {
  return typeof window !== "undefined" && Boolean(window.documentPictureInPicture);
}

function ensureDocument() {
  if (typeof document === "undefined") {
    throw new Error("document is not available");
  }
  return document;
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

export async function startClockPiP(text) {
  try {
    if (!isPiPSupported()) return false;
    if (hasDocumentPiP()) {
      if (!pipWindow || pipWindow.closed) {
        pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 260,
          height: 68,
        });
        renderDocPiP(pipWindow.document);
      }
      updateDocPiP(pipWindow.document, text);
      return true;
    }
    await ensureVideoPiP(text);
    return isPiPActive();
  } catch (error) {
    logError(error, { where: "pipTicker", action: "start" });
    return false;
  }
}

export async function updateClockPiP(text) {
  try {
    if (!isPiPActive()) return false;
    if (hasDocumentPiP() && pipWindow && !pipWindow.closed) {
      updateDocPiP(pipWindow.document, text);
      return true;
    }
    await ensureVideoPiP(text);
    return isPiPActive();
  } catch (error) {
    logError(error, { where: "pipTicker", action: "update" });
    return false;
  }
}

export function stopClockPiP() {
  try {
    if (pipWindow && !pipWindow.closed) {
      pipWindow.close();
      pipWindow = null;
    }
    const doc = ensureDocument();
    const video = doc.getElementById("lrp-clock-pip-video");
    if (video && doc.pictureInPictureElement === video) {
      doc.exitPictureInPicture().catch((error) => {
        logError(error, { where: "pipTicker", action: "exitPiP" });
      });
    }
  } catch (error) {
    logError(error, { where: "pipTicker", action: "stop" });
  }
}

function renderDocPiP(doc) {
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
  text.style.cssText = "color:#fff;font-weight:700;font-size:13px;white-space:nowrap;";
  text.textContent = "On the clock…";
  wrapper.appendChild(dot);
  wrapper.appendChild(text);
  doc.body.appendChild(wrapper);
}

function updateDocPiP(doc, text) {
  if (!doc) return;
  const el = doc.getElementById("lrp-pip-text");
  if (el) {
    el.textContent = `On the clock • ${String(text || "")}`;
  }
}

async function ensureVideoPiP(text) {
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
  if (!video.srcObject) {
    const canvas = doc.createElement("canvas");
    canvas.width = 640;
    canvas.height = 100;
    const ctx = canvas.getContext("2d");
    const draw = () => {
      ctx.fillStyle = "#0b0b0b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#4cbb17";
      ctx.beginPath();
      ctx.arc(28, 50, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 28px system-ui,Segoe UI,Roboto,Arial";
      ctx.fillText(`On the clock • ${String(text || "")}`, 56, 58);
    };
    draw();
    const stream = canvas.captureStream();
    video.srcObject = stream;
    try {
      await video.play();
    } catch (error) {
      logError(error, { where: "pipTicker", action: "videoPlay" });
    }
  }
  if (doc.pictureInPictureEnabled && video.requestPictureInPicture) {
    if (doc.pictureInPictureElement !== video) {
      await video.requestPictureInPicture();
    }
  }
}
