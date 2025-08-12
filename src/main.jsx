/* Proprietary and confidential. See LICENSE. */
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./utils/firebaseInit.js"; // keep first
import AppRoot from "./App.jsx";
import Login from "./pages/Login.jsx";
import PrivateRoute from "./components/PrivateRoute.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { DriverProvider } from "./context/DriverContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import ColorModeProvider from "./context/ColorModeContext.jsx";
import "./sw-updater.js";
import { registerFCM } from "./utils/registerFCM";

if ("serviceWorker" in navigator) {
  // don’t block app start
  registerFCM().then((res) => {
    if (!res?.ok) {
      console.info("[FCM] token not acquired:", res?.reason);
    } else {
      console.info("[FCM] token:", res.token);
      // TODO: POST token to backend if needed
    }
  });
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
                <Route path="/*" element={<PrivateRoute><AppRoot /></PrivateRoute>} />
              </Routes>
            </Suspense>
          </DriverProvider>
        </AuthProvider>
      </ColorModeProvider>
    </BrowserRouter>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
