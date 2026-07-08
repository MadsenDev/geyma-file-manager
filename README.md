<p align="center">
  <img src="docs/readme/hero-banner.png" alt="Geyma — Old Norse: to keep, to guard. The file manager that remembers where your files have been." width="100%">
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-211D17" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/status-v0.7%20in%20progress-2A6FDB" alt="Status">
  <img src="https://img.shields.io/badge/stack-React%20%2B%20Tauri%202-7C5CD6" alt="Stack">
</p>

<p align="center">
  <strong>Most file managers show you where your files are.<br>
  Geyma also knows where they've been, keeps living collections of them,<br>
  and reshapes its entire chrome to how you work.</strong>
</p>

<p align="center">
  <img src="docs/screenshots/hero.png" alt="Geyma's main window: file grid, working sets, and details panel" width="100%">
</p>

<br>

<img src="docs/readme/feature-memory.png" alt="01 · Memory — Files remember. Every move leaves a ghost trail behind." width="100%">

Every move, rename, star, and restore is logged — and that memory surfaces everywhere.
A per-file activity timeline in the Details panel. A disk-wide Timeline module. And
**ghost trails**: faint, dashed markers left behind in a folder showing where a file that
just left actually went. Click one and Geyma takes you straight there.

No more *"it was right here yesterday."* It was — and Geyma will show you where it went.

<br>

<img src="docs/readme/feature-sets.png" alt="02 · Working Sets — Playlists for files. References, never copies." width="100%">

A **Working Set** is a playlist-like collection of file *references* — never copies. Files
stay exactly where they live on disk; the set just follows them through moves, renames,
trashing, and restoring. Attach a note, or make a set **smart** — a rule like `starred`,
`kind: image`, or `modified since…` that fills itself live from the whole disk.

Share any set with anyone as a single `GYSET.` code. Items, rule, note — the whole thing
round-trips.

<br>

<img src="docs/readme/feature-chrome.png" alt="03 · Your chrome — Reshape everything. Modules, zones, eight skins." width="100%">

There is no fixed layout. Every piece of UI — nav, search, sidebar panels, even the file
grid itself — is a **module** you can drag between six layout zones, hide, or bring back
from the edit bar. Eight full color skins, each overridable **token by token**: accent,
font, radius, density, glow, background pattern.

<p align="center">
  <img src="docs/screenshots/skins.png" alt="Edit mode showing the modular layout and all eight color skins" width="100%">
</p>

## A closer look

<table>
<tr>
<td width="50%">
<img src="docs/screenshots/dark-mode.png" alt="Obsidian dark skin with a selected image file">
<p align="center"><em>Eight skins, light or dark — here, Obsidian</em></p>
</td>
<td width="50%">
<img src="docs/screenshots/list-view.png" alt="List view with sortable Kind, Size, and Modified columns">
<p align="center"><em>List view with sortable columns</em></p>
</td>
</tr>
<tr>
<td width="50%" colspan="2">
<img src="docs/screenshots/quick-look.png" alt="Quick Look overlay previewing a PDF, with step arrows">
<p align="center"><em>Quick Look — Space to preview, arrow keys to step through the folder</em></p>
</td>
</tr>
</table>

## Everything you'd expect, too

Real file management, backed by Rust: cut / copy / paste, duplicate, recursive copy,
a recoverable Trash, ZIP extraction *and* compression, batch rename (pattern + numbering,
undoable), symlinks, a full Properties dialog with editable unix permissions, disk usage,
Quick Look previews, and duplicate detection. Working-set references stay correct across
every one of these operations.

## Under the hood

- **React 18 + TypeScript + Vite** for the UI, **Zustand** for state
- **Tauri 2** as the desktop shell — filesystem operations are Rust commands in
  `src-tauri/src/fsops.rs`, with unit test coverage (including a zip-slip guard)
- A **mock in-memory filesystem** kicks in automatically in a plain browser
  (`npm run dev` without the Tauri shell), so the UI can be developed and demoed
  with no Rust toolchain — it's what the screenshots above are running

## Getting started

```bash
npm install

# Frontend only, in a browser, backed by the mock filesystem — no Rust needed
npm run dev

# Full desktop app with real filesystem access (requires Rust + WebView deps)
npm run tauri dev
```

Building the native shell requires the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)
for your OS (on Linux: `webkit2gtk`, `libayatana-appindicator3`, `librsvg2` development
packages, on top of a Rust toolchain).

```bash
npm run build           # typecheck + build the frontend bundle
npm run typecheck       # TypeScript only
npm run tauri build     # .deb and .rpm bundles (needs native deps above)
```

Arch Linux is packaged via [`packaging/arch/PKGBUILD`](packaging/arch/PKGBUILD) — build it
with `makepkg -si`. AppImage is buildable on demand with
`npm run tauri build -- --bundles appimage`.

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
design/        the v3.2 design handoff this rewrite implements
```

## Roadmap

Still open, per the design spec: workspace snapshots, binding a look/layout snapshot to a
working set, non-ZIP archive formats (tar/rar/7z), tabs, and network protocols (smb/sftp).

<p align="center">
  <img src="docs/readme/footer.png" alt="Geyma — to keep, to guard, to remember" width="100%">
</p>
