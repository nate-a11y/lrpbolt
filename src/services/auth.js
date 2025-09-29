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

const provider = new GoogleAuthProvider();

// --- Auth flows ---
export function loginWithPopup() {
  return signInWithPopup(auth, provider);
}

export function loginWithRedirect() {
  return signInWithRedirect(auth, provider);
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
