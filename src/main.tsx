import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { StorageBoundary } from "./components/StorageBoundary";
import "./index.css";
import "./lib/install.js";
import "./lib/pwa.js";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StorageBoundary>
      <App />
    </StorageBoundary>
  </React.StrictMode>,
);
