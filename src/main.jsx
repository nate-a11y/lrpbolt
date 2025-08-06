/* Proprietary and confidential. See LICENSE. */
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Login from "./pages/Login.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { DriverProvider } from "./context/DriverContext.jsx";
import { AuthProvider } from "./components/AuthProvider.jsx";
import "./registerSW.js";
import { logError } from "./utils/logError";
import { getRedirectResult } from "firebase/auth";
import { auth } from "./firebase";

window.addEventListener("unhandledrejection", (event) => {
  logError(event.reason, "UnhandledPromiseRejection");
});

// Mount the app after handling potential redirect result
getRedirectResult(auth)
  .then((result) => {
    if (result?.user) {
      console.log("🔄 Redirect login OK:", result.user);
    }
  })
  .catch((err) => {
    console.error("❌ Redirect login failed:", err);
  })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById("root")).render(
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <React.StrictMode>
          <AuthProvider>
            <DriverProvider>
              <Suspense fallback={<LoadingScreen />}>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  {/* Firebase Auth iframe route placeholder */}
                  <Route path="/__/auth/iframe" element={<div />} />
                  <Route element={<PrivateRoute />}>
                    <Route path="/*" element={<App />} />
                  </Route>
                </Routes>
              </Suspense>
            </DriverProvider>
          </AuthProvider>
        </React.StrictMode>
      </BrowserRouter>,
    );
  });
