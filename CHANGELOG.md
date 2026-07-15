# Changelog

All notable changes to Geyma are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0-rc.1] - 2026-07-15

First release candidate for 0.7.0 — the initial public build of the React + Tauri 2
rewrite. Early access: the core file-management features work, but keep backups of
anything irreplaceable.

### Added

- **Browsing & navigation** — grid and list views, sorting, a clickable breadcrumb
  location bar, back/forward/up history per tab, Places and Devices sidebars, a hidden-files
  toggle, and a resume-or-fresh startup mode.
- **Tabs and dual-pane browsing** — multiple tabs with independent history, plus a
  toggleable second file pane with a draggable, persisted split.
- **Core file operations** — rename, create, copy/cut/paste, move, trash/restore,
  permanent delete, and disk-usage scans, all working on multi-selections with a manual
  undo stack.
- **Memory** — a per-file activity timeline (up to 200 events, individually undoable), a
  disk-wide Timeline module, and ghost trails marking where files went.
- **Working Sets** — reference-based collections (never copies), including smart and
  hybrid sets recomputed live from rules.
- **Network places** — browse, rename, copy/move, and permanently delete over
  `sftp://` and `smb://`, sharing the same path space as local files. SFTP host keys are
  pinned trust-on-first-use with a "server identity changed" prompt; SMB devices on the LAN
  are discoverable via mDNS. Passwords are stored in the OS keyring only when opted in.
- **Archives** — extract and preview ZIP, tar (plain/gzip/bzip2/xz), and 7z via pure-Rust
  crates, with a zip-slip guard; ZIP compression for creating archives.
- **Modular chrome** — 21 modules across 6 zones, 8 layout presets, drag-and-drop layout
  editing, and 8 theme skins with per-token overrides.
- **Localization** — all user-facing strings routed through react-i18next.
- **Error pipeline** — coded errors from Rust classified and translated in the frontend,
  surfaced as deduped toasts or in-place notices with retry.

### Infrastructure

- Continuous integration workflow gating every push and pull request on the frontend
  typecheck/bundle, the Rust unit tests, and a clippy run treating warnings as errors.
- Release workflow builds `.deb`/`.rpm`/AppImage on a version tag and attaches them to a
  draft GitHub release.

[0.7.0-rc.1]: https://github.com/MadsenDev/geyma-file-manager/releases/tag/v0.7.0-rc.1
