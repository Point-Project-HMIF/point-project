import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

function installDesktopZoomStabilizer() {
  const applyScale = () => {
    const isDesktop = window.matchMedia("(min-width: 768px)").matches;
    if (!isDesktop || !window.innerWidth || !window.outerWidth) {
      document.documentElement.style.setProperty("--browser-zoom-scale", "1");
      return;
    }

    const estimatedZoom = window.outerWidth / window.innerWidth;
    const compensation =
      estimatedZoom < 0.98
        ? Math.min(1.35, Math.max(1, 1 / estimatedZoom))
        : 1;
    document.documentElement.style.setProperty(
      "--browser-zoom-scale",
      compensation.toFixed(3),
    );
  };

  let frame = 0;
  const schedule = () => {
    window.cancelAnimationFrame(frame);
    frame = window.requestAnimationFrame(applyScale);
  };

  applyScale();
  window.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("resize", schedule);
}

installDesktopZoomStabilizer();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
