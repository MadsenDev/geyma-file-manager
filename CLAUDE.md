# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Geyma is a desktop file manager: React + TypeScript UI running inside a Tauri 2 shell, with
real filesystem operations (list/rename/move/copy/trash/restore/extract, disk usage) backed by
Rust commands in `src-tauri/src/`. It's a from-scratch rewrite of a previous PySide6 app, kept
for reference (not built) at `archive/pyside6-legacy`.

## Commands

```bash
npm install

npm run dev             # frontend only, in a browser, backed by the mock in-memory filesystem
npm run tauri dev       # full desktop app with real filesystem access (needs Rust toolchain)

npm run build           # tsc -b && vite build — typecheck then bundle the frontend
npm run typecheck       # tsc -b --noEmit only
npm run tauri build     # produces .deb / .rpm (needs webkit2gtk, libayatana-appindicator3, librsvg2 on Linux)
npm run tauri build -- --bundles appimage   # AppImage isn't in the default target list
```

Rust side (`src-tauri/`), run from that directory:

```bash
cargo test                       # all Rust unit tests
cargo test move_path              # run a single test by name substring
cargo test --lib fsops::tests     # scope to one module's tests
```

There is no frontend test suite yet — `src-tauri` has unit test coverage for filesystem
commands (move/copy/rename/trash/restore/delete/extract, including a zip-slip guard on
extraction) and archive/text preview parsing, in `#[cfg(test)] mod tests` blocks at the bottom
of `fsops.rs`, `media.rs`, and `preview.rs`.

Arch Linux packaging lives in `packaging/arch/PKGBUILD` (a `-git` VCS package, built with
`makepkg -si`).

## Architecture

### Two filesystem backends behind one interface

`src/fs/types.ts` defines `FsBackend`, implemented by:
- `src/fs/tauriBackend.ts` — calls into the Rust `invoke_handler` commands registered in
  `src-tauri/src/lib.rs` (`fsops.rs` for CRUD/trash/extract, `media.rs` for playback support,
  `preview.rs` for archive/text preview).
- `src/fs/mockBackend.ts` — an in-memory filesystem, used automatically whenever the app runs
  outside the Tauri webview (i.e. `npm run dev` in a plain browser). This is what lets the UI be
  developed/screenshotted without a Rust toolchain.

`src/fs/index.ts` picks the backend at runtime by checking for `__TAURI_INTERNALS__` on
`window`. Never branch on "are we in Tauri" elsewhere — go through `getFsBackend()` and code
against the `FsBackend` interface so both backends stay interchangeable.

### Network places (SFTP/SMB) share the same path space

Remote locations are addressed as `sftp://user@host:port/abs/path` and
`smb://user@host:port/Share/sub/path` — ordinary strings that flow through the exact same
`FsEntry.path`, nav state, and working-set refs as local paths. `src/fs/remotePath.ts` has the
scheme-aware `dirname`/`basename`/`join` (SMB floors at the share root — `dirname(shareRoot) ===
shareRoot` — the same trick `dirnamePosix` uses at `"/"`, which is what makes `canUp()` disable
"Up" there for free). `tauriBackend.ts` checks `isRemotePath()` in every method and either routes
to a `remote_*` Tauri command or falls back to the local one; `mockBackend.ts` mirrors this with
a couple of simulated demo connections (`MOCK_SFTP_ROOT`/`MOCK_SMB_ROOT`, password `"demo"`) so
the whole flow — add connection, connect, browse, copy in/out, rename, delete, disconnect — is
clickable from a plain browser.

Scope is deliberately narrower than local: browse, rename, copy/move within a connection, and
permanent delete (there's no remote Trash) all work; symlinks, chmod/ownership, and archive
extract-in-place don't — `tauriBackend.ts` throws a clear "not available for network locations"
for those, and `Files.tsx`'s context menu hides them for remote entries (checked via
`isRemotePath(entry.path)`) and swaps "Trash" for "Delete permanently" (reusing
`requestPermanentDelete`, the same double-press-to-confirm flow the Trash view uses). RAR-style
"no good option" tradeoffs don't apply here since the crates are mature (`russh`+`russh-sftp` for
SFTP, the pure-Rust `smb` crate for SMB2/3) — but there is no host-key verification for SFTP
(accepts any server key) and no OS-native SMB signing story beyond what the crate provides; both
are noted in `src-tauri/src/remote/sftp.rs` and worth revisiting before treating this as
hardened against a hostile network.

Saved connections (`RemoteConnection` in `state/types.ts`) persist like everything else in
`store.ts`, but never with a plaintext password — `keyring_save_password`/`keyring_load_password`
(Rust, via the `keyring` crate's async-secret-service backend, so no libdbus/libsecret build
dependency) store the password in the OS keyring, keyed by the connection's id, only when the
user opts in via "Remember password".

### Single Zustand store drives everything

`src/state/store.ts` is one large `useStore` (Zustand) holding navigation, selection, view/sort,
search, starring, trash, clipboard, undo stack, working sets, appearance, and layout state, plus
every action that mutates it (file ops, selection, layout editing, etc.). There's no separate
service/controller layer — modules call store actions directly.

Key invariants enforced in the store, not obvious from any single function:
- **`visibleEntries()` is the single source of truth** for what the Files module currently shows
  (grid contents, item count, keyboard nav, select-all, Quick Look stepping). Any new filter/sort
  behavior has to go through it or those consumers silently disagree.
- **Working Sets hold references, never copies** (`{dir, name}` pairs, see `SetItemRef` in
  `state/types.ts`). Every operation that moves/renames/trashes/restores/permanently-deletes a
  file must call `updateSetRefs(...)` to keep set items pointing at the right place (or drop the
  ref, on permanent delete). Smart sets (`WorkingSet.smart`) are excluded from this — they're
  recomputed live from a `rule` (`starred`, `kind`, `minMt`) against `get().dirs` instead of a
  fixed item list.
- **Undo is a manual stack** (`pushUndo`/`undo`), not automatic — each mutating action builds its
  own inverse (e.g. move back, re-trash, rename back) and pushes it after the operation succeeds.
- **Ghost trails** (`addGhost`/`ghosts` map) are a separate, capped-at-3-per-folder breadcrumb of
  "a file that just left went to X" and get cleared by `removeGhostOnReturn` if the destination
  matches. Don't conflate this with `fileEvents` (the per-file activity timeline, capped at 30)
  or `globalFeed` (the disk-wide Timeline module, capped at 60) — three different logs for three
  different UI surfaces.
- State is persisted to `localStorage` (`geyma-v1`) via `persist()`, called explicitly after
  every mutation that should survive reload (skin, layout, columns, sets, starred, trash origin
  maps, etc.) — it is not automatic middleware, so new persisted fields need both an entry in
  `PersistedShape` and a `get().persist()` call at the mutation site.

### Modular chrome: zones, modules, layout

The entire UI chrome is built from **modules** (one per feature: `Nav`, `Files`, `Details`,
`Sets`, `Disk`, …) that live in **zones** (`top`, `left`, `center`, `center2`, `right`, `bottom`).

- `src/state/layout.ts` is the schema: `ModuleId`, `ZoneId`, `Layout = Record<ZoneId, ModuleId[]>`,
  the default layout, and `LAYOUT_PRESETS` (Classic, Focus, Minimal, Commander, Dashboard, etc).
- `src/modules/registry.tsx` maps each `ModuleId` to its component — adding a new module means
  adding it to `ModuleId` in `layout.ts`, `MODULE_NAMES`, `ALL_MODULES`, the registry, and
  probably `isPanelModule`/`isStretchModule` (which affect how `ModuleShell` sizes it).
  `centerSplit`/`center2` is the "second pane" split, distinct from ordinary zone contents.
- `src/layout/Zone.tsx` renders a zone's modules and handles drag-and-drop reordering between
  zones; `EditBar.tsx` is the chip strip for hiding/restoring modules in edit mode
  (`store.editMode`); `ModuleShell.tsx` wraps each module with its chrome (drag handle, options
  menu, hide button).
- Layout changes always go through store actions (`moveModule`, `hideModule`, `showModule`,
  `applyPreset`, `resetLayout`) which call `mergeLayout` to filter out unknown/duplicate module
  ids before persisting — don't hand-edit the `layout` object.

### Theming

`src/theme/skins.ts` defines `SKINS` (eight named palettes, each a flat set of color/font/radius/
tile/pattern tokens) and `SkinOverrides` (per-token user overrides: accent, font, radius, tile,
icon style, background pattern). `ThemeContext.tsx` resolves the active skin + overrides into a
`ResolvedTheme` that components read via `useTheme()`. Don't hardcode colors in components —
pull from the resolved theme so all eight skins and overrides keep working.

### Rust side

`src-tauri/src/fsops.rs` implements the real filesystem commands (list/stat/create/rename/move/
copy/trash/restore/delete-permanently/extract-archive/disk-usage/list-devices) invoked from
`tauriBackend.ts`. Extraction guards against zip-slip (paths escaping the destination directory
during archive extraction) — preserve that check if you touch `extract_archive`. `media.rs`
handles native audio/video playback capability checks and a local media server; `preview.rs`
handles archive listing and text file preview parsing.

`src-tauri/src/archives.rs` holds the non-ZIP read path: tar (plain, or gzip/bzip2/xz
compressed) and 7z, listed and extracted via pure-Rust crates (`tar`, `flate2`, `bzip2-rs`,
`lzma-rs`, `sevenz-rust`) with no system/native dependency. `fsops::extract_archive` and
`preview::preview_archive` both call `archives::detect()` first and only fall back to the
ZIP-specific path when it returns `None` — a new archive format should plug in there, not as a
parallel command. RAR is deliberately unsupported: there's no mature pure-Rust reader for it
(see the archives.rs module doc for the tradeoffs considered). Compression (`create_archive`)
stays ZIP-only; only extraction/preview cover the wider format set. All Tauri commands are
registered once in `lib.rs`'s `invoke_handler!` list — a new command needs an entry there too.

`src-tauri/src/remote.rs` (plus `remote/sftp.rs` and `remote/smb.rs`) is the network-places
backend: `RemoteAddr`/`parse()` turn an `sftp://`/`smb://` path string into a protocol+host+path,
`RemoteSessions` is Tauri-managed state holding live connections keyed by
`RemoteAddr::connection_key()` (host+port+username[+share], not by path — browsing around a
connection reuses one session), and the `remote_*` commands dispatch to `sftp.rs`/`smb.rs`
per protocol. There's no automatic reconnect: a dropped session surfaces as a "reconnect from
the Network panel" error rather than retrying silently. Both submodules were verified against
real local `sshd`/`smbd` instances during development (not part of the committed test suite,
since that would need live servers in CI too) — the parsing/routing logic in `remote.rs` itself
has ordinary `#[cfg(test)]` unit tests that need no network.
