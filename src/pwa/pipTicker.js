/* Proprietary and confidential. See LICENSE. */
import { alpha } from "@mui/material/styles";

import getTheme from "@/theme";

let pipWindow = null;

const themeCache = new Map();

const getColorMode = () => {
  if (typeof document === "undefined") return "dark";
  const attr = document.documentElement?.getAttribute("data-color-mode");
  return attr === "light" ? "light" : "dark";
};

const getPipTheme = () => {
  const mode = getColorMode();
  let theme = themeCache.get(mode);
  if (!theme) {
    theme = getTheme(mode);
    themeCache.set(mode, theme);
  }
  return theme;
};

export function isPiPSupported() {
  return (
    !!window.documentPictureInPicture || !!document.pictureInPictureEnabled
  );
}
export function isPiPActive() {
  try {
    if (window.documentPictureInPicture && pipWindow && !pipWindow.closed)
      return true;
    if (document.pictureInPictureElement) return true;
  } catch (e) {
    console.error("[pipTicker] isPiPActive check failed", e);
  }
  return false;
}

/**
 * Start PiP with label and a start epoch (ms). The PiP window will self-tick at 1 Hz.
 */
export async function startClockPiP(labelText, startMs) {
  try {
    if (window.documentPictureInPicture) {
      if (!pipWindow || pipWindow.closed) {
        pipWindow = await window.documentPictureInPicture.requestWindow({
          width: 300,
          height: 100,
        });
        renderDocPiP(pipWindow.document, labelText, startMs);
      }
      updateDocPiP(pipWindow.document, labelText, startMs);
      return true;
    }
    await ensureVideoPiP(labelText, startMs); // canvas fallback
    return !!document.pictureInPictureElement;
  } catch (e) {
    console.error("[pipTicker] start failed", e);
    return false;
  }
}

export async function updateClockPiP(labelText, startMs) {
  try {
    if (!isPiPActive()) return false;
    if (window.documentPictureInPicture && pipWindow && !pipWindow.closed) {
      updateDocPiP(pipWindow.document, labelText, startMs);
      return true;
    }
    await ensureVideoPiP(labelText, startMs);
    return !!document.pictureInPictureElement;
  } catch (e) {
    console.error("[pipTicker] update failed", e);
    return false;
  }
}

export function stopClockPiP() {
  try {
    if (pipWindow && !pipWindow.closed) {
      try {
        pipWindow.__lrpStop && pipWindow.__lrpStop();
      } catch (e) {
        console.error(e);
      }
      pipWindow.close();
      pipWindow = null;
    }
    const video = document.getElementById("lrp-clock-pip-video");
    if (video && document.pictureInPictureElement === video) {
      try {
        if (video.__lrpTimer) clearInterval(video.__lrpTimer);
      } catch (err) {
        console.error("[pipTicker] clear video timer failed", err);
      }
      document.exitPictureInPicture().catch(() => {});
    }
  } catch (e) {
    console.error("[pipTicker] stop failed", e);
  }
}

/* ---------- Document PiP (interactive) ---------- */
function renderDocPiP(doc, labelText, startMs) {
  const theme = getPipTheme();
  const { palette } = theme;
  const buttonBg =
    palette.mode === "dark"
      ? alpha(palette.common.white, 0.08)
      : alpha(palette.common.black, 0.04);
  const buttonHoverBg =
    palette.mode === "dark"
      ? alpha(palette.common.white, 0.14)
      : alpha(palette.common.black, 0.08);

  doc.body.style.cssText = `margin:0;background:${palette.background.paper};color:${palette.text.primary};font-family:system-ui,Segoe UI,Roboto,Arial`;

  const wrap = doc.createElement("div");
  wrap.style.cssText =
    "display:flex;align-items:center;gap:10px;padding:10px 12px;";

  const dot = doc.createElement("div");
  dot.style.cssText = `width:12px;height:12px;border-radius:50%;background:${palette.primary.main};flex:0 0 auto;`;

  const txt = doc.createElement("div");
  txt.id = "lrp-pip-text";
  txt.style.cssText = `color:${palette.text.primary};font-weight:700;font-size:13px;white-space:nowrap;letter-spacing:.2px`;

  const spacer = doc.createElement("div");
  spacer.style.cssText = "flex:1 1 auto";

  const btnWrap = doc.createElement("div");
  btnWrap.style.cssText = "display:flex;gap:6px";

  const btn = (label) => {
    const b = doc.createElement("button");
    b.textContent = label;
    b.style.cssText = `background:${buttonBg};border:1px solid ${palette.divider};color:${palette.text.primary};border-radius:999px;padding:4px 8px;font-weight:600;font-size:12px;cursor:pointer`;
    b.onmouseenter = () => (b.style.background = buttonHoverBg);
    b.onmouseleave = () => (b.style.background = buttonBg);
    return b;
  };

  const openBtn = btn("Open");
  const stopBtn = btn("Clock Out");

  // Broadcast actions back to the app
  const send = (type) => {
    try {
      if (!("BroadcastChannel" in doc.defaultView)) return;
      const ch = new doc.defaultView.BroadcastChannel("lrp-clock-actions");
      ch.postMessage({ type });
      // close channel after post (no listeners needed here)
      setTimeout(() => {
        try {
          ch.close();
        } catch (err) {
          console.error("[pipTicker] PiP channel close failed", err);
        }
      }, 100);
    } catch (err) {
      console.error("[pipTicker] PiP channel send failed", err);
    }
  };
  openBtn.onclick = () => send("open");
  stopBtn.onclick = () => send("clockout");

  btnWrap.appendChild(openBtn);
  btnWrap.appendChild(stopBtn);

  wrap.appendChild(dot);
  wrap.appendChild(txt);
  wrap.appendChild(spacer);
  wrap.appendChild(btnWrap);
  doc.body.appendChild(wrap);

  // self-ticking timer
  const win = doc.defaultView;
  const startEpoch = Number(startMs) || Date.now();
  function fmt(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${ss}s`;
    return `${ss}s`;
  }
  function tick() {
    const elapsed = Date.now() - (win.__lrpStartAt || startEpoch);
    const base = String(win.__lrpLabel || labelText || "On the clock");
    const el = doc.getElementById("lrp-pip-text");
    if (el) el.textContent = `${base} • ${fmt(elapsed)}`;
  }
  tick();
  win.__lrpTimer && clearInterval(win.__lrpTimer);
  win.__lrpTimer = win.setInterval(tick, 1000);
  win.__lrpStop = () => {
    try {
      win.__lrpTimer && clearInterval(win.__lrpTimer);
    } catch (e) {
      console.error(e);
    }
    win.__lrpTimer = null;
  };
}

function updateDocPiP(doc, labelText, startMs) {
  try {
    const win = doc.defaultView;
    if (typeof labelText === "string" && labelText.length)
      win.__lrpLabel = labelText;
    if (startMs) win.__lrpStartAt = Number(startMs);
  } catch (err) {
    console.error("[pipTicker] PiP update failed", err);
  }
  const el = doc.getElementById("lrp-pip-text");
  if (el && typeof labelText === "string" && labelText.length) {
    el.textContent = `${labelText} • …`;
  }
}

/* ---------- Canvas/video fallback (non-interactive) ---------- */
async function ensureVideoPiP(labelText, startMs) {
  let video = document.getElementById("lrp-clock-pip-video");
  if (!video) {
    video = document.createElement("video");
    video.id = "lrp-clock-pip-video";
    video.muted = true;
    video.playsInline = true;
    video.style.display = "none";
    document.body.appendChild(video);
  }
  if (!video.srcObject) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    // DPR-aware canvas for crisp text
    const DPR = window.devicePixelRatio || 1;
    const w = 300,
      h = 100;
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.scale(DPR, DPR);

    function draw() {
      const base = String(labelText || "On the clock");
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - (Number(startMs) || Date.now())) / 1000),
      );
      const h_ = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      const t = h_ > 0 ? `${h_}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;

      ctx.clearRect(0, 0, w, h);
      const { palette } = getPipTheme();
      ctx.fillStyle = palette.background.paper;
      ctx.fillRect(0, 0, w, h);

      // green dot
      ctx.fillStyle = palette.primary.main;
      ctx.beginPath();
      ctx.arc(18, 50, 8, 0, Math.PI * 2);
      ctx.fill();

      // crisp white text
      ctx.fillStyle = palette.text.primary;
      ctx.font = "700 20px system-ui,Segoe UI,Roboto,Arial";
      ctx.textBaseline = "middle";
      ctx.fillText(`${base} • ${t}`, 36, 50);
    }

    draw();
    const timer = setInterval(draw, 1000);
    const stream = canvas.captureStream();
    video.srcObject = stream;
    try {
      await video.play();
    } catch (err) {
      console.error("[pipTicker] video play failed", err);
    }
    video.__lrpTimer = timer;
  }
  if (document.pictureInPictureEnabled && video.requestPictureInPicture) {
    if (document.pictureInPictureElement !== video) {
      await video.requestPictureInPicture();
    }
  }
}
