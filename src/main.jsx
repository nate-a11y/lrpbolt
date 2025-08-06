/* Proprietary and confidential. See LICENSE. */
import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import LoadingScreen from "./components/LoadingScreen.jsx";
import { DriverProvider } from "./context/DriverContext.jsx";
import { logError } from "./utils/errorUtils";

// Mount the app
ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <React.StrictMode>
      <DriverProvider>
      
        <Suspense fallback={<LoadingScreen />}>
          <App />
        </Suspense>
      </DriverProvider>
    </React.StrictMode>
  </BrowserRouter>,
);

// Register service worker with basic error logging
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}service-worker.js`;
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => console.log("SW registered:", reg.scope))
      .catch((err) => logError(err, "SW registration failed"));
  });
}
