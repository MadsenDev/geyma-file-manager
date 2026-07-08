import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";

// initAsync: false makes init synchronous (resources are bundled inline),
// so `tr` is safe to call from module scope — e.g. store.ts toasts and the
// layout/menu constants — not just from React components.
i18next.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: en } },
  interpolation: { escapeValue: false },
  initAsync: false,
});

// Exported as `tr` (not `t`) because components conventionally bind the
// resolved theme as `const t = useTheme()` — a local `t` would shadow the
// translation function.
export const tr = i18next.t.bind(i18next);
export default i18next;
