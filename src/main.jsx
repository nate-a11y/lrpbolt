/* Proprietary and confidential. See LICENSE. */
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./utils/firebaseInit.js"; // keep first
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

// --- SW KILL SWITCH: remove in the NEXT deploy once site is stable ---
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations?.().then(async (regs) => {
    try {
      for (const r of regs) {
        try {
          await r.unregister();
        } catch (e) {
          /* noop */
        }
      }
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      if (!sessionStorage.getItem("reloaded-after-sw-kill")) {
        sessionStorage.setItem("reloaded-after-sw-kill", "1");
        location.reload();
      }
    } catch (e) {
      // swallow errors; the goal is to avoid blocking app start
      console.warn("SW kill switch error:", e);
    }
  });
}

LicenseInfo.setLicenseKey(
  import.meta.env.VITE_MUI_PRO_KEY || import.meta.env.MUI_X_LICENSE_KEY,
);

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
