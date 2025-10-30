/**
 * App Settings Service
 * Manages application-wide settings stored in Firestore
 */

import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

import { db } from "@/services/firebase.js";
import logError from "@/utils/logError.js";

const SETTINGS_COLLECTION = "appSettings";
const AI_SETTINGS_DOC = "aiContentGenerator";

/**
 * Get AI settings from Firestore
 * @returns {Promise<Object>} AI settings object
 */
export async function getAISettings() {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, AI_SETTINGS_DOC);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data();
    }

    // Return default settings if not configured
    return {
      provider: "openai",
      apiKey: "",
      model: "gpt-4o-mini",
      enabled: false,
    };
  } catch (err) {
    logError(err, { where: "appSettingsService.getAISettings" });
    // Return default settings on error
    return {
      provider: "openai",
      apiKey: "",
      model: "gpt-4o-mini",
      enabled: false,
    };
  }
}

/**
 * Save AI settings to Firestore
 * @param {Object} settings - AI settings to save
 * @returns {Promise<boolean>} Success status
 */
export async function saveAISettings(settings) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, AI_SETTINGS_DOC);
    await setDoc(
      docRef,
      {
        ...settings,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    return true;
  } catch (err) {
    logError(err, { where: "appSettingsService.saveAISettings" });
    return false;
  }
}

/**
 * Subscribe to AI settings changes in real-time
 * @param {Function} callback - Called when settings change
 * @returns {Function} Unsubscribe function
 */
export function subscribeToAISettings(callback) {
  const docRef = doc(db, SETTINGS_COLLECTION, AI_SETTINGS_DOC);

  const unsubscribe = onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data());
      } else {
        // Return default settings if not configured
        callback({
          provider: "openai",
          apiKey: "",
          model: "gpt-4o-mini",
          enabled: false,
        });
      }
    },
    (err) => {
      logError(err, { where: "appSettingsService.subscribeToAISettings" });
      // Return default settings on error
      callback({
        provider: "openai",
        apiKey: "",
        model: "gpt-4o-mini",
        enabled: false,
      });
    },
  );

  return unsubscribe;
}

/**
 * Check if AI is configured and ready to use
 * @returns {Promise<boolean>}
 */
export async function isAIConfigured() {
  const settings = await getAISettings();
  return settings.enabled && settings.apiKey && settings.apiKey.length > 0;
}
