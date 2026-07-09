import "./styles/fonts";
import "./i18n";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { tr } from "./i18n";
import { App } from "./App";
import { ThemeProvider } from "./theme/ThemeContext";
import { useStore } from "./state/store";
import "./styles/global.css";

// Last-resort net for errors nothing caught: a forgotten `void somePromise` rejection
// or a bug outside React's tree still surfaces as an error toast (deduped by the toast
// queue) instead of dying silently in the console. React render crashes are handled
// per-panel by ModuleErrorBoundary, not here.
window.addEventListener("unhandledrejection", (event) => {
  useStore.getState().showError(tr("errors.unexpected"), event.reason);
});
window.addEventListener("error", (event) => {
  useStore.getState().showError(tr("errors.unexpected"), event.error ?? event.message);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
);
