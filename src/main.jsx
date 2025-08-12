/* Proprietary and confidential. See LICENSE. */
import React, { Suspense, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./utils/firebaseInit.js"; // single init source of truth
import AppRoot from "./App.jsx";
import Login from "./pages/Login.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { DriverProvider } from "./context/DriverContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./sw-updater.js";

const Root = () => {
  // Optionally grab FCM token on boot (non-blocking)
  useEffect(() => {
    import("./utils/registerFCM").then(({ ensureFcmToken }) => {
      ensureFcmToken((t) => console.info("[FCM] token", t));
    }).catch(() => {});
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <DriverProvider>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/*" element={<PrivateRoute><AppRoot /></PrivateRoute>} />
            </Routes>
          </Suspense>
        </DriverProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
