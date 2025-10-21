/* Proprietary and confidential. See LICENSE. */
import { Suspense, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { initServiceWorkerMessageBridge } from "@/pwa/swMessages";
import { initMessagingAndToken } from "@/services/fcm";
import { initSentry, logEvent } from "@/services/observability";
import { initAnalytics } from "@/services/analytics";
import SnackbarProvider from "@/components/feedback/SnackbarProvider.jsx";
import LiveRegion from "@/components/a11y/LiveRegion.jsx";
import ActiveClockProvider from "@/context/ActiveClockContext.jsx";

import AppRoot from "./App.jsx";
import Login from "./pages/Login.jsx";
import SmsConsent from "./pages/SmsConsent.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import "./index.css";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { DriverProvider } from "./context/DriverContext.jsx";
import AuthProvider from "./context/AuthContext.jsx";
import { ColorModeProvider } from "./context/ColorModeContext.jsx";
import NotificationsProvider from "./context/NotificationsProvider.jsx";
import { initAnalyticsIfEnabled } from "./utils/firebaseInit.js";
import "./muix-license.js";
import initEruda from "./utils/initEruda.js";

initAnalyticsIfEnabled?.();
initAnalytics(); // fire-and-forget; guarded internally
initServiceWorkerMessageBridge();
initEruda();

if (typeof window !== "undefined") {
  if (!window.__LRP_OBS__) {
    window.__LRP_OBS__ = true;
    Promise.resolve(initSentry()).then(() =>
      logEvent("app_start", { ts: Date.now() }),
    );
  }
  if (!window.__LRP_FCM_BOOT__) {
    // Flag is set inside initMessagingAndToken, but keep external guard for early calls/HMR
    initMessagingAndToken();
  }
}

const Root = () => {
  const [liveMessage, setLiveMessage] = useState(() => {
    if (typeof window === "undefined") return "";
    if (typeof window.__LRP_LIVE_MSG__ === "undefined") {
      window.__LRP_LIVE_MSG__ = "";
    }
    return window.__LRP_LIVE_MSG__ || "";
  });

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleLive = (event) => {
      const next = typeof event?.detail === "string" ? event.detail : "";
      setLiveMessage(next);
    };
    window.addEventListener("lrp:live-region", handleLive);
    return () => {
      window.removeEventListener("lrp:live-region", handleLive);
    };
  }, []);

  return (
    <BrowserRouter>
      <ColorModeProvider>
        <AuthProvider>
          <ActiveClockProvider>
            <DriverProvider>
              <SnackbarProvider>
                <NotificationsProvider>
                  <LiveRegion message={liveMessage} />
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
              </SnackbarProvider>
            </DriverProvider>
          </ActiveClockProvider>
        </AuthProvider>
      </ColorModeProvider>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
