/* Proprietary and confidential. See LICENSE. */
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import HomeIcon from "@mui/icons-material/Home";
import DirectionsCarIcon from "@mui/icons-material/DirectionsCar";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

import "./utils/firebaseInit.js"; // runs before AuthProvider / subscriptions
import "./index.css";
import "./sw-updater.js";

import LayoutShell from "./layout/LayoutShell.jsx";
import AppRoot from "./App.jsx";
import Login from "./pages/Login.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { DriverProvider } from "./context/DriverContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import ColorModeProvider from "./context/ColorModeContext.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { logError } from "./utils/logError";

function AppWithShell() {
  const nav = useNavigate();
  const items = [
    { label: "Dashboard", icon: HomeIcon, to: "/" },
    { label: "Rides", icon: DirectionsCarIcon, to: "/rides" },
    { label: "Time Logs", icon: AccessTimeIcon, to: "/clock" },
  ];
  return (
    <LayoutShell railItems={items} onNavigate={(to) => nav(to)}>
      <AppRoot />
    </LayoutShell>
  );
}

window.addEventListener("unhandledrejection", (event) => {
  logError(event.reason, "UnhandledPromiseRejection");
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ColorModeProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <ErrorBoundary>
          <AuthProvider>
            <DriverProvider>
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  {/* Firebase Auth iframe route placeholder */}
                  <Route path="/__/auth/iframe" element={<div />} />
                  <Route
                    path="/*"
                    element={
                      <PrivateRoute>
                        <AppWithShell />
                      </PrivateRoute>
                    }
                  />
                </Routes>
              </Suspense>
            </DriverProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </ColorModeProvider>
  </React.StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("[SW] register failed:", err);
    });
  });
}

if (import.meta.env.DEV) {
  const { activeListenerCount } = await import("./utils/firestoreListenerRegistry.js");
  setInterval(() => {
    const n = activeListenerCount();
    if (n > 200) console.warn(`[FS] HIGH listener count: ${n}`);
  }, 10000);
}
