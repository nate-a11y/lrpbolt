/* Proprietary and confidential. See LICENSE. */
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import AppRoot from "./App.jsx";
import Login from "./pages/Login.jsx";
import SmsConsent from "./pages/SmsConsent.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { DriverProvider } from "./context/DriverContext.jsx";
import AuthProvider from "./context/AuthContext.jsx";
import ColorModeProvider from "./context/ColorModeContext.jsx";
import { LicenseInfo } from "@mui/x-license";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { app as fbApp } from "./utils/firebaseInit.js";

LicenseInfo.setLicenseKey(
  import.meta.env.VITE_MUI_PRO_KEY || import.meta.env.MUI_X_LICENSE_KEY,
);

async function initMessagingWithSW(registration) {
  if (!(await isSupported())) {
    console.warn('[FCM] Messaging not supported in this browser');
    return;
  }
  const messaging = getMessaging(fbApp);
  const vapidKey = import.meta.env.VITE_FB_VAPID_KEY; // e.g., from Firebase console
  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration, // <-- tie FCM to our main SW
    });
    if (token) {
      console.log('[FCM] Token:', token);
      // TODO: send token to backend if needed
    } else {
      console.warn('[FCM] No registration token; permission required');
    }
    onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message:', payload);
      // Show a toast/snackbar, etc.
    });
  } catch (err) {
    console.error('[FCM] getToken failed:', err);
  }
}

async function registerServiceWorkerAndFCM() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      await initMessagingWithSW(reg);
    } catch (e) {
      console.error('[SW] Registration failed:', e);
    }
  } else {
    navigator.serviceWorker?.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister()));
  }
}

registerServiceWorkerAndFCM();

const Root = () => {
  return (
    <BrowserRouter>
      <ColorModeProvider>
        <AuthProvider>
          <DriverProvider>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/sms-consent" element={<SmsConsent />} />
                <Route element={<PrivateRoute />}>
                  <Route path="/*" element={<AppRoot />} />
                </Route>
              </Routes>
            </Suspense>
          </DriverProvider>
        </AuthProvider>
      </ColorModeProvider>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
