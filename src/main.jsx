/* Proprietary and confidential. See LICENSE. */
import { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { initServiceWorkerMessageBridge } from "@/pwa/swMessages";
import { registerSW } from "@/pwa/registerSW";
import ActiveClockProvider from "@/context/ActiveClockContext.jsx";
import PermissionGate from "@/context/PermissionGate.jsx";

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

const Root = () => {
  return (
    <PermissionGate>
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
    </PermissionGate>
  );
};

// NEW: attach message bridge immediately to catch cold-start clicks
initServiceWorkerMessageBridge();
// Kick off SW registration in parallel; do not await for UI to render
registerSW();

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
