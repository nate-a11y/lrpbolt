/* Proprietary and confidential. See LICENSE. */
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./utils/firebaseInit.js"; // keep first
import { killRogueServiceWorkers } from "./utils/killRogueSW";
import "./pwa";
import { registerFCM } from "./utils/registerFCM";
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

LicenseInfo.setLicenseKey(
  import.meta.env.VITE_MUI_PRO_KEY || import.meta.env.MUI_X_LICENSE_KEY,
);

if (typeof window !== "undefined") {
  killRogueServiceWorkers();
  if ("serviceWorker" in navigator) {
    registerFCM().then((res) => {
      if (!res?.ok) console.info("[FCM]", res?.reason || "noop");
    });
  }
}

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
