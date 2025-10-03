/* Proprietary and confidential. See LICENSE. */
import { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { initServiceWorkerMessageBridge } from "@/pwa/swMessages";
import {
  ensureServiceWorkerRegistered,
  getFcmTokenSafe,
  isSupportedBrowser,
} from "@/services/fcm";
import ActiveClockProvider from "@/context/ActiveClockContext.jsx";

import AppRoot from "./App.jsx";
import Login from "./pages/Login.jsx";
import SmsConsent from "./pages/SmsConsent.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import "./index.css";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { DriverProvider } from "./context/DriverContext.jsx";
import AuthProvider from "./context/AuthContext.jsx";
import ColorModeProvider from "./context/ColorModeContext.jsx";
import NotificationsProvider from "./context/NotificationsProvider.jsx";
import ToastProvider from "./context/ToastProvider.jsx";
import "./utils/firebaseInit.js";
import "./muix-license.js";
import AppError from "./utils/AppError.js";
import logError from "./utils/logError.js";

const hasVapidKey = Boolean(import.meta?.env?.VITE_FIREBASE_VAPID_KEY);
if (!hasVapidKey) {
  console.warn(
    "[LRP] VITE_FIREBASE_VAPID_KEY is not set. Push token requests will fail unless firebaseConfig.vapidKey is provided.",
  );
}

initServiceWorkerMessageBridge();

const bootstrapPushMessaging = () => {
  if (typeof window === "undefined") return;
  if (!isSupportedBrowser()) {
    console.info("[LRP][FCM] push messaging not supported in this context");
    return;
  }

  (async () => {
    try {
      const registration = await ensureServiceWorkerRegistered();
      if (!registration) {
        console.warn("[LRP][FCM] service worker registration failed");
        return;
      }

      const token = await getFcmTokenSafe({
        serviceWorkerRegistration: registration,
      });
      if (token) {
        console.info("[LRP][FCM] FCM token acquired");
      } else {
        console.info("[LRP][FCM] FCM token unavailable (permission pending)");
      }
    } catch (error) {
      if (error instanceof AppError && error.code === "missing_vapid_key") {
        console.warn("[LRP][FCM] missing VAPID key; cannot request token");
        return;
      }
      logError(error, { where: "main", action: "bootstrap-fcm" });
    }
  })();
};

bootstrapPushMessaging();

const Root = () => {
  return (
    <BrowserRouter>
      <ColorModeProvider>
        <AuthProvider>
          <ActiveClockProvider>
            <DriverProvider>
              <ToastProvider>
                <NotificationsProvider>
                  <Suspense fallback={<LoadingScreen />}>
                    <Routes>
                      <Route path="/login" element={<Login />} />
                      <Route path="/sms-consent" element={<SmsConsent />} />
                      <Route element={<PrivateRoute />}>
                        <Route path="/*" element={<AppRoot />} />
                      </Route>
                    </Routes>
                  </Suspense>
                </NotificationsProvider>
              </ToastProvider>
            </DriverProvider>
          </ActiveClockProvider>
        </AuthProvider>
      </ColorModeProvider>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
