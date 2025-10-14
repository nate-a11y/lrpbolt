import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
} from "firebase/auth";

import { auth } from "../utils/firebaseInit";
import logError from "../utils/logError.js";

const provider = new GoogleAuthProvider();

function shouldUseRedirect(force) {
  if (force) return true;
  const envForce = String(import.meta.env.VITE_AUTH_FORCE_REDIRECT || "")
    .toLowerCase()
    .trim();
  if (envForce === "true") return true;
  if (typeof window !== "undefined") {
    return Boolean(window.crossOriginIsolated);
  }
  return false;
}

function isPopupRecoverable(code) {
  if (!code) return false;
  const normalized = String(code).toLowerCase();
  return (
    normalized.includes("popup-blocked") ||
    normalized.includes("popup-closed-by-user") ||
    normalized.includes("cancelled-popup-request") ||
    normalized.includes("auth/internal-error")
  );
}

// --- Auth flows ---
export async function loginWithPopup(options = {}) {
  const force = shouldUseRedirect(options?.forceRedirect);
  if (force) {
    try {
      return await signInWithRedirect(auth, provider);
    } catch (err) {
      logError(err, { where: "auth.loginWithRedirect", reason: "forced" });
      throw err;
    }
  }
  try {
    return await signInWithPopup(auth, provider);
  } catch (err) {
    const code = err?.code || "";
    if (isPopupRecoverable(code)) {
      logError(err, { where: "auth.loginWithPopup", reason: "popup_failed" });
      try {
        return await signInWithRedirect(auth, provider);
      } catch (redirectErr) {
        logError(redirectErr, {
          where: "auth.loginWithRedirect",
          reason: "fallback",
        });
        throw redirectErr;
      }
    }
    logError(err, { where: "auth.loginWithPopup" });
    throw err;
  }
}

export function loginWithRedirect() {
  return signInWithRedirect(auth, provider);
}

export function signInWithGoogle(options = {}) {
  return loginWithPopup(options);
}

export function handleRedirectResult() {
  return getRedirectResult(auth);
}

export function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(name, email, password) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) {
    await updateProfile(cred.user, { displayName: name });
  }
  return cred.user;
}

export function sendPasswordReset(email) {
  return sendPasswordResetEmail(auth, email);
}

export function logout() {
  return firebaseSignOut(auth);
}

export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUserId() {
  return auth?.currentUser?.uid || null;
}
