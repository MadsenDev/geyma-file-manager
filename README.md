# Geyma

**Geyma** (Old Norse: *to keep, to guard*) is a desktop file manager built around three
differentiating ideas:

1. **Files remember.** Every operation (move, rename, star, restore…) is logged. The UI
   surfaces this memory everywhere: per-file activity timelines in the Details panel, a
   disk-wide Timeline module, and "ghost trails" — faint markers left behind in a folder
   showing where recently-departed files went.
2. **Working Sets.** Playlist-like collections of file *references* (never copies). Files
   stay where they live; sets follow them through moves and renames. Sets support notes and
   rule-based "smart" variants that fill themselves from the whole disk.
3. **Deep customizability.** The entire chrome is modular — every UI element (nav, search,
   sidebar panels, even the file grid) is a module the user can drag between six layout
   zones. Eight full color skins with token-level overrides.

This is a from-scratch rewrite (v0.5, in progress) replacing the previous PySide6
implementation, which is preserved at [`archive/pyside6-legacy`](archive/pyside6-legacy).
The design spec this build follows lives at
[`design/geyma-v3.2-handoff`](design/geyma-v3.2-handoff) — `Geyma.dc.html` there is the
authoritative reference prototype.

## Stack

- **React 18 + TypeScript + Vite** for the UI
- **Zustand** for application state
- **Tauri 2** as the desktop shell, giving the app real filesystem access (list/rename/move,
  a recoverable app-level Trash, disk usage) via Rust commands in `src-tauri/src/fsops.rs`
- A **mock in-memory filesystem** (`src/fs/mockBackend.ts`) is used automatically when the
  app runs in a plain browser (`npm run dev` without the Tauri shell), so the UI can be
  developed and demoed without the native shell.

## Getting started

```bash
npm install

# Frontend only, in a browser, backed by the mock filesystem — no Rust toolchain needed
npm run dev

# Full desktop app with real filesystem access (requires Rust + platform WebView deps)
npm run tauri dev
```

Building the native shell requires the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
for your OS (on Linux: `webkit2gtk`, `libayatana-appindicator3`, `librsvg2` development
packages, on top of a Rust toolchain).

```bash
npm run build          # typecheck + build the frontend bundle
npm run typecheck       # TypeScript only
npm run tauri build     # full desktop bundle (needs native deps above)
```

## Project layout

```
src/
  state/       zustand store, layout model (zones/modules), shared types
  theme/       skin tokens + resolver, ThemeContext
  fs/          FsBackend interface + Tauri and mock implementations
  layout/      the zone/module layout engine (Zone, ModuleShell, EditBar)
  modules/     one component per module (files, nav, search, sets, appearance, …)
  overlays/    Quick Look, context menu, toast, modals
  icons/       inline stroke-SVG icon set
src-tauri/     Rust shell: window config + filesystem commands
archive/       the previous PySide6 implementation (reference only, not built)
design/        the v3.2 design handoff this rewrite implements
```

## Status

The zone/module layout engine, skin/token system, and core modules (files grid/list, nav,
location, search, view switch, title, places, devices, status, details, appearance, sets,
disk, recent, timeline, duplicates, clock, visualizer, folder mood, second pane, Quick Look,
ghost trails) are implemented against real filesystem data. Still open, per the design spec:
recursive copy (only cut/move is wired to the real FS today), set share-code import/export
polish, and workspace (full environment) snapshots.
