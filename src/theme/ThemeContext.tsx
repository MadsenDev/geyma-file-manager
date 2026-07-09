import { createContext, useContext, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { useStore } from "../state/store";
import { hexA, resolveTheme, type ResolvedTheme } from "./skins";

const ThemeCtx = createContext<ResolvedTheme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const skin = useStore((s) => s.skin);
  const ov = useStore((s) => s.ov);
  const theme = useMemo(() => resolveTheme(skin, ov), [skin, ov]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--gy-bg", theme.bg);
    root.style.setProperty("--gy-ink", theme.ink);
    root.style.setProperty("--gy-body", theme.body);
    root.style.setProperty("--gy-scrollbar", hexA(theme.ink, theme.isDark ? 0.28 : 0.22));
    root.style.setProperty("--gy-hover", hexA(theme.ink, theme.isDark ? 0.08 : 0.05));
    root.style.setProperty("--gy-itemhover", hexA(theme.ink, theme.isDark ? 0.07 : 0.045));
    root.style.setProperty("--gy-itemhoverb", hexA(theme.ink, 0.14));
    root.style.setProperty("--gy-rowhover", hexA(theme.ink, theme.isDark ? 0.06 : 0.035));
    document.body.style.background = theme.bg;
    document.body.style.colorScheme = theme.isDark ? "dark" : "light";
    // Read by the inline script in index.html so the next launch first-paints
    // in this skin's colors instead of flashing the default.
    try {
      localStorage.setItem("geyma-bg", theme.bg);
      localStorage.setItem("geyma-ink", hexA(theme.ink, 0.4));
    } catch {
      // localStorage unavailable — the splash keeps its default colors.
    }
  }, [theme]);

  return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ResolvedTheme {
  const t = useContext(ThemeCtx);
  if (!t) throw new Error("useTheme must be used within ThemeProvider");
  return t;
}
