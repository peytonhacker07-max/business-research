import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { registerServiceWorker, pushSupported } from "./lib/push";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Register the service worker so the app can receive push notifications.
if (pushSupported()) {
  registerServiceWorker().catch(() => {
    /* notifications just won't be available; the app still works fully */
  });
}
