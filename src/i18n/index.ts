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

// FileEvent.action values are stable identifiers: they're persisted in
// localStorage and compared (undo eligibility, event undo dispatch), so the
// stored strings must never change with the UI language. Translate them only
// at display time, through this lookup.
const EVENT_ACTION_KEYS: Record<string, string> = {
  Renamed: "event.renamed",
  "Moved here": "event.moved_here",
  Created: "event.created",
  "Copied here": "event.copied_here",
  Deleted: "event.deleted",
  Restored: "event.restored",
  Compressed: "event.compressed",
  Linked: "event.linked",
  "Permissions changed": "event.permissions_changed",
  "Permanently deleted": "event.permanently_deleted",
};

export function trEventAction(action: string): string {
  const key = EVENT_ACTION_KEYS[action];
  return key ? tr(key) : action;
}

export default i18next;
