---
name: verify
description: Build, launch, and drive Geyma in mock-filesystem mode to verify frontend changes at the GUI surface.
---

# Verifying Geyma frontend changes

The fastest runtime surface is the browser + mock backend — no Rust toolchain
needed. `npm run dev` serves on **http://localhost:1420** (strictPort) and the
app auto-selects `mockBackend` outside the Tauri webview.

```bash
npm run dev &            # dev server on :1420
npm run build            # typecheck + prod bundle (also prints chunk sizes)
npm run preview -- --port 4173   # serve the prod bundle from dist/
```

Drive it with Playwright against the pre-installed Chromium
(`executablePath: "/opt/pw-browsers/chromium"`; install `playwright-core` in a
scratch dir, it is not a project dep).

Useful flows / selectors in mock mode:
- App is "up" when `todo.md` (a mock home-dir entry) is visible.
- Quick Look: click an entry, press Space → `[role='dialog']`; highlighted
  code shows as `.gy-hl [class*='hljs-']` spans.
- Mock remote connections use password `"demo"`.
- Persisted state lives in localStorage key `geyma-v1`; first-paint colors in
  `geyma-bg` / `geyma-ink` (read by the inline script in index.html).

Gotchas:
- The app must work fully offline — a good probe is `ctx.route("**/*", …)`
  aborting every non-localhost request; nothing should break (fonts are
  self-hosted via @fontsource, imported in src/styles/fonts.ts).
- `document.fonts.check()` is false for declared-but-unused fonts; call
  `document.fonts.load("16px 'Spectral'")` first to force the fetch.
- highlight.js must stay out of the startup chunk: assert no request URL
  containing `highlightEngine` before Quick Look opens.
