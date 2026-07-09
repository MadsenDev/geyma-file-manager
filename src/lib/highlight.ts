import { useEffect, useState } from "react";
import type { ResolvedTheme } from "../theme/skins";

// highlight.js and its grammars live in highlightEngine.ts, loaded on demand the
// first time a text preview needs highlighting, so the initial bundle (and app
// startup) never pays for them. Do not import highlightEngine statically.

type Engine = typeof import("./highlightEngine");

let enginePromise: Promise<Engine> | null = null;

function loadEngine(): Promise<Engine> {
  if (!enginePromise) enginePromise = import("./highlightEngine");
  return enginePromise;
}

/**
 * Highlighted HTML for `code`, or null while the engine loads / when the
 * extension has no grammar — callers render the plain text in the meantime.
 */
export function useHighlight(code: string | null, ext: string): string | null {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    if (code == null) {
      setHtml(null);
      return;
    }
    let cancelled = false;
    loadEngine().then(
      (engine) => {
        if (!cancelled) setHtml(engine.highlightCode(code, ext));
      },
      () => {
        if (!cancelled) setHtml(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [code, ext]);
  return html;
}

function hexToHsl(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

/** Rotate a hex color's hue, keeping the saturation and lightness the theme chose for contrast. */
function shiftHue(hex: string, deg: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  const [h, s, l] = hsl;
  return `hsl(${(((h + deg) % 360) + 360) % 360}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%)`;
}

/** CSS for hljs token classes, derived from the active skin. Scope: elements inside `.gy-hl`. */
export function highlightCss(t: ResolvedTheme): string {
  const keyword = t.accent;
  const string = shiftHue(t.accent, -55);
  const number = shiftHue(t.accent, 55);
  return `
.gy-hl .hljs-comment,.gy-hl .hljs-quote,.gy-hl .hljs-meta{color:${t.inkFaint};font-style:italic}
.gy-hl .hljs-keyword,.gy-hl .hljs-selector-tag,.gy-hl .hljs-built_in,.gy-hl .hljs-tag,.gy-hl .hljs-name,.gy-hl .hljs-section{color:${keyword};font-weight:600}
.gy-hl .hljs-string,.gy-hl .hljs-regexp,.gy-hl .hljs-addition,.gy-hl .hljs-bullet{color:${string}}
.gy-hl .hljs-number,.gy-hl .hljs-literal,.gy-hl .hljs-symbol,.gy-hl .hljs-link{color:${number}}
.gy-hl .hljs-title,.gy-hl .hljs-function .hljs-title,.gy-hl .hljs-class .hljs-title{color:${t.ink};font-weight:700}
.gy-hl .hljs-attr,.gy-hl .hljs-attribute,.gy-hl .hljs-property,.gy-hl .hljs-variable,.gy-hl .hljs-template-variable,.gy-hl .hljs-params{color:${t.inkSoft}}
.gy-hl .hljs-deletion{color:${t.inkFaint};text-decoration:line-through}
.gy-hl .hljs-emphasis{font-style:italic}
.gy-hl .hljs-strong{font-weight:700}
`.trim();
}
