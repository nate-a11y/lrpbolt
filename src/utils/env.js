// Centralized, null-safe env getters
export const env = {
  FIREBASE: {
    API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    MESSAGING_SENDER_ID:
      import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      import.meta.env.VITE_FIREBASE_SENDER_ID,
    APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    MEASUREMENT_ID:
      import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ||
      import.meta.env.VITE_GA_MEASUREMENT_ID,
  },
  GA_MEASUREMENT_ID: import.meta.env.VITE_GA_MEASUREMENT_ID,
  FCM_VAPID_KEY:
    import.meta.env.VITE_FCM_VAPID_KEY ||
    import.meta.env.VITE_FIREBASE_VAPID_KEY,
  MUIX_LICENSE_KEY:
    import.meta.env.VITE_MUIX_LICENSE_KEY || import.meta.env.YOUR_MUI_PRO_KEY, // prefer first
  ENABLE_FCM: `${import.meta.env.VITE_ENABLE_FCM}` === "true",
};

export default env;
