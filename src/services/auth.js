import { auth } from "../firebase/config";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from "firebase/auth";

const provider = new GoogleAuthProvider();

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

export function logout() {
  return firebaseSignOut(auth);
}

export function subscribeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

