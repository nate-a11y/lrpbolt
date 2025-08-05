/* Proprietary and confidential. See LICENSE. */
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { DriverProvider } from "./context/DriverContext.jsx";

// Mount the app
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <DriverProvider>
        <Suspense fallback={<LoadingScreen />}>
          <App />
        </Suspense>
      </DriverProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

// Register service worker with basic error logging
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => console.error("SW registration failed:", err));
  });
}
